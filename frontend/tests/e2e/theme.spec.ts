import { test, expect } from '@playwright/test'

test.describe('Dark / light mode', () => {
  test('defaults to system preference (light)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    const html = page.locator('html')
    await expect(html).not.toHaveClass(/dark/)
  })

  test('defaults to dark when system preference is dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    const html = page.locator('html')
    await expect(html).toHaveClass(/dark/)
  })

  test('toggle switches from light to dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    const html = page.locator('html')
    await expect(html).not.toHaveClass(/dark/)

    await page.getByRole('button', { name: /switch to dark/i }).click()
    await expect(html).toHaveClass(/dark/)
  })

  test('toggle switches from dark to light', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    const html = page.locator('html')
    await expect(html).toHaveClass(/dark/)

    await page.getByRole('button', { name: /switch to light/i }).click()
    await expect(html).not.toHaveClass(/dark/)
  })

  test('persists theme preference in localStorage', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')

    await page.getByRole('button', { name: /switch to dark/i }).click()
    const stored = await page.evaluate(() => localStorage.getItem('theme'))
    expect(stored).toBe('dark')
  })

  test('respects stored theme on page reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('theme', 'dark'))
    await page.reload()

    await expect(page.locator('html')).toHaveClass(/dark/)
  })
})
