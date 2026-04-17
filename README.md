# Upspring.ai — Ad Intelligence Platform

A creative intelligence tool for marketers to research brand ads, analyze them with AI, and discover competitors.

## Features

- Search any brand → fetch real public Meta ads via Apify
- Browse ads with image previews, metadata, status
- Ask AI questions about the ads (multimodal — Claude analyzes images + text)
- Discover competitors via Perplexity web search + Claude fallback
- Click a competitor → explore their ads in the same flow

## Stack

- **Frontend**: React + Vite + Tailwind CSS + Zustand
- **Backend**: Node.js + Express
- **DB**: MongoDB (Docker locally, Atlas in production)
- **Ads**: Apify (Meta Ads Library scraper)
- **AI**: Claude claude-sonnet-4-6 (Anthropic) — multimodal
- **Competitors**: Perplexity API + Claude fallback

## Local Setup

### Prerequisites

- Node.js 20+
- Docker Desktop (for MongoDB)

### 1. Clone & install

```bash
git clone https://github.com/matannturgeman/Upspring.ai-fullstack-task.git
cd Upspring.ai-fullstack-task
cd backend && npm install
cd ../frontend && npm install
```

### 2. Start MongoDB

```bash
docker compose up -d mongo
```

### 3. Configure environment

```bash
cp backend/.env.example backend/.env
# Fill in: APIFY_API_TOKEN, ANTHROPIC_API_KEY, PERPLEXITY_API_KEY
```

### 4. Run

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

App runs at http://localhost:5173

## Running Tests

```bash
cd backend && npm test          # unit + integration
cd frontend && npm test         # component unit tests
cd frontend && npm run test:e2e # Playwright E2E
```

## Live

| Service | URL |
|---------|-----|
| Frontend | https://upspring-ai-frontend.vercel.app/ |
| Backend | https://upspring-ai-fullstack-task.onrender.com/health |

## Deployment

### Backend → Render

1. New Web Service → Deploy from GitHub → set root directory to `backend/`
2. Add env vars: `MONGODB_URI`, `APIFY_API_TOKEN`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`, `FRONTEND_URL`, `NODE_ENV=production`
3. Render detects Node.js and uses the `Dockerfile`

### Frontend → Vercel

1. New Project → Import repo → set root directory to `frontend/`
2. Add env var: `VITE_API_BASE_URL=https://<your-render-url>`
3. Deploy

---

## Tradeoffs & Design Decisions

**Caching** — Ads are stored in MongoDB after first fetch. Second search for same brand returns instantly from DB. `forceRefresh=true` bypasses it. Tradeoff: data can be up to a session stale, but avoids hammering Apify on every keystroke.

**AI context window** — Up to 20 ads (active ones prioritised) and up to 10 thumbnail images are sent per chat request. Primary text is truncated at 300 characters per ad. The system prompt tells Claude how many ads were sampled vs. the total library size. Very prolific brands may have some ads excluded.

**Streaming** — Claude responses stream via SSE so users see tokens as they arrive instead of waiting 10+ seconds for a full response.

**Competitor strategy** — Perplexity is tried first (web-grounded). If it fails, Claude reasons from ad copy. Source is always shown so users can judge confidence.

**No auth** — Demo scope. For production: JWT auth, per-user search history, rate limiting per user rather than per IP.

**MongoDB standalone** — Transactions require a replica set; we use sequential ops (`findOneAndUpdate` → `deleteMany` → `insertMany`) instead. Fine at this scale.

---

## What Would Break First at Scale

| Component       | Bottleneck                  | Fix                                                             |
| --------------- | --------------------------- | --------------------------------------------------------------- |
| Apify scraping  | Rate limits + cost          | Queue with BullMQ, cache aggressively, pre-fetch popular brands |
| Claude vision   | Cost per image              | Resize images before sending, cache AI responses per ad         |
| MongoDB         | Single instance             | Replica set, read replicas, TTL tuning                          |
| SSE connections | Open connections per user   | WebSockets or short-poll for horizontal scale                   |
| No job queue    | Long scrapes block requests | Background jobs (BullMQ/Redis) + polling endpoint               |

---

---

## Known Limitations

**Video analysis** — Claude's API does not accept video files or URLs; only images are supported. For video ads, the thumbnail frame (`video_preview_image_url` from the Apify snapshot) is sent as a visual proxy. When no thumbnail is available the AI analysis relies on copy only. The ad card and AI prompts both surface this transparently. See [`docs/09-gap-video-analysis.md`](./docs/09-gap-video-analysis.md) for the full discussion.

**Ad library coverage** — Apify scrapes the public Meta Ads Library. Ads that are not publicly visible, very recent, or region-restricted may be missing or incomplete.

---

## Docs

See [`/docs`](./docs/) for full implementation plans broken down by phase.
