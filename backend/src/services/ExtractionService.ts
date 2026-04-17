import { codeExtract } from './extraction/codeExtractor'
import {
  ExtractionSchema,
  extractionScore,
  type ExtractionResult,
} from '../schemas/extraction.schemas'
import { isMockLLM } from '../utils/mockMode'
import type { ILLMAnalyser } from './ClaudeService'

export type ExtractionOutput = ExtractionResult & { extractionMethod: 'code' | 'ai' }

const AI_FALLBACK_THRESHOLD = 2

export class ExtractionService {
  constructor(private readonly llmAnalyser: ILLMAnalyser) {}

  async extract(rawData: unknown): Promise<ExtractionOutput> {
    // 1. Code extraction — fast, free, deterministic
    const codeResult = codeExtract(rawData)

    if (codeResult && extractionScore(codeResult) >= AI_FALLBACK_THRESHOLD) {
      return { ...codeResult, extractionMethod: 'code' }
    }

    // 2. AI fallback
    if (!isMockLLM()) {
      const raw = await this.llmAnalyser.extractFields(rawData)
      if (raw) {
        if (typeof raw.startDate === 'string' && raw.startDate) {
          raw.startDate = new Date(raw.startDate as string)
        }
        const result = ExtractionSchema.safeParse(raw)
        if (result.success && extractionScore(result.data) >= 1) {
          return { ...result.data, extractionMethod: 'ai' }
        }
      }
    }

    // 3. Best-effort: return whatever code extracted (may be sparse)
    return { ...(codeResult ?? ExtractionSchema.parse({})), extractionMethod: 'code' }
  }
}
