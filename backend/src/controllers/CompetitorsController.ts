import { type Request, type Response, type NextFunction } from 'express'
import Brand from '../models/Brand.ts'
import type { CompetitorService } from '../services/CompetitorService.ts'

export class CompetitorsController {
  constructor(private readonly competitorService: CompetitorService) {}

  findCompetitors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { brandName, brandId } = req.body as { brandName?: unknown; brandId?: unknown }

      if (!brandName || typeof brandName !== 'string' || !brandId || typeof brandId !== 'string') {
        res.status(400).json({ error: true, message: 'brandName and brandId required', code: 'MISSING_PARAMS' })
        return
      }

      const result = await this.competitorService.findCompetitors(brandName.trim(), brandId.trim())

      await Brand.findByIdAndUpdate(brandId, { competitors: result.competitors })

      const disclaimer =
        result.source === 'perplexity' ? 'Identified via web search' :
        result.source === 'claude'     ? 'Identified by AI reasoning from ad content' :
                                         'Mock data (MOCK_LLM=true)'

      res.json({ competitors: result.competitors, source: result.source, disclaimer })
    } catch (err) {
      next(err)
    }
  }
}
