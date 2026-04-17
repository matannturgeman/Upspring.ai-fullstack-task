import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CompetitorService } from '../../src/services/CompetitorService.ts'
import type { PerplexityService } from '../../src/services/PerplexityService.ts'
import type { ClaudeService } from '../../src/services/ClaudeService.ts'

vi.mock('../../src/utils/mockMode.ts', () => ({ isMockLLM: () => false }))
vi.mock('../../src/models/Ad.ts', () => ({
  default: { find: vi.fn().mockReturnValue({ lean: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) },
}))

const MOCK_COMPETITORS = [
  { name: 'Adidas', reason: 'Direct competitor in athletic footwear' },
  { name: 'Puma', reason: 'Competes in sportswear market' },
]

function makeService(perplexityOverrides = {}, claudeOverrides = {}) {
  const perplexity = {
    searchCompetitors: vi.fn().mockResolvedValue(MOCK_COMPETITORS),
    ...perplexityOverrides,
  } as unknown as PerplexityService

  const claude = {
    findCompetitorsFromAds: vi.fn().mockResolvedValue(MOCK_COMPETITORS),
    ...claudeOverrides,
  } as unknown as ClaudeService

  return { service: new CompetitorService(perplexity, claude), perplexity, claude }
}

describe('CompetitorService.findCompetitors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns competitors from Perplexity when available', async () => {
    const { service } = makeService()
    const result = await service.findCompetitors('Nike', 'brand123')
    expect(result.source).toBe('perplexity')
    expect(result.competitors).toEqual(MOCK_COMPETITORS)
  })

  it('falls back to Claude when Perplexity throws', async () => {
    const { service } = makeService({
      searchCompetitors: vi.fn().mockRejectedValue(new Error('Perplexity unavailable')),
    })
    const result = await service.findCompetitors('Nike', 'brand123')
    expect(result.source).toBe('claude')
    expect(result.competitors).toEqual(MOCK_COMPETITORS)
  })

  it('falls back to Claude when Perplexity returns empty array', async () => {
    const { service } = makeService({
      searchCompetitors: vi.fn().mockResolvedValue([]),
    })
    const result = await service.findCompetitors('Nike', 'brand123')
    expect(result.source).toBe('claude')
  })

  it('calls Claude with brand name and ad context', async () => {
    const { service, claude } = makeService({
      searchCompetitors: vi.fn().mockRejectedValue(new Error('fail')),
    })
    await service.findCompetitors('Nike', 'brand123')
    expect(claude.findCompetitorsFromAds).toHaveBeenCalledWith('Nike', expect.any(String))
  })
})
