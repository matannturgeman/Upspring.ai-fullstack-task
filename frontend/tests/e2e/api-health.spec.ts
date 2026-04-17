import { test, expect } from '@playwright/test'

const API = 'http://localhost:4000'

test.describe('Backend API', () => {
  test('GET /health returns 200 with status ok', async ({ request }) => {
    const res = await request.get(`${API}/health`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeTruthy()
  })

  test('GET /api/ads without brand param returns 400 MISSING_BRAND', async ({ request }) => {
    const res = await request.get(`${API}/api/ads`)
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('MISSING_BRAND')
  })

  test('GET /api/ads with brand returns 200 with ads array (MOCK_LLM=true required)', async ({
    request,
  }) => {
    const res = await request.get(`${API}/api/ads?brand=Nike&limit=3`, { timeout: 15_000 })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.empty).toBe(false)
    expect(Array.isArray(body.ads)).toBe(true)
    expect(body.ads.length).toBeGreaterThan(0)
    expect(body.brand).toBeTruthy()
    expect(body.brand.name).toBeTruthy()
  })

  test('POST /api/competitors/find without params returns 400', async ({ request }) => {
    const res = await request.post(`${API}/api/competitors/find`, { data: {} })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('INVALID_INPUT')
  })

  test('POST /api/competitors/find with valid brand returns competitors (MOCK_LLM=true required)', async ({
    request,
  }) => {
    // First get a real brandId from the DB via a search
    const adsRes = await request.get(`${API}/api/ads?brand=Nike&limit=1`, { timeout: 15_000 })
    expect(adsRes.status()).toBe(200)
    const { brand } = await adsRes.json()

    const res = await request.post(`${API}/api/competitors/find`, {
      data: { brandName: brand.name, brandId: String(brand._id) },
      timeout: 10_000,
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.competitors)).toBe(true)
    expect(body.competitors.length).toBeGreaterThan(0)
    expect(body.competitors[0]).toMatchObject({
      name: expect.any(String),
      reason: expect.any(String),
    })
    expect(body.source).toBeTruthy()
  })

  test('POST /api/analysis without adId returns 400 INVALID_INPUT', async ({ request }) => {
    const res = await request.post(`${API}/api/analysis`, { data: {} })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('INVALID_INPUT')
  })

  test('POST /api/analysis with malformed adId returns 400', async ({ request }) => {
    const res = await request.post(`${API}/api/analysis`, { data: { adId: 'not-an-objectid' } })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('INVALID_INPUT')
  })

  test('POST /api/analysis with valid but non-existent adId returns 404', async ({ request }) => {
    const res = await request.post(`${API}/api/analysis`, {
      data: { adId: 'aabbccddeeff001122334455' },
    })
    expect(res.status()).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('AD_NOT_FOUND')
  })

  test('GET /api/proxy/image without url param returns 400', async ({ request }) => {
    const res = await request.get(`${API}/api/proxy/image`)
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('MISSING_URL')
  })

  test('GET /api/proxy/image with disallowed URL returns 403', async ({ request }) => {
    const res = await request.get(
      `${API}/api/proxy/image?url=${encodeURIComponent('https://evil.com/img.jpg')}`,
    )
    expect(res.status()).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('DISALLOWED_URL')
  })

  test('SSRF blocked: localhost URL returns 403', async ({ request }) => {
    const res = await request.get(
      `${API}/api/proxy/image?url=${encodeURIComponent('https://localhost/secret')}`,
    )
    expect(res.status()).toBe(403)
  })

  test('SSRF blocked: internal IP returns 403', async ({ request }) => {
    const res = await request.get(
      `${API}/api/proxy/image?url=${encodeURIComponent('https://127.0.0.1/secret')}`,
    )
    expect(res.status()).toBe(403)
  })
})
