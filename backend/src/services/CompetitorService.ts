import { mockFindCompetitors } from '../mocks/perplexityMock.ts'
import { isMockLLM } from '../utils/mockMode.ts'
import Ad from '../models/Ad.ts'
import type { PerplexityService } from './PerplexityService.ts'
import type { ClaudeService } from './ClaudeService.ts'

export type CompetitorResult = {
  competitors: { name: string; reason: string }[]
  source: 'perplexity' | 'claude' | 'mock'
}

export class CompetitorService {
  constructor(
    private readonly perplexity: PerplexityService,
    private readonly claude: ClaudeService,
  ) {}

  async findCompetitors(brandName: string, brandId: string): Promise<CompetitorResult> {
    if (isMockLLM()) {
      return { competitors: await mockFindCompetitors(brandName), source: 'mock' }
    }

    // Strategy 1: Perplexity web search
    try {
      const competitors = await this.perplexity.searchCompetitors(brandName)
      if (competitors.length > 0) return { competitors, source: 'perplexity' }
    } catch (err) {
      console.warn('Perplexity failed, falling back to Claude:', (err as Error).message)
    }

    // Strategy 2: Claude reasoning from stored ad content
    const ads = await Ad.find({ brandId }).lean().limit(10)
    const adContext = ads
      .map((a) => `${a.headline ?? ''} ${a.primaryText ?? ''}`.trim())
      .filter(Boolean)
      .join('\n')
      .slice(0, 2000)

    const competitors = await this.claude.findCompetitorsFromAds(brandName, adContext)
    return { competitors, source: 'claude' }
  }
}
