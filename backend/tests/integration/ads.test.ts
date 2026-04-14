import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../server.ts'
import * as apifyService from '../../src/services/apifyService.ts'

vi.mock('../../src/services/apifyService.ts')

const mockAd = {
  id: '1',
  publisher_platforms: ['FACEBOOK'],
  is_active: true,
  start_date: 1700000000,
  snapshot: {
    title: 'Test Ad',
    body: { text: 'Hello world' },
    images: [{ url: 'https://img.com/a.jpg' }],
    videos: [],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/ads', () => {
  it('returns 400 when brand param missing', async () => {
    const res = await request(app).get('/api/ads')
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('MISSING_BRAND')
  })

  it('returns ads for a valid brand', async () => {
    vi.mocked(apifyService.scrapeMetaAds).mockResolvedValue({
      ads: [mockAd],
      partial: false,
      empty: false,
    })
    const res = await request(app).get('/api/ads?brand=TestBrand')
    expect(res.status).toBe(200)
    expect(res.body.ads.length).toBe(1)
    expect(res.body.ads[0].headline).toBe('Test Ad')
    expect(res.body.fromCache).toBe(false)
  })

  it('returns empty state when no ads found', async () => {
    vi.mocked(apifyService.scrapeMetaAds).mockResolvedValue({ ads: [], partial: false, empty: true })
    const res = await request(app).get('/api/ads?brand=UnknownBrand99999')
    expect(res.status).toBe(200)
    expect(res.body.empty).toBe(true)
    expect(res.body.ads).toEqual([])
  })

  it('returns 502 when Apify throws', async () => {
    vi.mocked(apifyService.scrapeMetaAds).mockRejectedValue(new Error('Apify unreachable'))
    const res = await request(app).get('/api/ads?brand=AnyBrand')
    expect(res.status).toBe(502)
    expect(res.body.code).toBe('PROVIDER_ERROR')
  })

  it('marks partial: true when fewer ads than limit returned', async () => {
    vi.mocked(apifyService.scrapeMetaAds).mockResolvedValue({ ads: [mockAd], partial: true, empty: false })
    const res = await request(app).get('/api/ads?brand=PartialBrand&limit=20')
    expect(res.status).toBe(200)
    expect(res.body.partial).toBe(true)
  })
})

describe('GET /api/proxy/image', () => {
  it('returns 400 when url param missing', async () => {
    const res = await request(app).get('/api/proxy/image')
    expect(res.status).toBe(400)
  })
})
