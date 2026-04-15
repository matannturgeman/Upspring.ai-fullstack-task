import { Router } from 'express'
import Ad from '../models/Ad.ts'
import { streamAnalysis } from '../services/claudeService.ts'
import { AnalysisBodySchema } from '../schemas/analysis.schemas.ts'
import { AnalysisSseChunkSchema } from '../schemas/llm.schemas.ts'

const router = Router()

router.post('/', async (req, res) => {
  const parsed = AnalysisBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'INVALID_INPUT', message: parsed.error.issues[0].message })
    return
  }

  const ad = await Ad.findById(parsed.data.adId).lean()
  if (!ad) {
    res.status(404).json({ error: 'AD_NOT_FOUND', message: 'Ad not found' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  function writeChunk(payload: unknown) {
    const validated = AnalysisSseChunkSchema.parse(payload)
    res.write(`data: ${JSON.stringify(validated)}\n\n`)
  }

  try {
    for await (const chunk of streamAnalysis(ad)) {
      writeChunk({ text: chunk })
    }
    res.write('data: [DONE]\n\n')
  } catch {
    writeChunk({ error: 'PROVIDER_ERROR' })
  } finally {
    res.end()
  }
})

export default router
