import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import app from '../../server.ts'
import { PerplexityService } from '../../src/services/PerplexityService.ts'
import { ClaudeService } from '../../src/services/ClaudeService.ts'
import Brand from '../../src/models/Brand.ts'

vi.mock('../../src/services/PerplexityService.ts')
vi.mock('../../src/services/ClaudeService.ts')
vi.mock('../../src/utils/mockMode.ts', () => ({ isMockLLM: () => false, isMockScraper: () => false }))

const mockSearchCompetitors = vi.fn()
const mockFindCompetitorsFromAds = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(PerplexityService).mockImplementation(
    () => ({ searchCompetitors: mockSearchCompetitors }) as unknown as PerplexityService,
  )
  vi.mocked(ClaudeService).mockImplementation(
    () =>
      ({
        findCompetitorsFromAds: mockFindCompetitorsFromAds,
        streamChat: vi.fn(),
        streamAnalysis: vi.fn(),
        extractFields: vi.fn().mockResolvedValue(null),
      }) as unknown as ClaudeService,
  )
})

afterEach(async () => {
  await Brand.deleteMany({})
})

const MOCK_COMPETITORS = [
  { name: 'Adidas', reason: 'Direct competitor in athletic footwear' },
  { name: 'Puma', reason: 'Competes in sportswear market' },
]

async function createTestBrand(overrides: Partial<{ competitorsFetchedAt: Date; competitors: typeof MOCK_COMPETITORS }> = {}) {
  return Brand.create({
    name: 'Nike',
    normalizedName: 'nike',
    lastFetched: new Date(),
    adCount: 2,
    competitors: overrides.competitors ?? [],
    ...(overrides.competitorsFetchedAt ? { competitorsFetchedAt: overrides.competitorsFetchedAt } : {}),
  })
}

describe('POST /api/competitors/find', () => {
  it('returns 400 when brandId is missing', async () => {
    const res = await request(app).post('/api/competitors/find').send({ brandName: 'Nike' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('INVALID_INPUT')
  })

  it('returns 400 when brandId is not a valid ObjectId', async () => {
    const res = await request(app)
      .post('/api/competitors/find')
      .send({ brandName: 'Nike', brandId: 'not-an-id' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('INVALID_INPUT')
  })

  it('returns 400 when brandName is missing', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString()
    const res = await request(app)
      .post('/api/competitors/find')
      .send({ brandId: fakeId })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('INVALID_INPUT')
  })

  it('fetches fresh competitors via Perplexity when no cache exists', async () => {
    mockSearchCompetitors.mockResolvedValue(MOCK_COMPETITORS)
    const brand = await createTestBrand()

    const res = await request(app)
      .post('/api/competitors/find')
      .send({ brandName: 'Nike', brandId: brand._id.toString() })

    expect(res.status).toBe(200)
    expect(res.body.competitors).toHaveLength(2)
    expect(res.body.competitors[0].name).toBe('Adidas')
    expect(res.body.source).toBe('perplexity')
    expect(mockSearchCompetitors).toHaveBeenCalledWith('Nike')
  })

  it('returns cached competitors when competitorsFetchedAt is fresh', async () => {
    const brand = await createTestBrand({
      competitors: MOCK_COMPETITORS,
      competitorsFetchedAt: new Date(),
    })

    const res = await request(app)
      .post('/api/competitors/find')
      .send({ brandName: 'Nike', brandId: brand._id.toString() })

    expect(res.status).toBe(200)
    expect(res.body.competitors).toHaveLength(2)
    expect(res.body.source).toBe('cache')
    expect(mockSearchCompetitors).not.toHaveBeenCalled()
  })

  it('re-fetches when cache is stale', async () => {
    mockSearchCompetitors.mockResolvedValue(MOCK_COMPETITORS)
    const staleDate = new Date(Date.now() - 1_000_000) // well beyond any TTL
    const brand = await createTestBrand({
      competitors: [{ name: 'OldCompetitor', reason: 'Stale' }],
      competitorsFetchedAt: staleDate,
    })

    const res = await request(app)
      .post('/api/competitors/find')
      .send({ brandName: 'Nike', brandId: brand._id.toString() })

    expect(res.status).toBe(200)
    expect(res.body.source).toBe('perplexity')
    expect(mockSearchCompetitors).toHaveBeenCalledOnce()
  })

  it('re-fetches when cache is fresh but competitors array is empty', async () => {
    mockSearchCompetitors.mockResolvedValue(MOCK_COMPETITORS)
    const brand = await createTestBrand({
      competitors: [],
      competitorsFetchedAt: new Date(),
    })

    const res = await request(app)
      .post('/api/competitors/find')
      .send({ brandName: 'Nike', brandId: brand._id.toString() })

    expect(res.status).toBe(200)
    expect(res.body.source).toBe('perplexity')
    expect(mockSearchCompetitors).toHaveBeenCalledOnce()
  })

  it('persists competitors and competitorsFetchedAt after fresh fetch', async () => {
    mockSearchCompetitors.mockResolvedValue(MOCK_COMPETITORS)
    const brand = await createTestBrand()

    await request(app)
      .post('/api/competitors/find')
      .send({ brandName: 'Nike', brandId: brand._id.toString() })

    const updated = await Brand.findById(brand._id).lean()
    expect(updated!.competitors).toHaveLength(2)
    expect(updated!.competitorsFetchedAt).toBeTruthy()
    expect(updated!.competitorsFetchedAt!.getTime()).toBeGreaterThan(Date.now() - 5000)
  })

  it('falls back to Claude when Perplexity fails', async () => {
    mockSearchCompetitors.mockRejectedValue(new Error('Perplexity unavailable'))
    mockFindCompetitorsFromAds.mockResolvedValue(MOCK_COMPETITORS)
    const brand = await createTestBrand()

    const res = await request(app)
      .post('/api/competitors/find')
      .send({ brandName: 'Nike', brandId: brand._id.toString() })

    expect(res.status).toBe(200)
    expect(res.body.source).toBe('claude')
    expect(res.body.competitors).toHaveLength(2)
  })
})
