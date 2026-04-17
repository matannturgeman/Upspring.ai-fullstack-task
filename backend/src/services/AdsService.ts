import { type HydratedDocument } from 'mongoose'
import Brand, { type IBrand } from '../models/Brand.ts'
import Ad from '../models/Ad.ts'
import RawAd from '../models/RawAd.ts'
import SearchSession from '../models/SearchSession.ts'
import { RawAdDataSchema } from '../schemas/rawAd.schemas.ts'
import type { ScraperRegistry } from '../scrapers/ScraperRegistry.ts'
import type { ExtractionService } from './ExtractionService.ts'
import { env } from '../config/env.ts'

export type AdsResult =
  | { empty: true; brand: null; ads: []; message: string }
  | {
      empty: false
      brand: HydratedDocument<IBrand>
      ads: unknown[]
      fromCache: boolean
      partial: boolean
    }

export class AdsService {
  constructor(
    private readonly scrapers: ScraperRegistry,
    private readonly extraction: ExtractionService,
  ) {}

  async getAds(brand: string, limit: number, forceRefresh: boolean): Promise<AdsResult> {
    const normalizedName = brand.toLowerCase()

    // Cache check — only serve brands fetched within BRAND_CACHE_TTL_MS
    if (!forceRefresh) {
      const cacheAfter = new Date(Date.now() - env.BRAND_CACHE_TTL_MS)
      const cached = await Brand.findOne({ normalizedName, lastFetched: { $gt: cacheAfter } })
      if (cached) {
        const ads = await Ad.find({ brandId: cached._id }).lean().limit(limit)
        if (ads.length > 0) {
          return {
            empty: false,
            brand: cached as HydratedDocument<IBrand>,
            ads,
            fromCache: true,
            partial: false,
          }
        }
      }
    }

    const session = await SearchSession.create({ query: brand, status: 'fetching' })

    const scrapeResult = await this.scrapers.scrape(brand, { limit }).catch(async (err: Error) => {
      await SearchSession.findByIdAndUpdate(session._id, {
        status: 'error',
        errorMessage: err.message,
      })
      throw err
    })

    if (scrapeResult.empty) {
      await SearchSession.findByIdAndUpdate(session._id, { status: 'done', adsFound: 0 })
      return { empty: true, brand: null, ads: [], message: 'No ads found for this brand' }
    }

    const brandDoc = await Brand.findOneAndUpdate(
      { normalizedName },
      { name: brand, normalizedName, lastFetched: new Date(), adCount: scrapeResult.ads.length },
      { upsert: true, returnDocument: 'after' },
    )
    if (!brandDoc) throw new Error('Brand upsert returned null')

    // Save raw + extract UI fields — allSettled so one bad ad doesn't lose the rest
    const settled = await Promise.allSettled(
      scrapeResult.ads.map(async (raw) => {
        const safeRaw = RawAdDataSchema.safeParse(raw).data ?? raw

        const rawAd = await RawAd.create({
          brandId: brandDoc._id,
          scraper: scrapeResult.scraper,
          rawData: safeRaw,
        })

        const { extractionMethod, ...fields } = await this.extraction.extract(safeRaw)

        return {
          brandId: brandDoc._id,
          rawAdId: rawAd._id,
          extractionMethod,
          ...fields,
          performanceData: null,
        }
      }),
    )

    const adDocs = settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
    const failCount = settled.length - adDocs.length
    if (failCount > 0)
      console.warn(`[AdsService] ${failCount}/${settled.length} ad extractions failed`)
    if (adDocs.length === 0) throw new Error('All ad extractions failed')

    // Insert new data first, then clear stale — so a failed insert never leaves zero ads
    const insertedAds = await Ad.insertMany(adDocs)

    const oldRawIds = await RawAd.find({
      brandId: brandDoc._id,
      _id: { $nin: insertedAds.map((a) => a.rawAdId) },
    }).distinct('_id')
    await Ad.deleteMany({ brandId: brandDoc._id, _id: { $nin: insertedAds.map((a) => a._id) } })
    if (oldRawIds.length) await RawAd.deleteMany({ _id: { $in: oldRawIds } })
    const finalBrand = brandDoc as HydratedDocument<IBrand>

    await SearchSession.findByIdAndUpdate(session._id, {
      status: 'done',
      brandId: finalBrand._id,
      adsFound: insertedAds.length,
    })

    return {
      empty: false,
      brand: finalBrand,
      ads: insertedAds,
      fromCache: false,
      partial: scrapeResult.partial,
    }
  }
}
