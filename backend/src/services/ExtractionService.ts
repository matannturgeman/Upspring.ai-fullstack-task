import { codeExtract } from './extraction/codeExtractor.ts'
import {
  ExtractionSchema,
  extractionScore,
  type ExtractionResult,
} from '../schemas/extraction.schemas.ts'
import { isMockLLM } from '../utils/mockMode.ts'
import type { ClaudeService } from './ClaudeService.ts'

export type ExtractionOutput = ExtractionResult & { extractionMethod: 'code' | 'ai' }

const AI_FALLBACK_THRESHOLD = 2

export class ExtractionService {
  constructor(private readonly claude: ClaudeService) {}

  async extract(rawData: unknown): Promise<ExtractionOutput> {
    // 1. Code extraction — fast, free, deterministic
    const codeResult = codeExtract(rawData)

    if (codeResult && extractionScore(codeResult) >= AI_FALLBACK_THRESHOLD) {
      return { ...codeResult, extractionMethod: 'code' }
    }

    // 2. AI fallback
    if (!isMockLLM()) {
      const raw = await this.claude.extractFields(rawData)
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
