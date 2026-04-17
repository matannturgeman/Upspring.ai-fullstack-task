import { test, expect } from '@playwright/test'

const ADS_ROUTE = '**/api/ads**'
const ANALYSIS_ROUTE = '**/api/analysis'

const MOCK_ADS = {
  empty: false,
  fromCache: false,
  brand: {
    _id: 'b1',
    name: 'Nike',
    normalizedName: 'nike',
    lastFetched: new Date().toISOString(),
    adCount: 1,
  },
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

test.describe('AI Analysis flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.route(ADS_ROUTE, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ADS),
      }),
    )
    await page.getByLabel(/Brand name/i).fill('Nike')
    await page.getByRole('button', { name: /^Search$/i }).click()
    await expect(page.getByTestId('ad-card')).toBeVisible()
  })

  test('Analyze button is visible on each ad card', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Analyze with AI/i })).toBeVisible()
  })

  test('clicking Analyze opens the analysis panel', async ({ page }) => {
    await page.route(ANALYSIS_ROUTE, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"text":"Great ad copy."}\n\ndata: [DONE]\n\n',
      }),
    )

    await page.getByRole('button', { name: /Analyze with AI/i }).click()

    await expect(page.getByRole('dialog', { name: /AI Ad Analysis/i })).toBeVisible()
    await expect(page.getByText('AI Ad Analysis')).toBeVisible()
    await expect(page.getByText('claude-sonnet-4-6')).toBeVisible()
  })

  test('streams analysis text into the panel', async ({ page }) => {
    await page.route(ANALYSIS_ROUTE, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"text":"Strong hook."}\n\ndata: [DONE]\n\n',
      }),
    )

    await page.getByRole('button', { name: /Analyze with AI/i }).click()

    await expect(page.getByText(/Strong hook/i)).toBeVisible({ timeout: 10_000 })
  })

  test('shows error when analysis fails', async ({ page }) => {
    await page.route(ANALYSIS_ROUTE, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'PROVIDER_ERROR', message: 'AI provider unavailable' }),
      }),
    )

    await page.getByRole('button', { name: /Analyze with AI/i }).click()

    await expect(page.getByRole('alert')).toBeVisible()
  })

  test('closing the panel hides it', async ({ page }) => {
    await page.route(ANALYSIS_ROUTE, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"text":"Analysis complete."}\n\ndata: [DONE]\n\n',
      }),
    )

    await page.getByRole('button', { name: /Analyze with AI/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.getByRole('button', { name: /Close analysis panel/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('Analyze button shows "Analyzing..." while in progress', async ({ page }) => {
    await page.route(ANALYSIS_ROUTE, async (route) => {
      await new Promise((r) => setTimeout(r, 800))
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"text":"Done."}\n\ndata: [DONE]\n\n',
      })
    })

    await page.getByRole('button', { name: /Analyze with AI/i }).click()
    await expect(page.getByRole('button', { name: /Analyzing/i })).toBeVisible()
  })
})
