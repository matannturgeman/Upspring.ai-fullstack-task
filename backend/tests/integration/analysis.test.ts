import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Buffer } from 'buffer'
import request from 'supertest'
import Brand from '../../src/models/Brand'
import Ad from '../../src/models/Ad'

const { mockStreamChat, mockStreamAnalysis, mockGeminiStreamAnalysis } = vi.hoisted(() => ({
  mockStreamChat: vi.fn(),
  mockStreamAnalysis: vi.fn(),
  mockGeminiStreamAnalysis: vi.fn(),
}))

vi.mock('../../src/services/ClaudeService', () => ({
  ClaudeService: class {
    streamChat = mockStreamChat
    streamAnalysis = mockStreamAnalysis
    extractFields = vi.fn().mockResolvedValue(null)
    findCompetitorsFromAds = vi.fn().mockResolvedValue([])
  },
}))

vi.mock('../../src/services/GeminiService', () => ({
  GeminiService: class {
    streamAnalysis = mockGeminiStreamAnalysis
  },
}))

import app from '../../server'

type StreamLike = {
  on(event: string, listener: (...args: any[]) => void): void
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  await Brand.deleteMany({})
  await Ad.deleteMany({})
})

async function createTestBrand(name = `Nike-${Math.random().toString(36).slice(2, 8)}`) {
  const brand = await Brand.create({
    name,
    normalizedName: name.toLowerCase(),
    lastFetched: new Date(),
    adCount: 2,
    competitors: [],
  })
  return brand
}

async function createTestAd(brandId: unknown) {
  return Ad.create({
    brandId,
    rawAdId: '507f1f77bcf86cd799439012',
    extractionMethod: 'code',
    platform: 'Facebook',
    headline: 'Just Do It',
    primaryText: 'Shop the new collection.',
    status: 'ACTIVE',
  })
}

describe('POST /api/analysis/chat', () => {
  const VALID_MESSAGES = [{ role: 'user', content: 'What messaging angles are used most?' }]

  it('returns 400 when brandId is missing', async () => {
    const res = await request(app).post('/api/analysis/chat').send({ messages: VALID_MESSAGES })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('INVALID_INPUT')
  })

  it('returns 400 when brandId is not a valid ObjectId', async () => {
    const res = await request(app)
      .post('/api/analysis/chat')
      .send({ brandId: 'not-an-id', messages: VALID_MESSAGES })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('INVALID_INPUT')
  })

  it('returns 400 when messages array is empty', async () => {
    const brand = await createTestBrand()
    const res = await request(app)
      .post('/api/analysis/chat')
      .send({ brandId: brand._id.toString(), messages: [] })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('INVALID_INPUT')
  })

  it('returns 404 when brand does not exist', async () => {
    const fakeId = '507f1f77bcf86cd799439011'
    const res = await request(app)
      .post('/api/analysis/chat')
      .send({ brandId: fakeId, messages: VALID_MESSAGES })

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('BRAND_NOT_FOUND')
  })

  it('streams SSE text chunks for a valid brand', async () => {
    mockStreamChat.mockImplementation(async function* () {
      yield 'Urgency '
      yield 'messaging '
      yield 'dominates.'
    })

    const brand = await createTestBrand()
    await createTestAd(brand._id)

    const res = await request(app)
      .post('/api/analysis/chat')
      .send({ brandId: brand._id.toString(), messages: VALID_MESSAGES })
      .buffer(true)
      .parse((res, cb) => {
        let data = ''
        const stream = res as unknown as StreamLike
        stream.on('data', (chunk: Uint8Array) => {
          data += Buffer.from(chunk).toString()
        })
        stream.on('end', () => cb(null, data))
      })

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/event-stream/)

    const body = res.body as string
    expect(body).toContain('data: {"text":"Urgency "}')
    expect(body).toContain('data: [DONE]')
  })

  it('calls streamChat with brand name and fetched ads', async () => {
    mockStreamChat.mockImplementation(async function* () {
      yield 'ok'
    })

    const brand = await createTestBrand('Adidas')
    await createTestAd(brand._id)

    await request(app)
      .post('/api/analysis/chat')
      .send({ brandId: brand._id.toString(), messages: VALID_MESSAGES })
      .buffer(true)
      .parse((res, cb) => {
        let d = ''
        const stream = res as unknown as StreamLike
        stream.on('data', (c: Uint8Array) => {
          d += Buffer.from(c).toString()
        })
        stream.on('end', () => cb(null, d))
      })

    expect(mockStreamChat).toHaveBeenCalledWith(
      'Adidas',
      expect.arrayContaining([expect.objectContaining({ headline: 'Just Do It' })]),
      VALID_MESSAGES,
    )
  })

  it('streams error chunk when streamChat throws', async () => {
    mockStreamChat.mockImplementation(async function* () {
      throw new Error('Claude unavailable')
      yield ''
    })

    const brand = await createTestBrand()

    const res = await request(app)
      .post('/api/analysis/chat')
      .send({ brandId: brand._id.toString(), messages: VALID_MESSAGES })
      .buffer(true)
      .parse((res, cb) => {
        let d = ''
        const stream = res as unknown as StreamLike
        stream.on('data', (c: Uint8Array) => {
          d += Buffer.from(c).toString()
        })
        stream.on('end', () => cb(null, d))
      })

    expect(res.body as string).toContain('PROVIDER_ERROR')
    expect(res.body as string).toContain('[DONE]')
  })
})

describe('POST /api/analysis — video routing', () => {
  async function createVideoAd(brandId: unknown) {
    return Ad.create({
      brandId,
      rawAdId: '507f1f77bcf86cd799439012',
      extractionMethod: 'code',
      platform: 'Facebook',
      headline: 'Watch our story',
      primaryText: 'See the video.',
      status: 'ACTIVE',
      videoUrl: 'https://example.com/ad.mp4',
      thumbnailUrl: 'https://example.com/thumb.jpg',
    })
  }

  it('routes video ad to GeminiService, not ClaudeService', async () => {
    mockGeminiStreamAnalysis.mockImplementation(async function* () {
      yield 'Video '
      yield 'analysis.'
    })

    const brand = await Brand.create({
      name: 'VideoBrand',
      normalizedName: 'videobrand',
      lastFetched: new Date(),
      adCount: 1,
      competitors: [],
    })
    const ad = await createVideoAd(brand._id)

    const res = await request(app)
      .post('/api/analysis')
      .send({ adId: ad._id.toString() })
      .buffer(true)
      .parse((res, cb) => {
        let d = ''
        const stream = res as unknown as StreamLike
        stream.on('data', (c: Uint8Array) => { d += Buffer.from(c).toString() })
        stream.on('end', () => cb(null, d))
      })

    expect(res.status).toBe(200)
    expect(res.body as string).toContain('data: {"text":"Video "}')
    expect(mockGeminiStreamAnalysis).toHaveBeenCalledWith(expect.objectContaining({ videoUrl: 'https://example.com/ad.mp4' }))
    expect(mockStreamAnalysis).not.toHaveBeenCalled()
  })

  it('routes image ad to ClaudeService, not GeminiService', async () => {
    mockStreamAnalysis.mockImplementation(async function* () {
      yield 'Image '
      yield 'analysis.'
    })

    const brand = await Brand.create({
      name: 'ImageBrand',
      normalizedName: 'imagebrand',
      lastFetched: new Date(),
      adCount: 1,
      competitors: [],
    })
    const ad = await Ad.create({
      brandId: brand._id,
      rawAdId: '507f1f77bcf86cd799439013',
      extractionMethod: 'code',
      platform: 'Instagram',
      headline: 'Shop now',
      status: 'ACTIVE',
      imageUrl: 'https://example.com/img.jpg',
    })

    await request(app)
      .post('/api/analysis')
      .send({ adId: ad._id.toString() })
      .buffer(true)
      .parse((res, cb) => {
        let d = ''
        const stream = res as unknown as StreamLike
        stream.on('data', (c: Uint8Array) => { d += Buffer.from(c).toString() })
        stream.on('end', () => cb(null, d))
      })

    expect(mockStreamAnalysis).toHaveBeenCalled()
    expect(mockGeminiStreamAnalysis).not.toHaveBeenCalled()
  })

  afterEach(async () => {
    await Brand.deleteMany({})
    await Ad.deleteMany({})
  })
})
