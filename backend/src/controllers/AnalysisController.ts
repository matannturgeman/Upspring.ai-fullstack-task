import { type Request, type Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import Ad from '../models/Ad'
import Brand from '../models/Brand'
import { AnalysisBodySchema, ChatBodySchema } from '../schemas/analysis.schemas'
import { AnalysisSseChunkSchema } from '../schemas/llm.schemas'
import type { ClaudeService } from '../services/ClaudeService'
import type { GeminiService } from '../services/GeminiService'

type StreamingResponse = Response & {
  flushHeaders(): void
  setHeader(name: string, value: string): void
  write(chunk: string | Uint8Array): void
  end(): void
}

export class AnalysisController {
  constructor(
    private readonly claude: ClaudeService,
    private readonly gemini: GeminiService,
  ) {}

  private async streamToSSE(
    res: Response,
    generator: AsyncGenerator<string>,
    label: string,
  ): Promise<void> {
    const stream = res as StreamingResponse

    stream.setHeader('Content-Type', 'text/event-stream')
    stream.setHeader('Cache-Control', 'no-cache')
    stream.setHeader('Connection', 'keep-alive')
    stream.flushHeaders()

    const write = (payload: unknown) => {
      stream.write(`data: ${JSON.stringify(AnalysisSseChunkSchema.parse(payload))}\n\n`)
    }

    try {
      for await (const chunk of generator) {
        write({ text: chunk })
      }
      stream.write('data: [DONE]\n\n')
    } catch (err) {
      console.error(`[${label}] stream error:`, err)
      write({ error: 'PROVIDER_ERROR' })
      stream.write('data: [DONE]\n\n')
    } finally {
      stream.end()
    }
  }

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

    const generator = ad.videoUrl ? this.gemini.streamAnalysis(ad) : this.claude.streamAnalysis(ad)
    await this.streamToSSE(res, generator, 'streamAnalysis')
  }

  streamChat = async (req: Request, res: Response): Promise<void> => {
    const parsed = ChatBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: 'INVALID_INPUT',
        message: parsed.error.issues[0].message,
      })
      return
    }

    const { brandId, messages } = parsed.data
    const [brand, ads] = await Promise.all([
      Brand.findById(brandId).lean(),
      Ad.find({ brandId }).limit(20).lean(),
    ])

    if (!brand) {
      res
        .status(StatusCodes.NOT_FOUND)
        .json({ error: 'BRAND_NOT_FOUND', message: 'Brand not found' })
      return
    }

    await this.streamToSSE(res, this.claude.streamChat(brand.name, ads, messages), 'streamChat')
  }
}
