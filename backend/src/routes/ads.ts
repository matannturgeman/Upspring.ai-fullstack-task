import { Router, type Request, type Response, type NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { type HydratedDocument } from 'mongoose'
import Brand, { type IBrand } from '../models/Brand.ts'
import Ad from '../models/Ad.ts'
import SearchSession from '../models/SearchSession.ts'
import { scrapeMetaAds } from '../services/apifyService.ts'
import { parseApifyAd } from '../utils/apifyParser.ts'
import { AdsQuerySchema } from '../schemas/ads.schemas.ts'

const router = Router()

// GET /api/ads?brand=Nike&limit=20&forceRefresh=false
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = AdsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      const missing = parsed.error.issues.some(i => i.path.includes('brand'))
      res.status(StatusCodes.BAD_REQUEST).json({
        error: true,
        message: missing ? 'brand query param required' : parsed.error.issues[0].message,
        code: missing ? 'MISSING_BRAND' : 'INVALID_INPUT',
      })
      return
    }

    const { brand, limit, forceRefresh } = parsed.data
    const normalizedName = brand.toLowerCase()

    // Cache check — apply same limit as request
    if (!forceRefresh) {
      const cached = await Brand.findOne({ normalizedName })
      if (cached) {
        const ads = await Ad.find({ brandId: cached._id }).lean().limit(limit)
        if (ads.length > 0) {
          res.json({ brand: cached, ads, fromCache: true, empty: false })
          return
        }
      }
    }

    const session = await SearchSession.create({ query: brand, status: 'fetching' })

    let scrapeResult
    try {
      scrapeResult = await scrapeMetaAds(brand, { limit })
    } catch (err) {
      await SearchSession.findByIdAndUpdate(session._id, {
        status: 'error',
        errorMessage: (err as Error).message,
      })
      return next(Object.assign(new Error(`Ads provider error: ${(err as Error).message}`), {
        status: StatusCodes.BAD_GATEWAY,
        code: 'PROVIDER_ERROR',
      }))
    }

    if (scrapeResult.empty) {
      await SearchSession.findByIdAndUpdate(session._id, { status: 'done', adsFound: 0 })
      res.json({ brand: null, ads: [], empty: true, message: 'No ads found for this brand' })
      return
    }

    const brandDoc = await Brand.findOneAndUpdate(
      { normalizedName },
      { name: brand, normalizedName, lastFetched: new Date(), adCount: scrapeResult.ads.length },
      { upsert: true, returnDocument: 'after' }
    )
    if (!brandDoc) throw new Error('Brand upsert returned null')

    await Ad.deleteMany({ brandId: brandDoc._id })

    const adDocs = scrapeResult.ads.map(raw => ({ ...parseApifyAd(raw), brandId: brandDoc._id }))
    const insertedAds = await Ad.insertMany(adDocs)

    const finalBrand = brandDoc as HydratedDocument<IBrand>

    await SearchSession.findByIdAndUpdate(session._id, {
      status: 'done',
      brandId: finalBrand._id,
      adsFound: insertedAds.length,
    })

    res.json({ brand: finalBrand, ads: insertedAds, fromCache: false, partial: scrapeResult.partial, empty: false })
  } catch (err) {
    next(err)
  }
})

// GET /api/ads/:brandId
router.get('/:brandId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ads = await Ad.find({ brandId: req.params.brandId }).lean()
    if (!ads.length) {
      res.status(StatusCodes.NOT_FOUND).json({ error: true, message: 'No ads found', code: 'NOT_FOUND' })
      return
    }
    res.json({ ads })
  } catch (err) {
    next(err)
  }
})

export default router
