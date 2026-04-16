import { test, expect } from '@playwright/test'

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('renders the app title', async ({ page }) => {
    await expect(page).toHaveTitle(/Upspring\.ai/)
    await expect(page.getByRole('link', { name: /Upspring\.ai/i })).toBeVisible()
  })

  test('renders the search heading and subtitle', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Research Brand Ads/i })).toBeVisible()
    await expect(page.getByText(/Enter a brand name/i)).toBeVisible()
  })

  test('renders the search input and button', async ({ page }) => {
    await expect(page.getByLabel(/Brand name/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /^Search$/i })).toBeVisible()
  })

  test('search button is disabled when input is empty', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^Search$/i })).toBeDisabled()
  })

  test('search button enables when user types', async ({ page }) => {
    await page.getByLabel(/Brand name/i).fill('Nike')
    await expect(page.getByRole('button', { name: /^Search$/i })).toBeEnabled()
  })

  test('search button disables again when input is cleared', async ({ page }) => {
    await page.getByLabel(/Brand name/i).fill('Nike')
    await page.getByLabel(/Brand name/i).clear()
    await expect(page.getByRole('button', { name: /^Search$/i })).toBeDisabled()
  })

  test('renders theme toggle button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /switch to/i })).toBeVisible()
  })
})
