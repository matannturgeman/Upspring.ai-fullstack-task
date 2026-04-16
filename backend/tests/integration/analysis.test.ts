import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import app from '../../server.ts'
import { ClaudeService } from '../../src/services/ClaudeService.ts'
import Brand from '../../src/models/Brand.ts'
import Ad from '../../src/models/Ad.ts'

vi.mock('../../src/services/ClaudeService.ts')

const mockStreamChat = vi.fn()
const mockStreamAnalysis = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(ClaudeService).mockImplementation(() => ({
    streamChat: mockStreamChat,
    streamAnalysis: mockStreamAnalysis,
    extractFields: vi.fn().mockResolvedValue(null),
    findCompetitorsFromAds: vi.fn().mockResolvedValue([]),
  }) as unknown as ClaudeService)
})

afterEach(async () => {
  await Brand.deleteMany({})
  await Ad.deleteMany({})
})

async function createTestBrand(name = 'Nike') {
  const brand = await Brand.create({
    name,
    normalizedName: name.toLowerCase(),
    lastFetched: new Date(),
    adCount: 2,
    competitors: [],
  })
  return brand
}

async function createTestAd(brandId: mongoose.Types.ObjectId) {
  return Ad.create({
    brandId,
    rawAdId: new mongoose.Types.ObjectId(),
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
    const res = await request(app)
      .post('/api/analysis/chat')
      .send({ messages: VALID_MESSAGES })

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
    const fakeId = new mongoose.Types.ObjectId().toString()
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
    await createTestAd(brand._id as mongoose.Types.ObjectId)

    const res = await request(app)
      .post('/api/analysis/chat')
      .send({ brandId: brand._id.toString(), messages: VALID_MESSAGES })
      .buffer(true)
      .parse((res, cb) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => cb(null, data))
      })

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/event-stream/)

    const body = res.body as string
    expect(body).toContain('data: {"text":"Urgency "}')
    expect(body).toContain('data: [DONE]')
  })

  it('calls streamChat with brand name and fetched ads', async () => {
    mockStreamChat.mockImplementation(async function* () { yield 'ok' })

    const brand = await createTestBrand('Adidas')
    await createTestAd(brand._id as mongoose.Types.ObjectId)

    await request(app)
      .post('/api/analysis/chat')
      .send({ brandId: brand._id.toString(), messages: VALID_MESSAGES })
      .buffer(true)
      .parse((res, cb) => {
        let d = ''
        res.on('data', (c: Buffer) => { d += c.toString() })
        res.on('end', () => cb(null, d))
      })

    expect(mockStreamChat).toHaveBeenCalledWith(
      'Adidas',
      expect.arrayContaining([expect.objectContaining({ headline: 'Just Do It' })]),
      VALID_MESSAGES
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
        res.on('data', (c: Buffer) => { d += c.toString() })
        res.on('end', () => cb(null, d))
      })

    expect(res.body as string).toContain('PROVIDER_ERROR')
    expect(res.body as string).toContain('[DONE]')
  })
})
