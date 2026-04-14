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

## Docs
See [`/docs`](./docs/) for full implementation plans broken down by phase.
