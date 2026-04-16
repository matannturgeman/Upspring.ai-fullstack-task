import { Router } from 'express'
import { findCompetitors } from '../services/competitorService.ts'
import Brand from '../models/Brand.ts'

const router = Router()

// POST /api/competitors/find
router.post('/find', async (req, res, next) => {
  try {
    const { brandName, brandId } = req.body as { brandName?: unknown; brandId?: unknown }

    if (!brandName || typeof brandName !== 'string' || !brandId || typeof brandId !== 'string') {
      return res.status(400).json({ error: true, message: 'brandName and brandId required', code: 'MISSING_PARAMS' })
    }

    const result = await findCompetitors(brandName.trim(), brandId.trim())

    await Brand.findByIdAndUpdate(brandId, { competitors: result.competitors })

    const disclaimer =
      result.source === 'perplexity' ? 'Identified via web search' :
      result.source === 'claude'     ? 'Identified by AI reasoning from ad content' :
                                       'Mock data (MOCK_LLM=true)'

    res.json({ competitors: result.competitors, source: result.source, disclaimer })
  } catch (err) {
    next(err)
  }
})

export default router
