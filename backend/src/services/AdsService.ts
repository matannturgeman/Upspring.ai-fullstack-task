import { type HydratedDocument } from 'mongoose'
import Brand, { type IBrand } from '../models/Brand.ts'
import Ad from '../models/Ad.ts'
import RawAd from '../models/RawAd.ts'
import SearchSession from '../models/SearchSession.ts'
import { RawAdDataSchema } from '../schemas/rawAd.schemas.ts'
import type { ScraperRegistry } from '../scrapers/ScraperRegistry.ts'
import type { ExtractionService } from './ExtractionService.ts'

export type AdsResult =
  | { empty: true; brand: null; ads: []; message: string }
  | { empty: false; brand: HydratedDocument<IBrand>; ads: unknown[]; fromCache: boolean; partial: boolean }

export class AdsService {
  constructor(
    private readonly scrapers: ScraperRegistry,
    private readonly extraction: ExtractionService,
  ) {}

  async getAds(brand: string, limit: number, forceRefresh: boolean): Promise<AdsResult> {
    const normalizedName = brand.toLowerCase()

    // Cache check
    if (!forceRefresh) {
      const cached = await Brand.findOne({ normalizedName })
      if (cached) {
        const ads = await Ad.find({ brandId: cached._id }).lean().limit(limit)
        if (ads.length > 0) {
          return { empty: false, brand: cached as HydratedDocument<IBrand>, ads, fromCache: true, partial: false }
        }
      }
    }

    const session = await SearchSession.create({ query: brand, status: 'fetching' })

    let scrapeResult
    try {
      scrapeResult = await this.scrapers.scrape(brand, { limit })
    } catch (err) {
      await SearchSession.findByIdAndUpdate(session._id, {
        status: 'error',
        errorMessage: (err as Error).message,
      })
      throw err
    }

    if (scrapeResult.empty) {
      await SearchSession.findByIdAndUpdate(session._id, { status: 'done', adsFound: 0 })
      return { empty: true, brand: null, ads: [], message: 'No ads found for this brand' }
    }

    const brandDoc = await Brand.findOneAndUpdate(
      { normalizedName },
      { name: brand, normalizedName, lastFetched: new Date(), adCount: scrapeResult.ads.length },
      { upsert: true, returnDocument: 'after' }
    )
    if (!brandDoc) throw new Error('Brand upsert returned null')

    // Clear stale data
    const oldRawIds = await RawAd.find({ brandId: brandDoc._id }).distinct('_id')
    await Ad.deleteMany({ brandId: brandDoc._id })
    if (oldRawIds.length) await RawAd.deleteMany({ _id: { $in: oldRawIds } })

    // Save raw + extract UI fields
    const adDocs = await Promise.all(
      scrapeResult.ads.map(async raw => {
        const safeRaw = RawAdDataSchema.safeParse(raw).data ?? raw

        const rawAd = await RawAd.create({
          brandId: brandDoc._id,
          scraper: scrapeResult.scraper,
          rawData: safeRaw,
        })

        const { extractionMethod, ...fields } = await this.extraction.extract(safeRaw)

        return { brandId: brandDoc._id, rawAdId: rawAd._id, extractionMethod, ...fields, performanceData: null }
      })
    )

    const insertedAds = await Ad.insertMany(adDocs)
    const finalBrand = brandDoc as HydratedDocument<IBrand>

    await SearchSession.findByIdAndUpdate(session._id, {
      status: 'done',
      brandId: finalBrand._id,
      adsFound: insertedAds.length,
    })

    return { empty: false, brand: finalBrand, ads: insertedAds, fromCache: false, partial: scrapeResult.partial }
  }
}
