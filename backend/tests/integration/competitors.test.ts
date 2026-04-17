import { describe, it, expect, afterEach } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import app from '../../server.ts'
import Brand from '../../src/models/Brand.ts'

// Integration tests run with MOCK_LLM=true (test env default).
// We test HTTP validation, cache hit/miss logic, and DB persistence.
// CompetitorService unit tests cover the Perplexity → Claude fallback.

afterEach(async () => {
  await Brand.deleteMany({})
})

const CACHED_COMPETITORS = [
  { name: 'Adidas', reason: 'Direct competitor in athletic footwear' },
  { name: 'Puma', reason: 'Competes in sportswear market' },
]

async function createBrand(
  overrides: Partial<{ competitorsFetchedAt: Date; competitors: typeof CACHED_COMPETITORS }> = {},
) {
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
    const res = await request(app).post('/api/competitors/find').send({ brandId: fakeId })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('INVALID_INPUT')
  })

  it('fetches fresh competitors when no cache exists', async () => {
    const brand = await createBrand()

    const res = await request(app)
      .post('/api/competitors/find')
      .send({ brandName: 'Nike', brandId: brand._id.toString() })

    expect(res.status).toBe(200)
    expect(res.body.competitors.length).toBeGreaterThan(0)
    expect(res.body.source).not.toBe('cache')
  })

  it('returns cached competitors when competitorsFetchedAt is fresh', async () => {
    const brand = await createBrand({
      competitors: CACHED_COMPETITORS,
      competitorsFetchedAt: new Date(),
    })

    const res = await request(app)
      .post('/api/competitors/find')
      .send({ brandName: 'Nike', brandId: brand._id.toString() })

    expect(res.status).toBe(200)
    expect(res.body.source).toBe('cache')
    expect(res.body.competitors).toHaveLength(2)
    expect(res.body.competitors[0].name).toBe('Adidas')
  })

  it('re-fetches when cache is stale', async () => {
    const staleDate = new Date(Date.now() - 1_000_000)
    const brand = await createBrand({
      competitors: [{ name: 'OldCompetitor', reason: 'Stale' }],
      competitorsFetchedAt: staleDate,
    })

    const res = await request(app)
      .post('/api/competitors/find')
      .send({ brandName: 'Nike', brandId: brand._id.toString() })

    expect(res.status).toBe(200)
    expect(res.body.source).not.toBe('cache')
  })

  it('re-fetches when timestamp is fresh but competitors array is empty', async () => {
    const brand = await createBrand({
      competitors: [],
      competitorsFetchedAt: new Date(),
    })

    const res = await request(app)
      .post('/api/competitors/find')
      .send({ brandName: 'Nike', brandId: brand._id.toString() })

    expect(res.status).toBe(200)
    expect(res.body.source).not.toBe('cache')
  })

  it('persists competitors and competitorsFetchedAt after fresh fetch', async () => {
    const brand = await createBrand()

    await request(app)
      .post('/api/competitors/find')
      .send({ brandName: 'Nike', brandId: brand._id.toString() })

    const updated = await Brand.findById(brand._id).lean()
    expect(updated!.competitors.length).toBeGreaterThan(0)
    expect(updated!.competitorsFetchedAt).toBeTruthy()
    expect(updated!.competitorsFetchedAt!.getTime()).toBeGreaterThan(Date.now() - 5000)
  })

  it('does not update competitorsFetchedAt when returning from cache', async () => {
    const originalDate = new Date(Date.now() - 60_000) // 1 min ago
    const brand = await createBrand({
      competitors: CACHED_COMPETITORS,
      competitorsFetchedAt: originalDate,
    })

    await request(app)
      .post('/api/competitors/find')
      .send({ brandName: 'Nike', brandId: brand._id.toString() })

    const updated = await Brand.findById(brand._id).lean()
    // competitorsFetchedAt should NOT be updated — cache was returned as-is
    expect(updated!.competitorsFetchedAt!.getTime()).toBe(originalDate.getTime())
  })
})
