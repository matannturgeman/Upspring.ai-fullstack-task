# Code Review — Code Smells

Issues that won't crash the app today but make it harder to maintain, extend, or debug.

---

## SMELL-1 — Duplicated SSE boilerplate in `AnalysisController`

**File:** `backend/src/controllers/AnalysisController.ts`

Both `streamAnalysis` and `streamChat` contain identical SSE setup:
```ts
res.setHeader('Content-Type', 'text/event-stream')
res.setHeader('Cache-Control', 'no-cache')
res.setHeader('Connection', 'keep-alive')
res.flushHeaders()

const writeChunk = (payload: unknown) => {
  const validated = AnalysisSseChunkSchema.parse(payload)
  res.write(`data: ${JSON.stringify(validated)}\n\n`)
}

try {
  for await (const chunk of this.claude.streamXxx(...)) {
    writeChunk({ text: chunk })
  }
  res.write('data: [DONE]\n\n')
} catch (err) {
  console.error('... stream error:', err)
  writeChunk({ error: 'PROVIDER_ERROR' })
  res.write('data: [DONE]\n\n')
} finally {
  res.end()
}
```

**Fix:** Extract a private helper that takes the generator and handles the full SSE lifecycle:
```ts
private async streamToSSE(
  res: Response,
  generator: AsyncGenerator<string>,
  label: string
): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const write = (payload: unknown) => {
    res.write(`data: ${JSON.stringify(AnalysisSseChunkSchema.parse(payload))}\n\n`)
  }

  try {
    for await (const chunk of generator) write({ text: chunk })
    res.write('data: [DONE]\n\n')
  } catch (err) {
    console.error(`[${label}] stream error:`, err)
    write({ error: 'PROVIDER_ERROR' })
    res.write('data: [DONE]\n\n')
  } finally {
    res.end()
  }
}
```

---

## SMELL-2 — `CompetitorsController` uses manual type narrowing instead of Zod

**File:** `backend/src/controllers/CompetitorsController.ts:10`

```ts
const { brandName, brandId } = req.body as { brandName?: unknown; brandId?: unknown }

if (!brandName || typeof brandName !== 'string' || !brandId || typeof brandId !== 'string') {
  res.status(400).json({ error: true, message: 'brandName and brandId required', code: 'MISSING_PARAMS' })
  return
}
```

Every other controller uses a Zod schema. This one does not — and consequently has no ObjectId format check on `brandId` (see BUG-5). It also returns a different error shape (`{ error: true, message, code }`) than every other controller (`{ error: 'CODE', message }`).

**Fix:** Add `CompetitorBodySchema` and validate with `.safeParse()`, same pattern as `AnalysisBodySchema`.

---

## SMELL-3 — `max_tokens: 1024` too low for brand chat

**File:** `backend/src/services/ClaudeService.ts` — `streamChat` and `streamAnalysis`

`streamAnalysis` at 1024 is borderline — the 6-point structured analysis can fill it. `streamChat` at 1024 is definitely too low. A response covering messaging angles across 20 ads with examples and reasoning will routinely hit the limit mid-sentence, producing a truncated answer with no indication to the user that the response was cut off.

**Fix:** Set `max_tokens: 2048` for `streamChat`. Consider surfacing a `finish_reason === 'max_tokens'` check and appending a note to the streamed response.

---

## SMELL-4 — Stale closure in `useChat` is correct but looks like a bug

**File:** `frontend/src/hooks/useChat.ts`

```ts
const userMsgId = crypto.randomUUID()
addChatMessage({ id: userMsgId, role: 'user', text: userText })  // updates store

const aiMsgId = crypto.randomUUID()
addChatMessage({ id: aiMsgId, role: 'ai', text: '', streaming: true })  // updates store

// chatMessages here is the PRE-UPDATE snapshot — intentional
const history = [
  ...chatMessages.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
  { role: 'user' as const, content: userText },
]
```

`chatMessages` is the Zustand state captured at render time. The `addChatMessage` calls update the store, but the React component hasn't re-rendered yet, so `chatMessages` is still the old array. This is *correct* — the history should not include the blank AI placeholder or the user message being sent. But this will look like a bug to anyone who reads it next.

**Fix:** Add a comment:
```ts
// chatMessages is the pre-send snapshot (captured at render time).
// We intentionally exclude the user/AI messages just added above —
// those are UI state only; the API receives the prior history + new user message.
```

---

## SMELL-5 — `let scrapeResult` untyped, leaks scope

**File:** `backend/src/services/AdsService.ts:36–38`

```ts
let scrapeResult
try {
  scrapeResult = await this.scrapers.scrape(brand, { limit })
} catch (err) {
  // ...
  throw err
}

if (scrapeResult.empty) { ... }
```

`scrapeResult` is inferred as `any` because it's declared without a type and assigned inside a try block. TypeScript can't narrow it after the catch. If the catch block ever changes to not re-throw (easy mistake), `scrapeResult` would be `undefined` at `scrapeResult.empty` and produce a silent runtime crash.

**Fix:**
```ts
const scrapeResult: ScrapeResult = await this.scrapers.scrape(brand, { limit }).catch(async err => {
  await SearchSession.findByIdAndUpdate(session._id, { status: 'error', errorMessage: err.message })
  throw err
})
```

---

## SMELL-6 — `ScraperRegistry` reads env var on every call

**File:** `backend/src/scrapers/ScraperRegistry.ts:20`

```ts
async scrape(brandName: string, options?: ScrapeOptions): Promise<ScrapeResult> {
  // ...
  const priority = (process.env.SCRAPER_PRIORITY ?? 'apify').split(',')...
```

`process.env.SCRAPER_PRIORITY` is read and parsed (split, trim, filter, map) on every incoming request. The value can't change at runtime in a normal deployment. Reading it in the constructor and storing as `this.priority` is both cheaper and clearer about intent.

**Fix:**
```ts
private readonly priority: BaseScraper[]

constructor() {
  const names = (process.env.SCRAPER_PRIORITY ?? 'apify').split(',').map(s => s.trim()).filter(Boolean)
  this.priority = names.map(name => this.registry[name]).filter(Boolean)
  if (this.priority.length === 0) throw new Error(`No valid scrapers in SCRAPER_PRIORITY`)
}
```

---

## SMELL-7 — `BrandChat` suggestion handlers recreated every render

**File:** `frontend/src/components/BrandChat/BrandChat.tsx`

`handleSend` and `handleSuggestion` are plain functions defined inside the component body. They're recreated on every render (e.g. every keystroke in the textarea updates `input` state, triggering a re-render). Each suggestion button gets a new `onClick` reference each time, breaking referential equality for React's reconciler.

**Fix:** Wrap with `useCallback`:
```ts
const handleSend = useCallback(() => {
  const text = input.trim()
  if (!text || chatLoading) return
  setInput('')
  void sendMessage(currentBrand!._id, text)
}, [input, chatLoading, currentBrand, sendMessage])
```
