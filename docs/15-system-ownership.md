# System Ownership — Mental Model

Answers the five ownership questions for Upspring.ai as currently built.

---

## 1. What parts of the system are most expensive?

### Cost ranking (money + compute)

| Component | Cost driver | Notes |
|-----------|------------|-------|
| **Claude Sonnet — streamChat** | ~$3/MTok input, $15/MTok output | Sends up to 10 images + 20 ads of text + full conversation history on every message. A 3-turn chat with images can easily hit 10k input tokens. |
| **Claude Sonnet — streamAnalysis** | Per-ad, on demand | 1 image + structured prompt per ad. Cheaper per call but scales with ad count × unique user interactions. |
| **Claude Haiku — extractFields** | Cheap, but called once per raw ad | 20 ads per scrape = 20 Haiku calls. Cost is low but it's the only truly batchable LLM call — and we're not batching it. |
| **Claude Sonnet — findCompetitors** | Single call, ~500 output tokens | One per brand discovery. Negligible unless competitors are re-fetched often. |
| **Apify scraping** | Per actor run (Apify charges by CPU/memory seconds) | A single brand scrape costs ~$0.01–0.05 depending on ad count. The cache (brand TTL) controls how often this runs. |
| **Image proxy** | Egress + memory | Each proxied image is fetched from CDN and streamed through the Node process. No size limit. No caching. |
| **MongoDB** | Reads cheap; writes moderate | `insertMany` of 20 ads with raw data is the heaviest write. Read path is indexed on `brandId`. |

### Biggest lever

**Claude API accounts for the majority of cost.** Specifically `streamChat` with image context because:
- It sends images on every conversation turn (images are injected into the first message of the history)
- Conversation history grows with each message — input tokens grow quadratically in long chats
- `max_tokens: 2048` means output can be significant too

---

## 2. What would break first under heavier usage?

### Failure order under increasing load

**~10 concurrent users**
- No issues. Node handles 10 concurrent SSE streams trivially.

**~50 concurrent users**
- **Claude API rate limits** hit first. Anthropic's default tier allows ~50 requests/min for Sonnet. Each chat message is one request. 50 users each sending a message = immediate 429s.
- **Apify concurrent actor cap** reached if many users search different brands simultaneously.

**~200 concurrent users**
- **MongoDB connection pool exhausted.** Mongoose defaults to a pool of 5. Under 200 concurrent requests, most will queue waiting for a connection. Timeouts cascade.
- **Image proxy memory pressure.** 200 requests each fetching a 500KB image = 100MB+ in-flight in the Node process. One OOM kill brings down the entire server.
- **SSE connections pile up.** Each open chat modal holds an HTTP connection open. At 200 users with chat open, 200 persistent connections on a single Node process. Node handles this, but combined with other load it degrades.

**~1000 concurrent users**
- **Single process bottleneck.** The backend is a single Node process with no clustering. CPU-bound JSON parsing, Mongoose query building, and SSE writes all compete on one thread.
- **Brand race condition triggers.** Multiple users searching the same brand simultaneously all miss cache (TTL not yet set), all scrape in parallel, all call `extractFields` 20× each, all try to upsert the same brand document. Mongoose upsert is not atomic at application level — last writer wins, but all the Claude API calls ran and were billed.

### Single most likely first failure
**Claude API rate limit (429).** It requires zero user volume above what one active session generates, and the current code has no retry logic, no queue, and no circuit breaker.

---

## 3. Where are failures most likely to happen?

### By probability × impact

| Failure | Probability | Impact | Currently handled? |
|---------|------------|--------|-------------------|
| Claude API 429 / 500 | High | Chat and analysis unusable | Partial — error surfaces to UI, but no retry |
| Apify timeout / empty result | Medium | Search fails | Yes — error propagated, session logged |
| MongoDB connection drop | Low-Medium | Total outage | Partial — retry in connectDB, but no per-request retry |
| Image proxy OOM | Medium (under load) | Process crash = total outage | No — no size limit, no stream abort on disconnect |
| Brand race condition (concurrent scrape) | Medium | Duplicate API calls billed, no user impact | No |
| Claude `extractFields` 429 mid-batch | Medium | Partial ad set returned | Yes — `Promise.allSettled` saves partial results |
| SSE stream disconnect (user closes tab) | High (normal usage) | In-flight Claude call completes anyway — wasted tokens | Partial — AbortController on frontend, but backend generator keeps running |
| Mongoose CastError on bad input | Low (was High before BUG-5 fix) | 500 to client | Fixed — Zod validates all ObjectIds |
| Scraper key not configured | Low (dev only) | Startup throws, no server | Fixed — lazy init throws clearly at startup |

### Highest-risk code path

`AdsService.getAds()` on a cache miss:
1. Scrape (external, can timeout)
2. 20× `extractFields` via Claude Haiku (external, can 429)
3. `insertMany` (DB write)
4. Delete stale records

Four external/network operations in sequence. Any one can fail. Currently:
- Scrape failure: caught, session logged, error thrown ✅
- Extraction failures: `allSettled` handles partial ✅
- Insert failure: throws, stale data preserved ✅
- Delete failure: throws after insert — leaves orphaned raw ads (minor) ⚠️

---

## 4. How would you evolve the system if scale or reliability became important?

### Reliability first (before scale)

**1. Queue scrape jobs (immediate win)**
Replace blocking `await scrape()` in the request handler with a job queue (BullMQ + Redis). The HTTP response returns immediately with a job ID. Client polls or connects via SSE to a status endpoint. This eliminates Apify timeout from the user-facing request path.

**2. Retry + circuit breaker for Claude API**
Wrap all Claude calls with exponential backoff (3 retries, jitter) for 429/529 responses. A circuit breaker opens after 5 consecutive failures, returning a degraded response immediately instead of timing out.

**3. Cache Claude analysis results**
`streamAnalysis` output is deterministic per ad — same ad produces the same analysis. Store the result on the `Ad` document. Re-render from cache on subsequent views. Eliminates the most common per-user LLM cost.

**4. Fix image proxy**
Add `Content-Length` check before streaming — reject anything over 5MB. Abort the proxy request if the client disconnects. Or move entirely to signed redirects to the CDN origin (no proxy at all).

**5. Limit conversation history sent to Claude**
Chat history grows unboundedly. Cap at last N turns (e.g. 10) before sending to API. Users rarely need context from 20 turns ago. This keeps input tokens and cost flat regardless of conversation length.

### Scale second

**6. Horizontal scaling**
The backend is stateless (no in-memory session state, no local file deps). Adding a load balancer + multiple Node processes (PM2 cluster or k8s) is straightforward. Only dependency: MongoDB Atlas connection string must allow the increased connection pool count.

**7. Per-brand result caching**
Move brand + ads into Redis with a TTL (currently TTL is implicit in MongoDB `lastFetched`). Warm reads skip MongoDB entirely for the common case.

**8. Separate the image proxy**
Move to a dedicated microservice or CDN worker (Cloudflare Worker) to prevent image egress from consuming Node process memory.

---

## 5. How would you monitor and debug it in production?

### What to instrument

**Latency — the three slow paths:**
- `scrape()` duration by scraper name
- `extractFields()` duration (per-ad, P50/P95)
- `streamChat()` time to first token

**Error rates — the three failure surfaces:**
- Claude API: 429 rate, 500 rate, timeouts
- Apify: failure rate by scraper name
- MongoDB: connection pool wait time, write error rate

**Business metrics:**
- Searches per hour (cache hit rate = cost lever)
- Chat sessions per brand
- Competitor discovery success rate

### Logging (what's already there vs. what's missing)

Already logging:
- `[ScraperRegistry]` tries and failures per scraper
- `[AdsService]` partial extraction failure count
- `[startup]` DB connection failure
- SSE stream errors in AnalysisController

Missing and needed:
- Request IDs (correlate logs across a single user request chain)
- Claude API latency + token counts per call (log `usage` from the response)
- `brandId` on every log line (filter to one brand's full trace)
- Slow query logging for any Mongoose query over 500ms

### Alerting thresholds

| Metric | Alert at |
|--------|----------|
| Claude 429 rate | > 5% of requests in 5 min |
| Scrape failure rate | > 20% in 10 min |
| P95 `/api/ads` latency | > 15s |
| Process memory | > 512MB |
| MongoDB connection wait | > 100ms P95 |

### Debugging a production failure

**"Search returns empty / error"**
1. Check SearchSession collection — status, errorMessage, scraper tried
2. Check ScraperRegistry logs for the failing scraper
3. Check Claude Haiku call — did extractFields 429?

**"Chat gives truncated / no response"**
1. Check AnalysisController SSE stream error log
2. Check Claude API status page
3. Check `finish_reason` in the stream — was it `max_tokens`?

**"High latency on search"**
1. Check Apify actor run duration (Apify dashboard)
2. Check `extractFields` P95 — likely Claude Haiku being slow or rate-limited
3. Check MongoDB slow query log — `Ad.find({ brandId })` missing index?

**"Memory growing / OOM"**
1. Check image proxy — large images? clients disconnecting mid-stream?
2. Check for SSE connections that never closed (leaked generator + response)
