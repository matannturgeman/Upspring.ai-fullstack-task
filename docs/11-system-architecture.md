# System Architecture & Data Flows

## Overview

Upspring.ai is a three-tier web application: React frontend → Express backend → MongoDB + external APIs (Apify, Claude, Perplexity). The backend is stateless between requests; all persistence lives in MongoDB.

```
┌─────────────────────────────────────────────────────────────┐
│ Browser                                                      │
│  React + Zustand store                                       │
│  useAds / useAnalysis / useChat / useCompetitors            │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP + SSE
┌────────────────────▼────────────────────────────────────────┐
│ Express Backend (port 4000)                                  │
│  Routes → Controllers → Services → Scrapers / AI clients   │
└──────┬──────────────┬─────────────────┬──────────┬──────────┘
       │              │                 │          │
  MongoDB         Apify API       Claude API  Perplexity API
  (brand/ad       (scraping)      (analysis)  (competitors)
   storage)
```

---

## Request Flows

### 1. Brand Search

```
SearchBar.handleSubmit(brandName)
  └─ useAds.search(brandName)
       ├─ Clear ads / chat / competitor state
       ├─ setAdsLoading(true)
       └─ GET /api/ads?brand=<name>&limit=20
            └─ AdsController.getAds()
                 ├─ Validate query (AdsQuerySchema)
                 │   sanitize HTML chars, cap limit=50, parse forceRefresh
                 └─ AdsService.getAds(brand, limit, forceRefresh)
                      │
                      ├─ [Cache hit] Brand.findOne({normalizedName})
                      │   └─ Ad.find({brandId}) → return {fromCache: true, ads}
                      │
                      └─ [Cache miss / forceRefresh]
                           ├─ SearchSession.create({status: 'fetching'})
                           ├─ ScraperRegistry.scrape(brand, {limit})
                           │   ├─ Try ApifyScraper   → Apify actor, 120s timeout
                           │   ├─ Try ScrapingBee    → FB async endpoint via proxy
                           │   └─ Try RapidApi       → RapidAPI proxy
                           │   (each scraper tried in SCRAPER_PRIORITY order;
                           │    first success wins, rest are skipped)
                           │
                           ├─ For each raw ad:
                           │   ├─ ExtractionService.extract(rawData)
                           │   │   ├─ codeExtract() — deterministic field mapping
                           │   │   └─ If score < 2: ClaudeService.extractFields()
                           │   │       (Haiku model, 512 tokens, JSON output)
                           │   ├─ RawAd.create(rawData)
                           │   └─ Ad.create(extracted fields)
                           │
                           ├─ Brand.findOneAndUpdate({normalizedName}, upsert)
                           ├─ SearchSession.update({status: 'done'})
                           └─ return {brand, ads, fromCache: false, partial}
```

**State after success:** `currentBrand`, `ads`, `fromCache` set in Zustand store → AdGrid re-renders.

---

### 2. Single-Ad AI Analysis (streaming)

```
AdCard — "Analyze with AI" button click
  └─ useAnalysis.analyze(adId)
       ├─ Abort any in-flight request (AbortController)
       ├─ addMessage({role: 'ai', text: '', streaming: true})
       └─ POST /api/analysis  {adId}
            └─ AnalysisController.streamAnalysis()
                 ├─ Validate adId (ObjectId regex)
                 ├─ Ad.findById(adId)
                 ├─ Set SSE headers, flushHeaders()
                 └─ ClaudeService.streamAnalysis(ad)
                      ├─ Build content array:
                      │   ├─ If thumbnailUrl or imageUrl → ImageBlockParam
                      │   └─ TextBlockParam (buildPrompt):
                      │       platform, status, mediaNote (video proxy?),
                      │       headline, primaryText,
                      │       6-point analysis framework
                      └─ claude-sonnet-4-6, max_tokens=1024, stream=true
                           │
                           ├─ content_block_delta events → yield text chunks
                           │   → res.write(`data: {"text":"..."}\n\n`)
                           └─ [DONE] → res.write(`data: [DONE]\n\n`)

Client (useAnalysis):
  ReadableStream reader → decode lines → parse JSON → accumulate text
  → updateLastMessage(id, accumulated, streaming=true/false)
  → AnalysisPanel shows streaming markdown
```

---

### 3. Brand AI Chat (multi-turn, streaming)

```
BrandChat — user sends message / clicks suggestion
  └─ useChat.sendMessage(brandId, userText)
       ├─ addChatMessage({role: 'user', text: userText})
       ├─ addChatMessage({role: 'ai', text: '', streaming: true})
       ├─ Build history:
       │   [...chatMessages mapped (ai→'assistant'), {role:'user', content: userText}]
       └─ POST /api/analysis/chat  {brandId, messages}
            └─ AnalysisController.streamChat()
                 ├─ Validate (ChatBodySchema: ObjectId, 1–40 messages)
                 ├─ Brand.findById(brandId)
                 ├─ Ad.find({brandId}).limit(20)   ← DB-level cap
                 ├─ Set SSE headers
                 └─ ClaudeService.streamChat(brandName, ads, messages)
                      ├─ Sort ads: ACTIVE first, slice(0, 20)
                      ├─ Build system prompt:
                      │   "sample of N ads from X (M total, active prioritised)"
                      │   for each ad: platform, status, [video note], headline,
                      │               primaryText.slice(0, 300)
                      ├─ Collect image URLs: thumbnailUrl||imageUrl, slice(0,10)
                      ├─ Inject images into first user message only
                      └─ claude-sonnet-4-6, max_tokens=1024, stream=true
                           same SSE emit pattern as single-ad analysis
```

**Context selection logic:** active ads prioritised → capped at 20 → text truncated at 300 chars → up to 10 thumbnail images → system prompt tells Claude total library size vs. sample size.

---

### 4. Competitor Discovery

```
CompetitorPanel — "Find Competitors" button
  └─ useCompetitors.discover()
       └─ POST /api/competitors/find  {brandName, brandId}
            └─ CompetitorsController.findCompetitors()
                 └─ CompetitorService.findCompetitors(brandName, brandId)
                      │
                      ├─ [Primary] PerplexityService.searchCompetitors(brandName)
                      │   POST api.perplexity.ai/chat/completions
                      │   15s AbortSignal timeout
                      │   Extract JSON array from response text
                      │   → [{name, reason}, ...]
                      │
                      └─ [Fallback] ClaudeService.findCompetitorsFromAds()
                          Ad.find({brandId}).limit(10) → build adContext (2000 chars)
                          Claude reasons from ad copy → JSON array
                          source = 'claude'
                 │
                 ├─ Brand.findByIdAndUpdate({competitors}) [fire-and-forget]
                 └─ respond {competitors, source, disclaimer}

User selects competitor:
  useCompetitors.selectCompetitor(competitor)
    → setSelectedCompetitor(competitor)
    → useAds.search(competitor.name)  [full new search flow]
```

---

## Component & Module Map

```
backend/
├── server.ts                    Express app, middleware, routes
├── src/
│   ├── container.ts             Manual DI — wires all singletons
│   ├── config/
│   │   ├── env.ts               Validates required env vars at startup
│   │   └── db.ts                MongoDB connect with 3-attempt retry
│   ├── models/
│   │   ├── Brand.ts             {name, normalizedName, adCount, competitors}; TTL=1h
│   │   ├── Ad.ts                Extracted ad fields; indexed on brandId
│   │   ├── RawAd.ts             Raw scraper output as Mixed; indexed on brandId
│   │   └── SearchSession.ts     Fetch status tracking; TTL=24h
│   ├── routes/
│   │   ├── ads.ts               GET / and GET /:brandId
│   │   ├── analysis.ts          POST / and POST /chat
│   │   └── competitors.ts       POST /find
│   ├── controllers/
│   │   ├── AdsController.ts     Validates query, calls AdsService
│   │   ├── AnalysisController.ts SSE streaming for analysis + chat
│   │   └── CompetitorsController.ts Calls CompetitorService, updates Brand
│   ├── services/
│   │   ├── AdsService.ts        Cache check → scrape → extract → persist
│   │   ├── ExtractionService.ts Code extract → AI fallback → best-effort
│   │   ├── ClaudeService.ts     streamAnalysis / streamChat / extractFields / findCompetitors
│   │   ├── PerplexityService.ts searchCompetitors (web-grounded)
│   │   └── CompetitorService.ts Perplexity → Claude fallback
│   ├── scrapers/
│   │   ├── ScraperRegistry.ts   Ordered fallback chain from SCRAPER_PRIORITY
│   │   ├── ApifyScraper.ts      Apify facebook-ads-scraper actor
│   │   ├── ScrapingBeeScraper.ts Facebook async endpoint via ScrapingBee proxy
│   │   ├── RapidApiScraper.ts   RapidAPI proxy to Facebook
│   │   └── MockScraper.ts       3 hardcoded Nike ads, 800ms delay
│   ├── services/extraction/
│   │   └── codeExtractor.ts     Pattern-matches Apify/FB normalized shape
│   ├── schemas/                 Zod schemas for all inputs/outputs
│   ├── middleware/
│   │   ├── errorHandler.ts      Global Express error handler
│   │   └── timeout.ts           30s request timeout
│   ├── mocks/
│   │   └── claudeMock.ts        streamMockAnalysis / streamMockChat generators
│   └── utils/
│       ├── imageProxy.ts        HTTPS-only proxy with host allowlist
│       └── mockMode.ts          isMockLLM() / isMockScraper() from env

frontend/
├── src/
│   ├── App.tsx                  ErrorBoundary → Home
│   ├── pages/Home.tsx           Layout, ads count, "Ask AI" button
│   ├── store/
│   │   ├── appStore.ts          Combines 4 slices
│   │   └── slices/
│   │       ├── adsSlice.ts      brand, ads, loading, error, fromCache
│   │       ├── competitorSlice.ts competitors, selectedCompetitor
│   │       ├── analysisSlice.ts  analysisMessages, selectedAdId, loading, error
│   │       └── chatSlice.ts     chatOpen, chatMessages, loading, error
│   ├── hooks/
│   │   ├── useAds.ts            search() — clears state, fetches, updates store
│   │   ├── useAnalysis.ts       analyze() / close() — SSE stream for single ad
│   │   ├── useChat.ts           sendMessage() / closeChat() — SSE stream for chat
│   │   └── useCompetitors.ts    discover() / selectCompetitor()
│   ├── api/
│   │   ├── adsApi.ts            GET /api/ads (axios)
│   │   └── competitorApi.ts     POST /api/competitors/find (axios)
│   └── components/
│       ├── SearchBar/           Brand name input + submit
│       ├── AdGrid/              Responsive grid of AdCards
│       ├── AdCard/              Single ad: media, metadata, Analyze button
│       ├── AnalysisPanel/       Full-screen modal, streaming single-ad analysis
│       ├── BrandChat/           Full-screen modal, multi-turn brand chat
│       ├── CompetitorPanel/     Sidebar: discover + select competitor
│       └── shared/              ErrorBoundary, EmptyState, ErrorState, LoadingSkeleton
```

---

## Key Design Decisions

**Scraper fallback chain** — ScraperRegistry tries scrapers in priority order and moves to the next on any error. First success terminates the chain. This means a slow scraper can still consume most of the 30s window before handing off.

**Code extraction before AI** — ExtractionService always runs deterministic code extraction first. AI (Haiku) is only invoked when the code score is below threshold. This keeps AI extraction cost near-zero for well-structured Apify responses.

**SSE over WebSockets** — Server-Sent Events are used for streaming AI responses. SSE is simpler (HTTP, no upgrade) and sufficient for unidirectional streaming. The tradeoff is that streams are not resumable — if the connection drops, the user must retry.

**Manual DI container** — `container.ts` wires all dependencies at startup without a framework. Clean but inflexible: changing service dependencies requires editing the container manually, and there's no lazy loading.

**Zustand slices** — State is split into four independent slices (ads, competitors, analysis, chat) composed in `appStore.ts`. `resetSearch()` in the root store resets all slices atomically.

**Brand TTL = 1 hour** — MongoDB TTL index on the Brand collection expires cached brands after 1 hour. Subsequent searches for the same brand trigger a fresh scrape. Short enough for data freshness; long enough to avoid hammering Apify on every request.
