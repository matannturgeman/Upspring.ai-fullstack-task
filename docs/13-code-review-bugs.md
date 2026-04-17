# Code Review — Bugs

Confirmed bugs with reproduction path and fix. Ordered by severity.

---

## BUG-1 — Delete-before-insert with no rollback

**File:** `backend/src/services/AdsService.ts:60–81`

**Code:**
```ts
await Ad.deleteMany({ brandId: brandDoc._id })      // ads permanently gone
await RawAd.deleteMany({ _id: { $in: oldRawIds } })

const adDocs = await Promise.all(                   // if any extraction throws...
  scrapeResult.ads.map(async raw => { ... })
)
await Ad.insertMany(adDocs)                         // ...never reached
```

**Reproduction:** Any scrape where one ad's extraction throws (e.g. Claude API times out mid-scrape, or a malformed raw ad hits an unhandled code path). The old ads are already deleted. `insertMany` never runs. The brand now has `adCount > 0` but zero ads in the DB. The next cached lookup finds the brand, queries ads, gets an empty array, and returns stale empty data to the user with no error.

**Fix:** Insert first, delete after confirmation.
```ts
const insertedAds = await Ad.insertMany(adDocs)  // confirm success first
await Ad.deleteMany({ brandId: brandDoc._id })   // then remove old
```
Long-term: replica set + `session.withTransaction()`.

---

## BUG-2 — `Promise.all` on extractions: one bad ad kills the entire search

**File:** `backend/src/services/AdsService.ts:65`

**Code:**
```ts
const adDocs = await Promise.all(
  scrapeResult.ads.map(async raw => {
    // ...
    const { extractionMethod, ...fields } = await this.extraction.extract(safeRaw)
    return { ... }
  })
)
```

**Reproduction:** Apify returns 20 ads. Ad #7 has a snapshot structure that causes `codeExtract` to return null and Claude's `extractFields` to throw (e.g. 429 rate limit). `Promise.all` rejects immediately. The user gets a 502. All 19 other valid ads are discarded.

**Fix:** Use `Promise.allSettled`, filter fulfilled results, log rejections.
```ts
const results = await Promise.allSettled(
  scrapeResult.ads.map(async raw => { ... })
)
const adDocs = results
  .filter((r): r is PromiseFulfilledResult<typeof r extends PromiseFulfilledResult<infer T> ? T : never> => r.status === 'fulfilled')
  .map(r => r.value)

if (adDocs.length === 0) throw new Error('All ad extractions failed')
// proceed with partial data — partial: true
```

---

## BUG-3 — No AbortController in `useAds`: last response wins, not last request

**File:** `frontend/src/hooks/useAds.ts:23`

**Code:**
```ts
async function search(brandName: string, ...) {
  setAdsLoading(true)
  // no abort of any previous in-flight request
  const result = await fetchAds(brandName, options)
  setCurrentBrand(result.brand)
  setAds(result.ads)
}
```

**Reproduction:**
1. User searches "Nike" — slow Apify response, takes 8s.
2. User immediately searches "Adidas" — cache hit, responds in 200ms.
3. Adidas renders correctly.
4. 8 seconds later, Nike response arrives. `setCurrentBrand(Nike)` and `setAds(nikeAds)` run.
5. UI now shows Nike ads under whatever title was last set. No error surfaced.

`useAnalysis` and `useChat` both use `AbortController` correctly — `useAds` is the odd one out.

**Fix:**
```ts
const abortRef = useRef<AbortController | null>(null)

async function search(brandName: string, options = {}) {
  abortRef.current?.abort()
  abortRef.current = new AbortController()

  // ...
  const result = await fetchAds(brandName, { ...options, signal: abortRef.current.signal })
  // ...
}
```
Also pass `signal` through `fetchAds` → axios `{ signal }` option.

---

## BUG-4 — Unhandled rejection on DB connect crashes silently

**File:** `backend/server.ts:43`

**Code:**
```ts
connectDB().then(() => app.listen(PORT, () => console.log(`Server running on :${PORT}`)))
// no .catch()
```

**Reproduction:** MongoDB is unavailable and all 3 retry attempts in `connectDB` fail. The returned promise rejects. Without a `.catch()`, Node emits `UnhandledPromiseRejection`. In Node 15+, this crashes the process with exit code 1 — but the error message in logs is just the raw Mongoose connection error with no context that it was a startup failure. The HTTP server was never started, but there's no clean log saying so.

**Fix:**
```ts
connectDB()
  .then(() => app.listen(PORT, () => console.log(`Server running on :${PORT}`)))
  .catch(err => {
    console.error('[startup] DB connection failed, exiting:', err)
    process.exit(1)
  })
```

---

## BUG-5 — Unvalidated string `brandId` hits Mongoose, surfaces as 500

**File:** `backend/src/services/CompetitorService.ts:32`

**Code:**
```ts
async findCompetitors(brandName: string, brandId: string): Promise<CompetitorResult> {
  // ...
  const ads = await Ad.find({ brandId }).lean().limit(10)
```

**Reproduction:** A client sends `{ brandName: "Nike", brandId: "not-an-objectid" }`. `CompetitorsController` does manual type checks (string? non-empty?) but no ObjectId format validation. The string reaches `Ad.find({ brandId: "not-an-objectid" })`. Mongoose tries to cast it to `ObjectId`, throws a `CastError`, which bubbles up through `next(err)` as an unhandled 500 with a Mongoose internal error message sent to the client.

Every other controller uses the Zod ObjectId regex. This one does not.

**Fix:** Add a `CompetitorBodySchema` in `analysis.schemas.ts`:
```ts
export const CompetitorBodySchema = z.object({
  brandName: z.string().min(1).max(200),
  brandId: z.string().regex(OBJECT_ID_REGEX, 'brandId must be a valid ObjectId'),
})
```
Validate in `CompetitorsController.findCompetitors` before calling the service.

---

## BUG-6 — Scrapers eagerly instantiated: missing API keys fail silently at call time

**File:** `backend/src/scrapers/ScraperRegistry.ts:9–13`

**Code:**
```ts
private readonly registry: Record<string, BaseScraper> = {
  apify: new ApifyScraper(),
  scrapingbee: new ScrapingBeeScraper(),
  rapidapi: new RapidApiScraper(),
}
```

**Reproduction:** Dev environment has only `APIFY_API_TOKEN` set. `SCRAPINGBEE_API_KEY` and `RAPIDAPI_KEY` are undefined. All three scrapers are instantiated at startup. `ScrapingBeeScraper` and `RapidApiScraper` store `undefined` as their API key. No error at startup. When Apify fails and the registry falls back to ScrapingBee, it makes an authenticated request with `apiKey=undefined` in the URL, gets a 401, and logs a confusing auth error rather than "key not configured."

**Fix:** Validate the key in each scraper's constructor and throw early:
```ts
constructor() {
  const key = process.env.SCRAPINGBEE_API_KEY
  if (!key) throw new Error('SCRAPINGBEE_API_KEY not set')
  this.apiKey = key
}
```
Then in `ScraperRegistry`, lazy-init scrapers and catch construction errors so an unconfigured scraper is simply skipped from the registry with a startup warning.
