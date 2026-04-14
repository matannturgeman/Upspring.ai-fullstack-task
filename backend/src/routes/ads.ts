import { Router, type Request, type Response, type NextFunction } from 'express'
import Brand from '../models/Brand.ts'
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
      res.status(400).json({
        error: true,
        message: missing ? 'brand query param required' : parsed.error.issues[0].message,
        code: missing ? 'MISSING_BRAND' : 'INVALID_INPUT',
      })
      return
    }

    const { brand, limit, forceRefresh } = parsed.data
    const normalizedName = brand.toLowerCase()

    // Cache check
    if (!forceRefresh) {
      const cached = await Brand.findOne({ normalizedName })
      if (cached) {
        const ads = await Ad.find({ brandId: cached._id }).lean()
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
      const error = Object.assign(new Error(`Ads provider error: ${(err as Error).message}`), {
        status: 502,
        code: 'PROVIDER_ERROR',
      })
      return next(error)
    }

    if (scrapeResult.empty) {
      await SearchSession.findByIdAndUpdate(session._id, { status: 'done', adsFound: 0 })
      res.json({ brand: null, ads: [], empty: true, message: `No ads found for "${brand}"` })
      return
    }

    const brandDoc = await Brand.findOneAndUpdate(
      { normalizedName },
      { name: brand, normalizedName, lastFetched: new Date(), adCount: scrapeResult.ads.length },
      { upsert: true, returnDocument: 'after' }
    )

    await Ad.deleteMany({ brandId: brandDoc!._id })

    const adDocs = scrapeResult.ads.map(raw => ({
      ...parseApifyAd(raw),
      brandId: brandDoc!._id,
    }))
    const ads = await Ad.insertMany(adDocs)

    await SearchSession.findByIdAndUpdate(session._id, {
      status: 'done',
      brandId: brandDoc!._id,
      adsFound: ads.length,
    })

    res.json({ brand: brandDoc, ads, fromCache: false, partial: scrapeResult.partial, empty: false })
  } catch (err) {
    next(err)
  }
})

// GET /api/ads/:brandId
router.get('/:brandId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ads = await Ad.find({ brandId: req.params.brandId }).lean()
    if (!ads.length) {
      res.status(404).json({ error: true, message: 'No ads found', code: 'NOT_FOUND' })
      return
    }
    res.json({ ads })
  } catch (err) {
    next(err)
  }
})

export default router
