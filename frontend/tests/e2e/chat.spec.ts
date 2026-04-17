import { test, expect } from '@playwright/test'

const ADS_ROUTE = '**/api/ads**'
const CHAT_ROUTE = '**/api/analysis/chat'

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
    {
      _id: 'aabbccddeeff001122334456',
      brandId: 'b1',
      platform: 'Instagram',
      status: 'ACTIVE',
      performanceData: null,
      headline: 'Find Your Greatness',
      primaryText: 'New season arrivals.',
    },
  ],
}

function chatSseBody(text: string) {
  return `data: {"text":"${text}"}\n\ndata: [DONE]\n\n`
}

test.describe('Brand AI Chat', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(ADS_ROUTE, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ADS_RESPONSE),
      }),
    )
    await page.goto('/')
    await page.getByLabel(/Brand name/i).fill('Nike')
    await page.getByRole('button', { name: /^Search$/i }).click()
    await expect(page.getByTestId('ad-card')).toBeVisible()
  })

  test('"Ask AI about these ads" button is visible after search', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Ask AI about these ads/i })).toBeVisible()
  })

  test('clicking the button opens the chat dialog', async ({ page }) => {
    await page.getByRole('button', { name: /Ask AI about these ads/i }).click()
    await expect(page.getByRole('dialog', { name: /AI Chat about brand ads/i })).toBeVisible()
  })

  test('chat header shows brand name and model', async ({ page }) => {
    await page.getByRole('button', { name: /Ask AI about these ads/i }).click()
    await expect(page.getByText(/Ask AI about Nike/i)).toBeVisible()
    await expect(page.getByText('claude-sonnet-4-6')).toBeVisible()
  })

  test('suggestion chips are shown when chat is empty', async ({ page }) => {
    await page.getByRole('button', { name: /Ask AI about these ads/i }).click()
    await expect(page.getByText(/What messaging angles are used most/i)).toBeVisible()
    await expect(page.getByText(/What patterns do you see/i)).toBeVisible()
  })

  test('clicking a suggestion sends that question and streams response', async ({ page }) => {
    await page.route(CHAT_ROUTE, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: chatSseBody('Urgency messaging dominates.'),
      }),
    )

    await page.getByRole('button', { name: /Ask AI about these ads/i }).click()
    await page.getByText(/What messaging angles are used most/i).click()

    await expect(
      page.getByText(/What messaging angles are used most/i, { exact: false }),
    ).toBeVisible()
    await expect(page.getByText(/Urgency messaging dominates/i)).toBeVisible({ timeout: 10_000 })
  })

  test('typing a question and pressing Send works', async ({ page }) => {
    await page.route(CHAT_ROUTE, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: chatSseBody('Short punchy headlines.'),
      }),
    )

    await page.getByRole('button', { name: /Ask AI about these ads/i }).click()
    await page.getByRole('textbox').fill('What copy patterns exist?')
    await page.getByRole('button', { name: /send/i }).click()

    await expect(page.getByText('What copy patterns exist?')).toBeVisible()
    await expect(page.getByText(/Short punchy headlines/i)).toBeVisible({ timeout: 10_000 })
  })

  test('pressing Enter in textarea sends the message', async ({ page }) => {
    await page.route(CHAT_ROUTE, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: chatSseBody('Answer here.'),
      }),
    )

    await page.getByRole('button', { name: /Ask AI about these ads/i }).click()
    await page.getByRole('textbox').fill('Quick question')
    await page.getByRole('textbox').press('Enter')

    await expect(page.getByText(/Answer here/i)).toBeVisible({ timeout: 10_000 })
  })

  test('suggestions hidden after first message sent', async ({ page }) => {
    await page.route(CHAT_ROUTE, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: chatSseBody('Response.'),
      }),
    )

    await page.getByRole('button', { name: /Ask AI about these ads/i }).click()
    await page.getByText(/What messaging angles are used most/i).click()
    await expect(page.getByText(/Response/i)).toBeVisible({ timeout: 10_000 })

    // Suggestion chips should be gone once messages exist
    const chips = page.locator('button', { hasText: /What messaging angles are used most/i })
    await expect(chips).toHaveCount(0)
  })

  test('shows error alert when chat fails', async ({ page }) => {
    await page.route(CHAT_ROUTE, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'PROVIDER_ERROR', message: 'AI unavailable' }),
      }),
    )

    await page.getByRole('button', { name: /Ask AI about these ads/i }).click()
    await page.getByRole('textbox').fill('What patterns?')
    await page.getByRole('button', { name: /send/i }).click()

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 })
  })

  test('close button dismisses the chat dialog', async ({ page }) => {
    await page.getByRole('button', { name: /Ask AI about these ads/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.getByRole('button', { name: /close chat/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('send button disabled when input is empty', async ({ page }) => {
    await page.getByRole('button', { name: /Ask AI about these ads/i }).click()
    await expect(page.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  test('chat resets when a new search is performed', async ({ page }) => {
    await page.route(CHAT_ROUTE, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: chatSseBody('Answer.'),
      }),
    )

    // Open chat and send a message
    await page.getByRole('button', { name: /Ask AI about these ads/i }).click()
    await page.getByRole('textbox').fill('First question')
    await page.getByRole('button', { name: /send/i }).click()
    await expect(page.getByText(/Answer/i)).toBeVisible({ timeout: 10_000 })

    // Close chat, do a new search
    await page.getByRole('button', { name: /close chat/i }).click()
    await page.getByLabel(/Brand name/i).fill('Adidas')
    await page.getByRole('button', { name: /^Search$/i }).click()
    await expect(page.getByTestId('ad-card')).toBeVisible()

    // Re-open chat — should be empty
    await page.getByRole('button', { name: /Ask AI about these ads/i }).click()
    await expect(page.getByText(/What messaging angles are used most/i)).toBeVisible()
    await expect(page.getByText('First question')).not.toBeVisible()
  })

  test('chat can be closed and reopened without crashing (hooks order regression)', async ({
    page,
  }) => {
    await page.route(CHAT_ROUTE, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: chatSseBody('Answer.'),
      }),
    )

    // Open → send → close → reopen — all three state transitions must work without ErrorBoundary
    await page.getByRole('button', { name: /Ask AI about these ads/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.getByRole('button', { name: /close chat/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()

    await page.getByRole('button', { name: /Ask AI about these ads/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Send a message to confirm the component is fully functional after reopen
    await page.getByRole('textbox').fill('Still working?')
    await page.getByRole('button', { name: /send/i }).click()
    await expect(page.getByText(/Answer/i)).toBeVisible({ timeout: 10_000 })

    // ErrorBoundary fallback must never appear
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible()
  })

  test('SSE-level error event surfaces to UI — not swallowed as spinner', async ({ page }) => {
    // Simulates Claude returning an error mid-stream (HTTP 200 + SSE error payload)
    const sseErrorBody = 'data: {"error":"PROVIDER_ERROR"}\n\ndata: [DONE]\n\n'
    await page.route(CHAT_ROUTE, (route) =>
      route.fulfill({ status: 200, contentType: 'text/event-stream', body: sseErrorBody }),
    )

    await page.getByRole('button', { name: /Ask AI about these ads/i }).click()
    await page.getByRole('textbox').fill('Trigger stream error')
    await page.getByRole('button', { name: /send/i }).click()

    // Error must be shown — not a perpetual "Thinking..." spinner
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/thinking/i)).not.toBeVisible()
  })

  test('chat recovers after SSE error — next message sends without 400 (empty history filter)', async ({
    page,
  }) => {
    let callCount = 0
    await page.route(CHAT_ROUTE, (route) => {
      callCount++
      if (callCount === 1) {
        // First call: SSE-level error (leaves AI message with text='')
        route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: 'data: {"error":"PROVIDER_ERROR"}\n\ndata: [DONE]\n\n',
        })
      } else {
        // Second call: must succeed — empty AI message must NOT be in history
        route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: chatSseBody('Recovery response.'),
        })
      }
    })

    await page.getByRole('button', { name: /Ask AI about these ads/i }).click()

    // First message — fails
    await page.getByRole('textbox').fill('First message')
    await page.getByRole('button', { name: /send/i }).click()
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 })

    // Second message — must succeed (not 400 from empty content in history)
    await page.getByRole('textbox').fill('Second message')
    await page.getByRole('button', { name: /send/i }).click()
    await expect(page.getByText(/Recovery response/i)).toBeVisible({ timeout: 10_000 })

    expect(callCount).toBe(2)
  })

  test('multi-turn: follow-up question appears in conversation', async ({ page }) => {
    let callCount = 0
    await page.route(CHAT_ROUTE, (route) => {
      callCount++
      const body =
        callCount === 1
          ? chatSseBody('Urgency is the main angle.')
          : chatSseBody('Social proof is secondary.')
      route.fulfill({ status: 200, contentType: 'text/event-stream', body })
    })

    await page.getByRole('button', { name: /Ask AI about these ads/i }).click()
    await page.getByRole('textbox').fill('First question')
    await page.getByRole('button', { name: /send/i }).click()
    await expect(page.getByText(/Urgency is the main angle/i)).toBeVisible({ timeout: 10_000 })

    await page.getByRole('textbox').fill('What else?')
    await page.getByRole('button', { name: /send/i }).click()
    await expect(page.getByText(/Social proof is secondary/i)).toBeVisible({ timeout: 10_000 })

    expect(callCount).toBe(2)
  })
})
