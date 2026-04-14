# Phase 7 — Tests & E2E

## Goal
Unit tests for services/utils, integration tests for API routes, and Playwright E2E tests covering the full user journey.

## Dependencies
- All phases complete
- Docker Compose running (MongoDB)
- Playwright installed

## Test Stack
| Layer | Tool |
|---|---|
| Backend unit | Jest + `@jest/globals` |
| Backend integration | Jest + Supertest |
| Frontend unit | Vitest + React Testing Library |
| E2E | Playwright |

---

## Backend Tests

### Setup

**`backend/jest.config.js`**
```js
export default {
  testEnvironment: 'node',
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
  testMatch: ['**/tests/**/*.test.js'],
}
```

**`backend/tests/setup.js`**
```js
import mongoose from 'mongoose'

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/upspring_test')
})

afterAll(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.connection.close()
})
```

---

### Unit: `apifyParser`

**`backend/tests/unit/apifyParser.test.js`**
```js
import { describe, it, expect } from '@jest/globals'
import { parseApifyAd } from '../../src/utils/apifyParser.js'

describe('parseApifyAd', () => {
  it('parses a full raw ad correctly', () => {
    const raw = {
      id: 'abc123',
      publisher_platforms: ['FACEBOOK', 'INSTAGRAM'],
      is_active: true,
      start_date: 1700000000,
      snapshot: {
        title: 'Big Sale',
        body: { text: 'Shop now!' },
        images: [{ url: 'https://example.com/img.jpg' }],
        videos: [],
      },
    }
    const ad = parseApifyAd(raw)
    expect(ad.adId).toBe('abc123')
    expect(ad.headline).toBe('Big Sale')
    expect(ad.primaryText).toBe('Shop now!')
    expect(ad.status).toBe('ACTIVE')
    expect(ad.imageUrl).toBe('https://example.com/img.jpg')
    expect(ad.startDate).toBeInstanceOf(Date)
  })

  it('handles missing snapshot fields gracefully', () => {
    const raw = { id: 'x', publisher_platforms: [], is_active: false, snapshot: {} }
    const ad = parseApifyAd(raw)
    expect(ad.headline).toBeNull()
    expect(ad.primaryText).toBeNull()
    expect(ad.imageUrl).toBeNull()
    expect(ad.status).toBe('INACTIVE')
  })

  it('handles completely missing snapshot', () => {
    const ad = parseApifyAd({ id: 'y' })
    expect(ad.headline).toBeNull()
    expect(ad.imageUrl).toBeNull()
  })
})
```

---

### Unit: `promptBuilder`

**`backend/tests/unit/promptBuilder.test.js`**
```js
import { describe, it, expect } from '@jest/globals'
import { buildAnalysisPrompt, buildImageBlocks } from '../../src/utils/promptBuilder.js'

const mockAds = [
  { headline: 'Buy Now', primaryText: 'Great deal!', platform: 'Facebook', status: 'ACTIVE', thumbnailUrl: 'https://img.com/1.jpg' },
  { headline: 'Shop Sale', primaryText: 'Limited time.', platform: 'Instagram', status: 'ACTIVE', thumbnailUrl: null, imageUrl: 'https://img.com/2.jpg' },
  { headline: null, primaryText: null, platform: 'Facebook', status: 'INACTIVE', thumbnailUrl: null, imageUrl: null },
]

describe('buildAnalysisPrompt', () => {
  it('includes ad headlines in summary', () => {
    const { adSummaries } = buildAnalysisPrompt(mockAds, 'What works?')
    expect(adSummaries).toContain('Buy Now')
    expect(adSummaries).toContain('Shop Sale')
  })

  it('limits to 15 ads', () => {
    const manyAds = Array.from({ length: 20 }, (_, i) => ({ headline: `Ad ${i}`, primaryText: 'text' }))
    const { adSummaries } = buildAnalysisPrompt(manyAds, 'test')
    // 15 ads max = "Ad 14" present, "Ad 15" not
    expect(adSummaries).toContain('Ad 14')
    expect(adSummaries).not.toContain('Ad 15')
  })
})

describe('buildImageBlocks', () => {
  it('returns image blocks for ads with images', () => {
    const blocks = buildImageBlocks(mockAds)
    expect(blocks.length).toBe(2) // ad 3 has no images
    expect(blocks[0].type).toBe('image')
    expect(blocks[0].source.url).toBe('https://img.com/1.jpg')
  })

  it('limits to 10 image blocks', () => {
    const manyAds = Array.from({ length: 15 }, (_, i) => ({ thumbnailUrl: `https://img.com/${i}.jpg` }))
    expect(buildImageBlocks(manyAds).length).toBe(10)
  })
})
```

---

### Integration: Ads Route

**`backend/tests/integration/ads.test.js`**
```js
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import request from 'supertest'
import app from '../../server.js'
import * as apifyService from '../../src/services/apifyService.js'

jest.mock('../../src/services/apifyService.js')

describe('GET /api/ads', () => {
  it('returns 400 when brand param missing', async () => {
    const res = await request(app).get('/api/ads')
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('MISSING_BRAND')
  })

  it('returns ads for a valid brand', async () => {
    apifyService.scrapeMetaAds.mockResolvedValue({
      ads: [{
        id: '1',
        publisher_platforms: ['FACEBOOK'],
        is_active: true,
        snapshot: { title: 'Test Ad', body: { text: 'Hello' }, images: [{ url: 'https://img.com/a.jpg' }], videos: [] },
      }],
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
    apifyService.scrapeMetaAds.mockResolvedValue({ ads: [], partial: false, empty: true })

    const res = await request(app).get('/api/ads?brand=UnknownBrand99999')
    expect(res.status).toBe(200)
    expect(res.body.empty).toBe(true)
    expect(res.body.ads).toEqual([])
  })

  it('returns 502 when Apify throws', async () => {
    apifyService.scrapeMetaAds.mockRejectedValue(new Error('Apify unreachable'))

    const res = await request(app).get('/api/ads?brand=AnyBrand')
    expect(res.status).toBe(502)
    expect(res.body.code).toBe('PROVIDER_ERROR')
  })

  it('returns cached results on second request', async () => {
    apifyService.scrapeMetaAds.mockResolvedValue({
      ads: [{ id: 'c1', publisher_platforms: ['FACEBOOK'], is_active: true, snapshot: { title: 'Cached', body: { text: '' }, images: [], videos: [] } }],
      partial: false,
      empty: false,
    })

    await request(app).get('/api/ads?brand=CachedBrand')
    const res2 = await request(app).get('/api/ads?brand=CachedBrand')
    expect(res2.body.fromCache).toBe(true)
    // Apify should only have been called once
    expect(apifyService.scrapeMetaAds).toHaveBeenCalledTimes(1)
  })
})
```

---

### Integration: Analysis Route

**`backend/tests/integration/analysis.test.js`**
```js
import { describe, it, expect, jest } from '@jest/globals'
import request from 'supertest'
import app from '../../server.js'
import * as claudeService from '../../src/services/claudeService.js'

jest.mock('../../src/services/claudeService.js')

describe('POST /api/analysis/ask', () => {
  it('returns 400 when brandId missing', async () => {
    const res = await request(app).post('/api/analysis/ask').send({ question: 'test' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for question over 1000 chars', async () => {
    const res = await request(app).post('/api/analysis/ask')
      .send({ brandId: '507f1f77bcf86cd799439011', question: 'x'.repeat(1001) })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('QUESTION_TOO_LONG')
  })
})
```

---

## Frontend Unit Tests

**`frontend/tests/setup.js`**
```js
import '@testing-library/jest-dom'
```

### SearchBar Component

**`frontend/tests/unit/SearchBar.test.jsx`**
```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SearchBar } from '../../src/components/SearchBar/SearchBar'

// Mock the hook
vi.mock('../../src/hooks/useAds', () => ({
  useAds: () => ({ search: vi.fn() }),
}))
vi.mock('../../src/store/appStore', () => ({
  useAppStore: (sel) => sel({ adsLoading: false }),
}))

describe('SearchBar', () => {
  it('renders input and button', () => {
    render(<SearchBar />)
    expect(screen.getByPlaceholderText(/brand name/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
  })

  it('disables button when input is empty', () => {
    render(<SearchBar />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('enables button when input has text', () => {
    render(<SearchBar />)
    fireEvent.change(screen.getByPlaceholderText(/brand name/i), { target: { value: 'Nike' } })
    expect(screen.getByRole('button')).not.toBeDisabled()
  })
})
```

### AdCard Component

**`frontend/tests/unit/AdCard.test.jsx`**
```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AdCard } from '../../src/components/AdCard/AdCard'

const mockAd = {
  _id: '1',
  headline: 'Test Headline',
  primaryText: 'Test primary text',
  platform: 'Facebook',
  startDate: '2024-01-01T00:00:00.000Z',
  status: 'ACTIVE',
  thumbnailUrl: 'https://img.com/test.jpg',
}

describe('AdCard', () => {
  it('renders headline and text', () => {
    render(<AdCard ad={mockAd} />)
    expect(screen.getByText('Test Headline')).toBeInTheDocument()
    expect(screen.getByText('Test primary text')).toBeInTheDocument()
  })

  it('shows Active badge for active ad', () => {
    render(<AdCard ad={mockAd} />)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('shows performance data unavailable notice', () => {
    render(<AdCard ad={mockAd} />)
    expect(screen.getByText(/performance data unavailable/i)).toBeInTheDocument()
  })

  it('shows "No preview available" when no image', () => {
    render(<AdCard ad={{ ...mockAd, thumbnailUrl: null, imageUrl: null }} />)
    expect(screen.getByText(/no preview available/i)).toBeInTheDocument()
  })
})
```

---

## E2E Tests (Playwright)

**`frontend/tests/e2e/playwright.config.js`**
```js
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
})
```

### E2E: Full Search Flow

**`frontend/tests/e2e/search.spec.js`**
```js
import { test, expect } from '@playwright/test'

test.describe('Brand Search Flow', () => {
  test('searches for a brand and shows ads', async ({ page }) => {
    await page.goto('/')
    await page.fill('input[placeholder*="brand name"]', 'Nike')
    await page.click('button:has-text("Search")')

    // Loading state
    await expect(page.locator('text=Fetching ads')).toBeVisible()

    // Wait for results (up to 60s for Apify)
    await expect(page.locator('[data-testid="ad-card"]').first()).toBeVisible({ timeout: 60_000 })

    // Check at least one ad card rendered
    const cards = page.locator('[data-testid="ad-card"]')
    expect(await cards.count()).toBeGreaterThan(0)
  })

  test('shows empty state for unknown brand', async ({ page }) => {
    await page.goto('/')
    await page.fill('input[placeholder*="brand name"]', 'XYZUnknownBrand99999')
    await page.click('button:has-text("Search")')
    await expect(page.locator('text=No ads found')).toBeVisible({ timeout: 60_000 })
  })

  test('shows error state when API is down', async ({ page }) => {
    await page.route('/api/ads*', route => route.abort('failed'))
    await page.goto('/')
    await page.fill('input[placeholder*="brand name"]', 'Nike')
    await page.click('button:has-text("Search")')
    await expect(page.locator('text=Something went wrong')).toBeVisible({ timeout: 10_000 })
  })
})
```

### E2E: AI Analysis Flow

**`frontend/tests/e2e/analysis.spec.js`**
```js
import { test, expect } from '@playwright/test'

test.describe('AI Analysis Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock ads API to skip actual Apify call
    await page.route('/api/ads*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        brand: { _id: 'brandid1', name: 'Nike' },
        ads: [
          { _id: 'ad1', headline: 'Just Do It', primaryText: 'Shop now', platform: 'Facebook', status: 'ACTIVE' },
        ],
        fromCache: false,
      }),
    }))
    await page.goto('/')
    await page.fill('input[placeholder*="brand name"]', 'Nike')
    await page.click('button:has-text("Search")')
    await expect(page.locator('text=Just Do It')).toBeVisible()
  })

  test('suggested questions are clickable', async ({ page }) => {
    await expect(page.locator('text=What messaging angles are used most?')).toBeVisible()
    await page.click('text=What messaging angles are used most?')
    await expect(page.locator('text=What messaging angles are used most?').nth(1)).toBeVisible()
  })

  test('custom question gets AI response', async ({ page }) => {
    await page.route('/api/analysis/ask', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'event: chunk\ndata: {"text":"Nike focuses on motivation"}\n\nevent: done\ndata: {"finished":true}\n\n',
      })
    })

    await page.fill('input[placeholder*="Ask about"]', 'What tone is used?')
    await page.click('button:has-text("Ask")')
    await expect(page.locator('text=Nike focuses on motivation')).toBeVisible({ timeout: 10_000 })
  })
})
```

### E2E: Competitor Discovery Flow

**`frontend/tests/e2e/competitors.spec.js`**
```js
import { test, expect } from '@playwright/test'

test.describe('Competitor Discovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/ads*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        brand: { _id: 'brandid1', name: 'Nike' },
        ads: [{ _id: 'ad1', headline: 'Just Do It', status: 'ACTIVE' }],
        fromCache: false,
      }),
    }))
    await page.goto('/')
    await page.fill('input[placeholder*="brand name"]', 'Nike')
    await page.click('button:has-text("Search")')
    await expect(page.locator('text=Just Do It')).toBeVisible()
  })

  test('finds and displays competitors', async ({ page }) => {
    await page.route('/api/competitors/find', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        competitors: [
          { name: 'Adidas', reason: 'Competes in athletic footwear and apparel' },
          { name: 'Puma', reason: 'Overlapping audience in sports lifestyle' },
        ],
        source: 'perplexity',
      }),
    }))

    await page.click('button:has-text("Find Competitors")')
    await expect(page.locator('text=Adidas')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Competes in athletic footwear')).toBeVisible()
    await expect(page.locator('text=Via web search')).toBeVisible()
  })

  test('selecting competitor fetches their ads', async ({ page }) => {
    await page.route('/api/competitors/find', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ competitors: [{ name: 'Adidas', reason: 'Athletic competitor' }], source: 'perplexity' }),
    }))

    let adsCalled = 0
    await page.route('/api/ads*', route => {
      adsCalled++
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ brand: { _id: 'adidas1', name: 'Adidas' }, ads: [{ _id: 'a1', headline: 'Adidas Ad', status: 'ACTIVE' }], fromCache: false }) })
    })

    await page.click('button:has-text("Find Competitors")')
    await expect(page.locator('text=Adidas')).toBeVisible()
    await page.click('text=Adidas')

    await expect(page.locator('text=Adidas Ad')).toBeVisible({ timeout: 15_000 })
  })
})
```

## npm Scripts to Add

**`backend/package.json`**
```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:watch": "jest --watch"
  }
}
```

**`frontend/package.json`**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

## Success Criteria
- [ ] `npm test` in backend — all unit + integration tests pass
- [ ] `npm test` in frontend — all component unit tests pass
- [ ] `npm run test:e2e` — full search + analysis + competitor flow passes (with mocks)
- [ ] E2E tests screenshot on failure
- [ ] 0 flaky tests (all deterministic via mocking where needed)
- [ ] Coverage: services > 80%, components > 70%
