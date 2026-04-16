import { test, expect } from '@playwright/test'

const ADS_ROUTE = '**/api/ads**'

const makeAdsResponse = (overrides = {}) => ({
  empty: false,
  fromCache: false,
  brand: { _id: 'b1', name: 'Nike', normalizedName: 'nike', lastFetched: new Date().toISOString(), adCount: 2 },
  ads: [
    { _id: 'ad1', brandId: 'b1', platform: 'Facebook', status: 'ACTIVE', performanceData: null, headline: 'Just Do It', primaryText: 'Shop now' },
    { _id: 'ad2', brandId: 'b1', platform: 'Instagram', status: 'ACTIVE', performanceData: null, headline: 'New Arrivals' },
  ],
  ...overrides,
})

test.describe('Search flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('shows loading spinner while fetching', async ({ page }) => {
    await page.route(ADS_ROUTE, async route => {
      await new Promise(r => setTimeout(r, 800))
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makeAdsResponse()) })
    })

    await page.getByLabel(/Brand name/i).fill('Nike')
    await page.getByRole('button', { name: /^Search$/i }).click()

    await expect(page.getByRole('status', { name: /Fetching ads/i })).toBeVisible()
    await expect(page.getByText(/Fetching ads from Meta/i)).toBeVisible()
  })

  test('shows empty state when no ads found', async ({ page }) => {
    await page.route(ADS_ROUTE, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ empty: true, ads: [], brand: null, message: 'No ads found' }),
      })
    )

    await page.getByLabel(/Brand name/i).fill('unknownbrand123')
    await page.getByRole('button', { name: /^Search$/i }).click()

    await expect(page.getByText(/No ads found/i)).toBeVisible()
  })

  test('shows error state on API failure', async ({ page }) => {
    await page.route(ADS_ROUTE, route =>
      route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: true, message: 'Provider error', code: 'PROVIDER_ERROR' }),
      })
    )

    await page.getByLabel(/Brand name/i).fill('Nike')
    await page.getByRole('button', { name: /^Search$/i }).click()

    await expect(page.getByText(/something went wrong/i)).toBeVisible()
  })

  test('renders ad cards on successful search', async ({ page }) => {
    await page.route(ADS_ROUTE, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makeAdsResponse()) })
    )

    await page.getByLabel(/Brand name/i).fill('Nike')
    await page.getByRole('button', { name: /^Search$/i }).click()

    await expect(page.getByTestId('ad-card')).toHaveCount(2)
    await expect(page.getByText('Just Do It')).toBeVisible()
    await expect(page.getByText('New Arrivals')).toBeVisible()
  })

  test('shows result count after successful search', async ({ page }) => {
    await page.route(ADS_ROUTE, route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(makeAdsResponse({ ads: [{ _id: 'ad1', brandId: 'b1', platform: 'Facebook', status: 'ACTIVE', performanceData: null, headline: 'Just Do It' }] })),
      })
    )

    await page.getByLabel(/Brand name/i).fill('Nike')
    await page.getByRole('button', { name: /^Search$/i }).click()

    await expect(page.getByText(/ads found for/i)).toBeVisible()
    await expect(page.getByText('Nike')).toBeVisible()
  })

  test('shows cached badge when results are from cache', async ({ page }) => {
    await page.route(ADS_ROUTE, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makeAdsResponse({ fromCache: true })) })
    )

    await page.getByLabel(/Brand name/i).fill('Nike')
    await page.getByRole('button', { name: /^Search$/i }).click()

    await expect(page.getByText(/cached results/i)).toBeVisible()
  })

  test('input is disabled while search is in progress', async ({ page }) => {
    await page.route(ADS_ROUTE, async route => {
      await new Promise(r => setTimeout(r, 800))
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makeAdsResponse()) })
    })

    await page.getByLabel(/Brand name/i).fill('Nike')
    await page.getByRole('button', { name: /^Search$/i }).click()

    await expect(page.getByLabel(/Brand name/i)).toBeDisabled()
    await expect(page.getByRole('button', { name: /Searching/i })).toBeDisabled()
  })

  test('search via Enter key works', async ({ page }) => {
    await page.route(ADS_ROUTE, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ empty: true, ads: [], brand: null, message: 'No ads found' }) })
    )

    await page.getByLabel(/Brand name/i).fill('Nike')
    await page.getByLabel(/Brand name/i).press('Enter')

    await expect(page.getByText(/No ads found/i)).toBeVisible()
  })
})
