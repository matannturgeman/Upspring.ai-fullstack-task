# Upspring.ai — Project Overview & Architecture

## What We're Building
A creative intelligence web app that lets marketers research brand ads from Meta's public library, analyze them with AI (multimodal — images + text), and discover competitors.

## Stack
| Layer | Technology |
|---|---|
| Frontend | React (Vite) + Tailwind CSS + Zustand |
| Backend | Node.js + Express |
| Database | MongoDB (Mongoose) |
| Ads Scraping | Apify (Meta Ads Library actor) |
| AI Analysis | Claude API (`claude-sonnet-4-6`) — vision-capable |
| Competitor Discovery | Perplexity API + Claude |
| Deployment | Railway (backend) + Vercel (frontend) |

## Directory Structure
```
upspring-ai/
├── backend/
│   ├── src/
│   │   ├── config/          # db.js, env.js
│   │   ├── models/          # Brand.js, Ad.js, SearchSession.js
│   │   ├── services/        # apifyService.js, claudeService.js, perplexityService.js, competitorService.js
│   │   ├── routes/          # ads.js, analysis.js, competitors.js
│   │   ├── middleware/      # errorHandler.js, timeout.js, requestLogger.js
│   │   └── utils/           # apifyParser.js, promptBuilder.js, imageProxy.js
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── api/             # adsApi.js, analysisApi.js, competitorApi.js
│   │   ├── components/      # SearchBar, AdCard, AdGrid, AIChat, CompetitorPanel, shared/
│   │   ├── hooks/           # useAds.js, useAnalysis.js, useCompetitors.js
│   │   ├── store/           # appStore.js (Zustand)
│   │   └── pages/           # Home.jsx
│   └── tests/
│       ├── unit/
│       └── e2e/             # Playwright tests
├── docs/                    # This folder
└── README.md
```

## Implementation Phases
1. [Phase 1 — Project Scaffold & DB](./01-phase-scaffold.md)
2. [Phase 2 — Ads Data Acquisition (Apify)](./02-phase-ads-scraping.md)
3. [Phase 3 — Ads Exploration UI](./03-phase-ads-ui.md)
4. [Phase 4 — AI Analysis (Claude Vision)](./04-phase-ai-analysis.md)
5. [Phase 5 — Competitor Discovery](./05-phase-competitors.md)
6. [Phase 6 — Error Handling & Polish](./06-phase-error-handling.md)
7. [Phase 7 — Tests & E2E](./07-phase-testing.md)
8. [Phase 8 — Deployment & README](./08-phase-deployment.md)

## Key Design Decisions
- **No silent failures** — every error surfaces to the UI with a clear message + fallback action
- **Multimodal AI** — ad images/thumbnails are passed to Claude vision, not just text
- **Caching in MongoDB** — brand searches are cached (TTL: 1hr) to avoid hammering Apify
- **Competitor reasoning** — always show *why* a competitor was identified, not just the name
- **Streaming AI responses** — use SSE for Claude responses to avoid timeout UX issues
