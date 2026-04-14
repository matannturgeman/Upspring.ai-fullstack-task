# Phase 1 — Project Scaffold, Config & Database Layer

## Goal
Get a running monorepo with both frontend and backend booted locally, MongoDB connected, environment variables wired, and base middleware in place.

## Dependencies
None — this is the foundation.

## Steps

### 1.1 — Init monorepo
```bash
mkdir upspring-ai && cd upspring-ai
git init
echo "node_modules\n.env\ndist\n.DS_Store" > .gitignore
```

### 1.2 — Backend scaffold
```bash
mkdir -p backend/src/{config,models,services,routes,middleware,utils}
mkdir -p backend/tests/{unit,integration}
cd backend
npm init -y
npm install express mongoose dotenv cors helmet morgan uuid
npm install -D nodemon jest supertest @jest/globals
```

**`backend/server.js`**
```js
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { connectDB } from './src/config/db.js'
import { errorHandler } from './src/middleware/errorHandler.js'
import { timeoutMiddleware } from './src/middleware/timeout.js'
import adsRouter from './src/routes/ads.js'
import analysisRouter from './src/routes/analysis.js'
import competitorsRouter from './src/routes/competitors.js'

const app = express()
app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_URL }))
app.use(express.json())
app.use(morgan('dev'))
app.use(timeoutMiddleware(30_000))

app.use('/api/ads', adsRouter)
app.use('/api/analysis', analysisRouter)
app.use('/api/competitors', competitorsRouter)
app.use(errorHandler)

const PORT = process.env.PORT || 4000
connectDB().then(() => app.listen(PORT, () => console.log(`Server on ${PORT}`)))
export default app
```

### 1.3 — Config files

**`backend/src/config/db.js`**
```js
import mongoose from 'mongoose'

export async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('MongoDB connected')
}
```

**`backend/src/config/env.js`**
```js
// Validates all required env vars are present at startup
const required = ['MONGODB_URI', 'APIFY_API_TOKEN', 'ANTHROPIC_API_KEY', 'PERPLEXITY_API_KEY']
required.forEach(key => {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`)
})
```

**`backend/.env.example`**
```
MONGODB_URI=mongodb://localhost:27017/upspring
APIFY_API_TOKEN=
ANTHROPIC_API_KEY=
PERPLEXITY_API_KEY=
FRONTEND_URL=http://localhost:5173
PORT=4000
```

### 1.4 — MongoDB Models

**`backend/src/models/Brand.js`**
```js
import mongoose from 'mongoose'

const BrandSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  normalizedName: { type: String, required: true, index: true },
  lastFetched: { type: Date, default: Date.now },
  adCount: { type: Number, default: 0 },
}, { timestamps: true })

// TTL index — cached brand data expires after 1 hour
BrandSchema.index({ lastFetched: 1 }, { expireAfterSeconds: 3600 })
export default mongoose.model('Brand', BrandSchema)
```

**`backend/src/models/Ad.js`**
```js
import mongoose from 'mongoose'

const AdSchema = new mongoose.Schema({
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
  adId: { type: String, index: true },
  platform: { type: String, default: 'Facebook/Instagram' },
  headline: String,
  primaryText: String,
  imageUrl: String,
  videoUrl: String,
  thumbnailUrl: String,
  startDate: Date,
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'UNKNOWN'], default: 'UNKNOWN' },
  performanceData: { type: mongoose.Schema.Types.Mixed, default: null }, // null = not available
  rawData: mongoose.Schema.Types.Mixed,
}, { timestamps: true })

export default mongoose.model('Ad', AdSchema)
```

**`backend/src/models/SearchSession.js`**
```js
import mongoose from 'mongoose'

const SearchSessionSchema = new mongoose.Schema({
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' },
  query: String,
  status: { type: String, enum: ['pending', 'fetching', 'done', 'error'], default: 'pending' },
  errorMessage: String,
  adsFound: { type: Number, default: 0 },
}, { timestamps: true })

export default mongoose.model('SearchSession', SearchSessionSchema)
```

### 1.5 — Base Middleware

**`backend/src/middleware/errorHandler.js`**
```js
export function errorHandler(err, req, res, next) {
  console.error(err)
  const status = err.status || 500
  res.status(status).json({
    error: true,
    message: err.message || 'Internal server error',
    code: err.code || 'UNKNOWN_ERROR',
  })
}
```

**`backend/src/middleware/timeout.js`**
```js
export function timeoutMiddleware(ms) {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      res.status(503).json({ error: true, message: 'Request timed out', code: 'TIMEOUT' })
    }, ms)
    res.on('finish', () => clearTimeout(timer))
    next()
  }
}
```

### 1.6 — Frontend scaffold
```bash
cd ../frontend
npm create vite@latest . -- --template react
npm install
npm install axios zustand react-query @tanstack/react-query tailwindcss autoprefixer postcss
npm install -D @testing-library/react @testing-library/jest-dom vitest @playwright/test jsdom
npx tailwindcss init -p
```

**`frontend/vite.config.js`**
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: './tests/setup.js' },
  server: { proxy: { '/api': 'http://localhost:4000' } }
})
```

**`frontend/tailwind.config.js`**
```js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

## Key Files Created
- `backend/server.js`
- `backend/src/config/db.js`, `env.js`
- `backend/src/models/Brand.js`, `Ad.js`, `SearchSession.js`
- `backend/src/middleware/errorHandler.js`, `timeout.js`
- `frontend/vite.config.js`, `tailwind.config.js`

## Success Criteria
- [ ] `npm run dev` boots backend on :4000 and frontend on :5173
- [ ] MongoDB connects without errors
- [ ] `GET /api/ads` returns `404` (not 500) — routes mounted, no crashes
- [ ] env.js throws on missing env vars
- [ ] Tailwind styles applied in frontend
