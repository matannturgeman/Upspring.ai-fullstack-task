import { type Request, type Response, type NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import Ad from '../models/Ad.ts'
import { AdsQuerySchema } from '../schemas/ads.schemas.ts'
import type { AdsService } from '../services/AdsService.ts'

export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  getAds = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      let result
      try {
        result = await this.adsService.getAds(brand, limit, forceRefresh ?? false)
      } catch (err) {
        return next(Object.assign(new Error(`Ads provider error: ${(err as Error).message}`), {
          status: StatusCodes.BAD_GATEWAY,
          code: 'PROVIDER_ERROR',
        }))
      }

      res.json(result)
    } catch (err) {
      next(err)
    }
  }

  getAdsByBrand = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
  }
}
