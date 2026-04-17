/**
 * Full-stack integration tests — NO network mocking.
 * These hit the real backend pipeline (Apify mock → MongoDB → response)
 * and verify the complete UI flow end-to-end.
 *
 * Requirements: backend running with MOCK_LLM=true
 */
import { test, expect } from '@playwright/test'

// Unique brand name avoids race conditions when api-health.spec runs Nike searches in parallel
const BRAND = 'Puma'

test.describe('Full-stack search integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('search returns real ads from backend pipeline', async ({ page }) => {
    await page.getByLabel(/Brand name/i).fill(BRAND)
    await page.getByRole('button', { name: /^Search$/i }).click()

    await expect(page.getByTestId('ad-card').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/ads found for/i)).toBeVisible()
    await expect(page.getByText(BRAND).first()).toBeVisible()
  })

  test('second search for same brand uses cache', async ({ page }) => {
    await page.getByLabel(/Brand name/i).fill(BRAND)
    await page.getByRole('button', { name: /^Search$/i }).click()
    await expect(page.getByTestId('ad-card').first()).toBeVisible({ timeout: 15_000 })

    // Second search — should show cached badge
    await page.getByLabel(/Brand name/i).fill(BRAND)
    await page.getByRole('button', { name: /^Search$/i }).click()
    await expect(page.getByTestId('ad-card').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/cached results/i)).toBeVisible()
  })

  test('loading spinner appears during real backend fetch', async ({ page }) => {
    // forceRefresh via URL to bypass cache and see the loading state
    await page.goto('/?_nocache=1')
    await page.evaluate(() => {
      // Clear Nike from store so forceRefresh fires
    })
    await page.getByLabel(/Brand name/i).fill('Nike')

    // Intercept to add a small delay so loading state is catchable
    await page.route('**/api/ads**', async (route) => {
      await new Promise((r) => setTimeout(r, 300))
      await route.continue()
    })

    await page.getByRole('button', { name: /^Search$/i }).click()
    await expect(page.getByRole('status', { name: /Fetching ads/i })).toBeVisible()
    await expect(page.getByTestId('ad-card').first()).toBeVisible({ timeout: 15_000 })
  })

  test('search then find competitors from real backend', async ({ page }) => {
    await page.getByLabel(/Brand name/i).fill('Nike')
    await page.getByRole('button', { name: /^Search$/i }).click()
    await expect(page.getByTestId('ad-card').first()).toBeVisible({ timeout: 15_000 })

    // Competitor panel is visible
    await expect(page.getByRole('complementary', { name: /Competitor discovery/i })).toBeVisible()

    await page.getByRole('button', { name: /Find Competitors/i }).click()
    await expect(page.getByRole('button', { name: /Finding/i })).toBeVisible()

    // Competitors load from real backend
    const panel = page.getByRole('complementary', { name: /Competitor discovery/i })
    await expect(panel.getByRole('listitem').first()).toBeVisible({ timeout: 10_000 })
  })

  test('clicking a competitor triggers a new search', async ({ page }) => {
    await page.getByLabel(/Brand name/i).fill('Nike')
    await page.getByRole('button', { name: /^Search$/i }).click()
    await expect(page.getByTestId('ad-card').first()).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: /Find Competitors/i }).click()
    const panel = page.getByRole('complementary', { name: /Competitor discovery/i })
    const firstCompetitor = panel.getByRole('listitem').first().getByRole('button')
    await expect(firstCompetitor).toBeVisible({ timeout: 10_000 })

    const competitorName = await firstCompetitor.locator('p').first().textContent()
    await firstCompetitor.click()

    // New search fires — ads load for competitor
    await expect(page.getByTestId('ad-card').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/ads found for/i)).toBeVisible()
    await expect(page.getByText(competitorName!).first()).toBeVisible()
  })
})
