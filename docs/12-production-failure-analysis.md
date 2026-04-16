# Production Failure Analysis

Ranked by likelihood of occurrence × business impact. Each entry covers what breaks, why, how bad it is, and what the fix looks like.

---

## Tier 1 — Will break under real traffic

### 1. Concurrent search race condition (data loss)

**What breaks:** Two users search for the same brand at the same time. Both get a cache miss. Both trigger a scrape. Both then execute:

```
DELETE RawAds WHERE brandId = X
DELETE Ads WHERE brandId = X
INSERT new RawAds ...
INSERT new Ads ...
```

These writes interleave. One request deletes the other's freshly inserted rows before they're read. The brand ends up with zero or partial ads in the DB until the next scrape.

**Why it happens:** `AdsService` has no write lock, no deduplication, and Mongoose has no transactions on a standalone MongoDB node.

**Severity:** High — silent data corruption, no error shown to users.

**Fix:**
- Short-term: Check `SearchSession` for an in-progress fetch before starting a new one. If one is running, poll and return its result.
- Proper: MongoDB replica set (required for transactions) + `session.withTransaction()` around the delete/insert block.
- Alternative: `Brand.findOneAndUpdate` with `$set` rather than delete + reinsert, so partial failures leave old data intact.

---

### 2. Scraper timeout cascades into user-facing 30s hang

**What breaks:** ApifyScraper has a 120s internal timeout but the global Express middleware cuts the connection at 30s. The scraper is still running in the background when Express sends a 504. If ScrapingBee or RapidAPI are also slow, the user sees a hang for the full 30s regardless.

**Why it happens:** There is no per-scraper timeout. The 120s Apify timeout and the 30s request timeout are independent. The middleware fires and closes the response but the Apify actor call continues consuming memory and API quota.

**Severity:** High — every slow or degraded scrape turns into a 30s user-facing hang. At scale, each hung connection holds an SSE or HTTP connection open.

**Fix:**
- Wrap each scraper call in `Promise.race([scrape(), timeout(10_000)])`.
- ApifyScraper specifically: reduce actor timeout to 25s and surface Apify's `partial` flag rather than waiting for the full run.
- Add per-scraper metrics so the slowest scraper is deprioritised automatically.

---

### 3. SSE stream silently dies on network interruption

**What breaks:** The user is mid-analysis and their connection drops for a second (mobile, VPN reconnect, etc.). The SSE stream closes. The client `ReadableStream` reader throws. `useAnalysis` / `useChat` show an error. The half-generated answer is lost.

**Why it happens:** SSE is a one-shot HTTP response. There is no resumption protocol. The server writes chunks to `res.write()`; if the socket closes, subsequent writes are silently dropped (`res.writableEnded` becomes true but the generator keeps yielding). No partial result is saved anywhere.

**Severity:** Medium-High — degrades UX significantly on unreliable connections. Common on mobile.

**Fix:**
- Store each AI response in MongoDB as it streams (`Analysis.create({adId, text: ''})`, then `$set text` on each chunk). On reconnect, client fetches cached response.
- Or: use WebSocket with client-side reconnection and server-side cursor position.
- Minimum viable: increase `max_tokens` and add a server-side retry if the Claude stream closes before `[DONE]`.

---

### 4. Image proxy has no size or rate limit

**What breaks:** A malicious (or just overly eager) client hits `/api/proxy/image` repeatedly with large image URLs. Each request opens a streaming connection to an upstream CDN and forwards the bytes. No size check. No rate limit on this endpoint. Under load:
- Memory climbs as responses buffer in Node.js streams.
- File descriptor count climbs from open connections.
- Node process crashes with OOM or EMFILE.

**Why it happens:** The proxy streams to the client, which is correct, but there is no `Content-Length` guard and no rate limiting beyond the global 500 req/min (dev) or 30 req/min (prod) which covers the entire API, not just the proxy.

**Severity:** Medium-High — a single large image or a burst of image requests can crash the server.

**Fix:**
- Check `Content-Length` header from upstream before proxying; reject anything over 10MB.
- Add a dedicated rate limit on `/api/proxy/image` (e.g. 200 req/min per IP).
- Long-term: serve images through a CDN (Cloudflare R2, Cloudinary) so the Express server is never in the image data path.

---

### 5. Brand TTL too short, cache miss storms possible

**What breaks:** Brand TTL is 1 hour. After midnight (or any 1-hour window), all cached brands expire simultaneously. The next search for any of those brands triggers a live scrape. If many users search the same popular brand just after expiry, all get cache misses and all trigger Apify simultaneously — hammering the API quota and the 30s timeout window.

**Why it happens:** A single MongoDB TTL index on `Brand.lastFetched` with `expireAfterSeconds: 3600` causes thundering herd when many brands expire together.

**Severity:** Medium — spiky API cost and degraded response time after cache expiry.

**Fix:**
- Stagger TTL: add random jitter to `lastFetched` (±10min) so brands don't expire in unison.
- Serve stale: change cache logic to return stale data immediately and trigger a background refresh. User always gets a fast response; data is eventually consistent.
- Pre-warm: schedule a job to refresh popular brands before they expire.

---

## Tier 2 — Will break under specific conditions

### 6. Claude API rate limits or outages kill all AI features

**What breaks:** Claude API returns 429 or 5xx. `streamAnalysis`, `streamChat`, and `extractFields` all throw. There is no retry logic anywhere in `ClaudeService`. Single-ad analysis shows an error. Brand chat shows an error. If `extractFields` fails during a scrape, that ad's extraction falls back to the code extractor — but if the code score was already < 2, the ad is saved with sparse data.

**Severity:** Medium — entire AI feature surface goes dark. With `extractFields` failures during scraping, a percentage of ads have missing fields with no visibility into which ones.

**Fix:**
- Add exponential backoff retry (3 attempts, 1s / 2s / 4s) for `streamAnalysis` and `streamChat`.
- `extractFields` already has a graceful fallback; add a `console.error` with ad ID so sparse extractions are traceable.
- Circuit breaker: if Claude fails 5 times in 60 seconds, stop sending requests and return a "AI temporarily unavailable" message immediately.

---

### 7. MongoDB standalone — no replica set, no transactions

**What breaks:** Any write failure mid-operation leaves the DB in an inconsistent state:
- `RawAd.insertMany` fails halfway → some raw ads stored, some not; no way to know which.
- `Brand.findOneAndUpdate` succeeds, `Ad.insertMany` then fails → brand exists with adCount > 0 but no ads.
- MongoDB connection drops mid-write → partial write committed, no rollback.

Transactions require a replica set. Running standalone in Docker (the default setup) means all multi-document writes are non-atomic.

**Severity:** Medium — data integrity bugs that are invisible until users see empty or duplicate ad lists.

**Fix:**
- Run MongoDB as a 1-node replica set even in development (`mongod --replSet rs0`). This enables transactions at no infrastructure cost.
- Wrap the delete + insert sequence in `session.withTransaction()`.
- Add a `Brand.adCount` reconciliation job that runs every hour and fixes mismatches.

---

### 8. No request deduplication for scrapes

**What breaks:** The search bar has no debounce. A user who double-submits (or a script that calls the API twice in quick succession) triggers two separate Apify actor runs for the same brand. Each run costs API credits and time. If both complete, the second write wins; if they interleave, see failure #1.

**Severity:** Low-Medium — mostly an API cost issue, but compounds with failure #1.

**Fix:**
- Check `SearchSession.findOne({brand: normalizedName, status: 'fetching'})` at the start of `AdsService.getAds`. If found, wait for it to complete (poll or use change stream) rather than starting a new scrape.
- Frontend: disable the search button for 500ms after submit.

---

### 9. CompetitorService fallback is silent and brittle

**What breaks:** Perplexity fails (429, timeout, network). The code logs a warning and falls back to Claude. Claude's `findCompetitorsFromAds` receives the top 10 ads' text as context — but if the brand has zero ads in the DB (scrape just expired the cache), it gets an empty string. Claude may hallucinate competitors with no grounding in actual ad data.

Additionally, `Brand.findByIdAndUpdate` is called without `await` — it's fire-and-forget. If it fails, the competitors are shown in the UI but not persisted. Next refresh, they're gone.

**Severity:** Low-Medium — incorrect competitor suggestions with no visibility, silent persistence failure.

**Fix:**
- `await` the `findByIdAndUpdate` call and log failures.
- Pass the brand name to Claude even when no ads exist, and note in the prompt that no ad data is available.
- Show different confidence badges: "based on web search" vs. "based on ad copy" vs. "AI reasoning only (no ad data)".

---

### 10. Perplexity / Claude JSON parsing is fragile

**What breaks:** Both `PerplexityService` and `ClaudeService.findCompetitorsFromAds` extract JSON using greedy regex:

```ts
const match = text.match(/\[[\s\S]*\]/)    // Perplexity
const match = text.match(/\{[\s\S]*\}/)    // extractFields
```

A greedy `[\s\S]*` will match the *largest* possible string. If the model returns markdown with two JSON blocks, the regex captures everything from the first `[` to the last `]` — an invalid JSON string. `JSON.parse` throws. The entire competitor discovery fails with a cryptic parse error.

**Severity:** Low-Medium — breaks occasionally when Claude adds explanatory text around the JSON.

**Fix:**
- Use Claude's `tool_use` / structured output (JSON mode) rather than regex extraction.
- Short-term: parse all JSON candidates, return the first valid array. `text.match(/\[[\s\S]*?\]/g)` with non-greedy + filter by `JSON.parse` success.

---

## Tier 3 — Security & operational risks

### 11. No authentication on any endpoint

All API endpoints are public. Anyone who finds the backend URL can:
- Trigger unlimited Apify scrapes (each costs credits).
- Call Claude API endpoints repeatedly (each costs tokens).
- Abuse the image proxy as a general-purpose HTTP proxy.

The rate limiter (30 req/min production) is per IP and easily bypassed with distributed requests.

**Fix:** Add API key authentication for the backend at minimum. For a real product: JWT with user accounts, per-user rate limits, and quota tracking.

---

### 12. No graceful shutdown

When the Node process receives `SIGTERM` (during a deployment or container restart), it exits immediately. Any in-flight SSE streams are cut without `[DONE]`. Any Apify actors that were started are orphaned (they continue running and consuming credits). Any Mongoose write in progress may be half-committed.

**Fix:**
```ts
process.on('SIGTERM', async () => {
  server.close()          // stop accepting new connections
  await mongoose.disconnect()
  process.exit(0)
})
```
For Apify actors: call `client.run.abort(runId)` before shutdown.

---

### 13. Error handler leaks internal details

`errorHandler.ts` calls `console.error(err)` which in production logs full stack traces, internal file paths, and MongoDB query details to stdout — which is often shipped to a log aggregator visible to non-engineers.

The response also sends `err.message` directly to the client in some paths, which may include internal service names, DB hostnames, or API endpoints.

**Fix:**
- Map all errors to safe user-facing messages before sending.
- Use structured logging (Winston, Pino) with log levels. Never log raw error objects in production.
- Add Sentry or equivalent for server-side error tracking.

---

### 14. Dockerfile runs as root

The `Dockerfile` has no `USER` directive. The Node process runs as root inside the container. If there is a path traversal or code injection vulnerability, the attacker has root access to the container filesystem.

**Fix:**
```dockerfile
RUN addgroup -S app && adduser -S app -G app
USER app
```

---

## Summary Table

| # | Failure | Likelihood | Impact | Effort to fix |
|---|---------|-----------|--------|---------------|
| 1 | Concurrent search race condition | High | Data loss | Medium |
| 2 | Scraper timeout cascades | High | 30s UX hang | Low |
| 3 | SSE stream dies on disconnect | High | Lost AI response | High |
| 4 | Image proxy has no size/rate limit | Medium | Server crash | Low |
| 5 | Brand TTL thundering herd | Medium | API cost spike | Low |
| 6 | Claude API outage | Medium | All AI features down | Medium |
| 7 | No DB transactions | Medium | Data corruption | Medium |
| 8 | No request deduplication | Medium | API cost waste | Low |
| 9 | Competitor fallback silent failures | Low | Bad data, no visibility | Low |
| 10 | Greedy JSON regex | Low | Competitor discovery crash | Low |
| 11 | No authentication | High | API abuse / cost blowout | High |
| 12 | No graceful shutdown | Medium | Mid-stream data loss | Low |
| 13 | Error handler leaks internals | Medium | Security / privacy | Low |
| 14 | Docker runs as root | Low | Container escape risk | Low |

---

## Recommended Fix Order for Production

1. **Scraper timeout per-scraper** (#2) — 1 hour, prevents the most common user-facing hang.
2. **Image proxy size + rate limit** (#4) — 2 hours, prevents the easiest crash vector.
3. **Request deduplication in AdsService** (#8) — 2 hours, blocks concurrent scrape race.
4. **Graceful shutdown** (#12) — 30 minutes, prevents orphaned Apify actors.
5. **MongoDB replica set + transactions** (#7, #1) — 1 day, eliminates data loss risk.
6. **Claude retry with exponential backoff** (#6) — 2 hours, makes AI resilient to transient failures.
7. **Authentication** (#11) — 1 day, required before any public exposure.
8. **SSE resumption via DB-backed storage** (#3) — 2 days, biggest UX improvement under real conditions.
