import { type Request, type Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import Ad from '../models/Ad.ts'
import { AnalysisBodySchema } from '../schemas/analysis.schemas.ts'
import { AnalysisSseChunkSchema } from '../schemas/llm.schemas.ts'
import type { ClaudeService } from '../services/ClaudeService.ts'

export class AnalysisController {
  constructor(private readonly claude: ClaudeService) {}

  streamAnalysis = async (req: Request, res: Response): Promise<void> => {
    const parsed = AnalysisBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: 'INVALID_INPUT',
        message: parsed.error.issues[0].message,
      })
      return
    }

    const ad = await Ad.findById(parsed.data.adId).lean()
    if (!ad) {
      res.status(StatusCodes.NOT_FOUND).json({ error: 'AD_NOT_FOUND', message: 'Ad not found' })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    const writeChunk = (payload: unknown) => {
      const validated = AnalysisSseChunkSchema.parse(payload)
      res.write(`data: ${JSON.stringify(validated)}\n\n`)
    }

    try {
      for await (const chunk of this.claude.streamAnalysis(ad)) {
        writeChunk({ text: chunk })
      }
      res.write('data: [DONE]\n\n')
    } catch (err) {
      console.error('Analysis stream error:', err)
      writeChunk({ error: 'PROVIDER_ERROR' })
      res.write('data: [DONE]\n\n')
    } finally {
      res.end()
    }
  }
}
