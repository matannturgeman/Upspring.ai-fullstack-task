import { test, expect } from '@playwright/test'

const ADS_ROUTE = '**/api/ads**'

const MOCK_ADS = {
  empty: false, fromCache: false,
  brand: { _id: 'b1', name: 'Nike', normalizedName: 'nike', lastFetched: new Date().toISOString(), adCount: 1 },
  ads: [{ _id: 'ad1', brandId: 'b1', platform: 'Facebook', status: 'ACTIVE', performanceData: null, headline: 'Test Ad' }],
}

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('page has a main landmark', async ({ page }) => {
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('page has a banner landmark', async ({ page }) => {
    await expect(page.getByRole('banner')).toBeVisible()
  })

  test('search form has role=search', async ({ page }) => {
    await expect(page.getByRole('search')).toBeVisible()
  })

  test('search input has an accessible label', async ({ page }) => {
    await expect(page.getByLabel(/Brand name/i)).toBeVisible()
  })

  test('search input has a visible label (sr-only)', async ({ page }) => {
    const label = page.locator('label[for="brand-search"]')
    await expect(label).toBeAttached()
  })

  test('theme toggle has an accessible label', async ({ page }) => {
    await expect(page.getByRole('button', { name: /switch to/i })).toBeAttached()
  })

  test('ad cards use article role after search', async ({ page }) => {
    await page.route(ADS_ROUTE, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ADS) })
    )
    await page.getByLabel(/Brand name/i).fill('Nike')
    await page.getByRole('button', { name: /^Search$/i }).click()

    await expect(page.getByRole('article')).toBeVisible()
  })

  test('loading spinner has role=status', async ({ page }) => {
    await page.route(ADS_ROUTE, async route => {
      await new Promise(r => setTimeout(r, 800))
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ADS) })
    })

    await page.getByLabel(/Brand name/i).fill('Nike')
    await page.getByRole('button', { name: /^Search$/i }).click()

    await expect(page.getByRole('status')).toBeVisible()
  })

  test('analysis panel has role=dialog and aria-modal', async ({ page }) => {
    await page.route(ADS_ROUTE, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ADS) })
    )
    await page.route('**/api/analysis', route =>
      route.fulfill({
        status: 200, contentType: 'text/event-stream',
        body: 'data: {"text":"Analysis."}\n\ndata: [DONE]\n\n',
      })
    )

    await page.getByLabel(/Brand name/i).fill('Nike')
    await page.getByRole('button', { name: /^Search$/i }).click()
    await page.getByRole('button', { name: /Analyze with AI/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
  })
})
