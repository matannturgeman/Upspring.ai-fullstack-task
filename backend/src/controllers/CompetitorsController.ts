import { type Request, type Response, type NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import Brand from '../models/Brand.ts'
import { CompetitorBodySchema } from '../schemas/analysis.schemas.ts'
import type { CompetitorService } from '../services/CompetitorService.ts'

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
      const result = await this.competitorService.findCompetitors(brandName, brandId)

      await Brand.findByIdAndUpdate(brandId, { competitors: result.competitors })

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
