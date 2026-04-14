# Phase 8 — Docker, Deployment & README

## Goal
Containerize local dev with Docker Compose (MongoDB), deploy backend to Railway, frontend to Vercel, and write the final README.

## Dependencies
- All phases complete
- Docker Desktop installed locally
- Railway + Vercel accounts

---

## 8.1 — Docker Compose (Local Dev)

**`docker-compose.yml`** (root of project)
```yaml
version: '3.9'

services:
  mongo:
    image: mongo:7
    container_name: upspring_mongo
    restart: unless-stopped
    ports:
      - '27017:27017'
    volumes:
      - mongo_data:/data/db
    environment:
      MONGO_INITDB_DATABASE: upspring

  mongo-express:
    image: mongo-express:latest
    container_name: upspring_mongo_express
    restart: unless-stopped
    ports:
      - '8081:8081'
    environment:
      ME_CONFIG_MONGODB_SERVER: mongo
      ME_CONFIG_BASICAUTH_USERNAME: admin
      ME_CONFIG_BASICAUTH_PASSWORD: admin
    depends_on:
      - mongo

volumes:
  mongo_data:
```

Start local DB:
```bash
docker compose up -d mongo
# Optional: browse DB at http://localhost:8081
docker compose up -d mongo-express
```

Backend `.env` for local dev:
```
MONGODB_URI=mongodb://localhost:27017/upspring
```

---

## 8.2 — Backend: Dockerfile

**`backend/Dockerfile`**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 4000
CMD ["node", "server.js"]
```

**`backend/.dockerignore`**
```
node_modules
.env
tests
*.test.js
```

---

## 8.3 — Frontend: Dockerfile (optional, for full Docker stack)

**`frontend/Dockerfile`**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**`frontend/nginx.conf`**
```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api {
    proxy_pass http://backend:4000;
  }
}
```

---

## 8.4 — Full Docker Compose (optional all-in-one)

```yaml
# docker-compose.full.yml
version: '3.9'

services:
  mongo:
    image: mongo:7
    volumes:
      - mongo_data:/data/db
    environment:
      MONGO_INITDB_DATABASE: upspring

  backend:
    build: ./backend
    ports:
      - '4000:4000'
    env_file: ./backend/.env
    environment:
      MONGODB_URI: mongodb://mongo:27017/upspring
    depends_on:
      - mongo

  frontend:
    build: ./frontend
    ports:
      - '80:80'
    depends_on:
      - backend

volumes:
  mongo_data:
```

---

## 8.5 — Deploy: Backend → Railway

1. Push repo to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Select `backend/` as root directory
4. Add environment variables in Railway dashboard:
   ```
   MONGODB_URI=<MongoDB Atlas URI>
   APIFY_API_TOKEN=
   ANTHROPIC_API_KEY=
   PERPLEXITY_API_KEY=
   FRONTEND_URL=https://your-app.vercel.app
   PORT=4000
   ```
5. Railway auto-detects Node.js and deploys
6. Get public URL: `https://upspring-backend.up.railway.app`

---

## 8.6 — Deploy: Frontend → Vercel

1. Go to vercel.com → New Project → Import GitHub repo
2. Set **Root Directory** to `frontend/`
3. Add environment variable:
   ```
   VITE_API_URL=https://upspring-backend.up.railway.app
   ```
4. Update `frontend/src/api/index.js`:
   ```js
   const api = axios.create({
     baseURL: import.meta.env.VITE_API_URL || '/api'
   })
   ```
5. Deploy → get URL: `https://upspring-ai.vercel.app`

---

## 8.7 — README.md

**`README.md`** (root)
```markdown
# Upspring.ai — Ad Intelligence Platform

A creative intelligence tool for marketers to research brand ads, analyze them with AI, and discover competitors.

## Live Demo
[https://upspring-ai.vercel.app](https://upspring-ai.vercel.app)

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
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

App runs at http://localhost:5173

## Running Tests
```bash
# Backend
cd backend && npm test

# Frontend unit
cd frontend && npm test

# E2E
cd frontend && npm run test:e2e
```

## Tradeoffs & Design Decisions

### Caching
Ads are cached in MongoDB with a 1-hour TTL. This avoids hammering Apify on every search and keeps costs down. Tradeoff: stale data possible within the hour. `forceRefresh=true` bypasses it.

### AI Context Selection
Only the first 15 ads are sent to Claude (to stay within token limits and control cost). Images are limited to 10. Tradeoff: very prolific brands may have relevant ads excluded.

### Streaming
Claude responses stream via SSE so users see tokens as they arrive instead of waiting 10+ seconds for a full response.

### Competitor Strategy
Perplexity is tried first (web-grounded results). If it fails, Claude reasons from ad copy. We always show the source so users know how confident to be in the results.

### No Auth
No user authentication — this is a demo/assignment scope. For production: add JWT auth, per-user search history, and rate limiting per user rather than per IP.

## What Would Break First at Scale

| Component | Bottleneck | Fix |
|---|---|---|
| Apify scraping | Rate limits, cost | Queue with BullMQ, cache aggressively, pre-fetch popular brands |
| Claude vision | Cost ($) per image | Resize/compress images before sending, cache AI responses |
| MongoDB | Single instance | Replica set, read replicas, TTL tuning |
| SSE connections | Open connections per user | Move to WebSockets or short-poll for scale |
| No job queue | Long scrapes block requests | Background jobs (BullMQ/Redis) with polling endpoint |

## Monitoring in Production
- Structured logging with Winston → ship to Datadog/Logtail
- Track: Apify call duration, Claude token usage, error rates per route
- Alert on: 502 rate > 5%, Apify job failures, Claude rate limits
```

---

## Success Criteria
- [ ] `docker compose up -d mongo` starts MongoDB on :27017
- [ ] Backend connects to Dockerized MongoDB via `MONGODB_URI=mongodb://localhost:27017/upspring`
- [ ] `docker compose up` (full) runs entire stack with no manual steps
- [ ] Backend deployed and accessible on Railway public URL
- [ ] Frontend deployed on Vercel, calls Railway backend successfully
- [ ] README covers setup, tradeoffs, and scale analysis
