import { type Request, type Response, type NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import Brand from '../models/Brand'
import { CompetitorBodySchema } from '../schemas/analysis.schemas'
import type { CompetitorService } from '../services/CompetitorService'
import { env } from '../config/env'

export class CompetitorsController {
  constructor(private readonly competitorService: CompetitorService) {}

  findCompetitors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = CompetitorBodySchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(StatusCodes.BAD_REQUEST).json({
          error: 'INVALID_INPUT',
          message: parsed.error.issues[0].message,
        })
        return
      }

      const { brandName, brandId } = parsed.data

      const brand = await Brand.findById(brandId).lean()
      if (brand) {
        const cacheAfter = new Date(Date.now() - env.COMPETITOR_CACHE_TTL_MS)
        if (brand.competitorsFetchedAt && brand.competitorsFetchedAt > cacheAfter && brand.competitors.length > 0) {
          res.json({ competitors: brand.competitors, source: 'cache', disclaimer: 'Cached results' })
          return
        }
      }

      const result = await this.competitorService.findCompetitors(brandName, brandId)

      await Brand.findByIdAndUpdate(brandId, {
        competitors: result.competitors,
        competitorsFetchedAt: new Date(),
      })

      const disclaimer =
        result.source === 'perplexity'
          ? 'Identified via web search'
          : result.source === 'claude'
            ? 'Identified by AI reasoning from ad content'
            : 'Mock data (MOCK_LLM=true)'

      res.json({ competitors: result.competitors, source: result.source, disclaimer })
    } catch (err) {
      next(err)
    }
  }
}
