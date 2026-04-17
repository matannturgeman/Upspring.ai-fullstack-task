import { test, expect } from '@playwright/test'

const ADS_ROUTE = '**/api/ads**'
const COMPETITORS_ROUTE = '**/api/competitors/find'

const MOCK_BRAND = {
  _id: 'b1',
  name: 'Nike',
  normalizedName: 'nike',
  lastFetched: new Date().toISOString(),
  adCount: 2,
}

const MOCK_ADS_RESPONSE = {
  empty: false,
  fromCache: false,
  brand: MOCK_BRAND,
  ads: [
    {
      _id: 'aabbccddeeff001122334455',
      brandId: 'b1',
      platform: 'Facebook',
      status: 'ACTIVE',
      performanceData: null,
      headline: 'Just Do It',
      primaryText: 'Shop the new collection.',
    },
  ],
}

const MOCK_COMPETITORS = [
  { name: 'Adidas', reason: 'Direct competitor in athletic footwear' },
  { name: 'Puma', reason: 'Competes in sportswear market' },
]

function makeCompetitorsResponse(overrides: Record<string, unknown> = {}) {
  return {
    competitors: MOCK_COMPETITORS,
    source: 'perplexity',
    disclaimer: 'Identified via web search',
    ...overrides,
  }
}

test.describe('Competitor discovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.route(ADS_ROUTE, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ADS_RESPONSE),
      }),
    )
    await page.getByLabel(/Brand name/i).fill('Nike')
    await page.getByRole('button', { name: /^Search$/i }).click()
    await expect(page.getByTestId('ad-card').first()).toBeVisible()
  })

  test('"Find Competitors" button is visible after search', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Find Competitors/i })).toBeVisible()
  })

  test('shows "Finding..." while request is in progress', async ({ page }) => {
    await page.route(COMPETITORS_ROUTE, async (route) => {
      await new Promise((r) => setTimeout(r, 800))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeCompetitorsResponse()),
      })
    })

    await page.getByRole('button', { name: /Find Competitors/i }).click()
    await expect(page.getByRole('button', { name: /Finding/i })).toBeVisible()
  })

  test('renders competitor list after successful fetch', async ({ page }) => {
    await page.route(COMPETITORS_ROUTE, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeCompetitorsResponse()),
      }),
    )

    await page.getByRole('button', { name: /Find Competitors/i }).click()

    await expect(page.getByText('Adidas')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Puma')).toBeVisible()
    await expect(page.getByText(/Direct competitor in athletic footwear/i)).toBeVisible()
  })

  test('shows "Via web search" source label for perplexity results', async ({ page }) => {
    await page.route(COMPETITORS_ROUTE, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeCompetitorsResponse({ source: 'perplexity' })),
      }),
    )

    await page.getByRole('button', { name: /Find Competitors/i }).click()
    await expect(page.getByText(/Via web search/i)).toBeVisible({ timeout: 10_000 })
  })

  test('shows "Via AI reasoning" source label for claude results', async ({ page }) => {
    await page.route(COMPETITORS_ROUTE, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeCompetitorsResponse({ source: 'claude' })),
      }),
    )

    await page.getByRole('button', { name: /Find Competitors/i }).click()
    await expect(page.getByText(/Via AI reasoning from ad content/i)).toBeVisible({
      timeout: 10_000,
    })
  })

  test('does not show source label when returning from cache', async ({ page }) => {
    await page.route(COMPETITORS_ROUTE, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeCompetitorsResponse({ source: 'cache' })),
      }),
    )

    await page.getByRole('button', { name: /Find Competitors/i }).click()
    await expect(page.getByText('Adidas')).toBeVisible({ timeout: 10_000 })
    // 'cache' source falls through to the 'Mock data' display — verify no perplexity/claude label shown
    await expect(page.getByText(/Via web search/i)).not.toBeVisible()
    await expect(page.getByText(/Via AI reasoning/i)).not.toBeVisible()
  })

  test('shows error alert when API fails', async ({ page }) => {
    await page.route(COMPETITORS_ROUTE, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'INTERNAL', message: 'Service unavailable' }),
      }),
    )

    await page.getByRole('button', { name: /Find Competitors/i }).click()
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 })
  })

  test('clicking a competitor triggers a new search for that brand', async ({ page }) => {
    await page.route(COMPETITORS_ROUTE, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeCompetitorsResponse()),
      }),
    )

    await page.getByRole('button', { name: /Find Competitors/i }).click()
    await expect(page.getByText('Adidas')).toBeVisible({ timeout: 10_000 })

    // Intercept the second ads call triggered by selecting a competitor
    let competitorSearchQuery = ''
    await page.route(ADS_ROUTE, (route) => {
      competitorSearchQuery = new URL(route.request().url()).searchParams.get('brand') ?? ''
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...MOCK_ADS_RESPONSE, brand: { ...MOCK_BRAND, name: 'Adidas' } }),
      })
    })

    await page.getByRole('listitem').filter({ hasText: 'Adidas' }).click()
    await expect(page.getByTestId('ad-card').first()).toBeVisible({ timeout: 10_000 })
    expect(competitorSearchQuery.toLowerCase()).toBe('adidas')
  })

  test('shows placeholder text before competitors are loaded', async ({ page }) => {
    await expect(
      page.getByText(/Click "Find Competitors" to discover competing brands/i),
    ).toBeVisible()
  })
})
