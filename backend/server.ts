import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { connectDB } from './src/config/db.ts'
import { validateEnv } from './src/config/env.ts'
import { errorHandler } from './src/middleware/errorHandler.ts'
import { timeoutMiddleware } from './src/middleware/timeout.ts'
import adsRouter from './src/routes/ads.ts'
import analysisRouter from './src/routes/analysis.ts'
import competitorsRouter from './src/routes/competitors.ts'
import imageProxyRouter from './src/utils/imageProxy.ts'

validateEnv()

const app = express()

const REQUEST_TIMEOUT_MS = 30_000
const JSON_BODY_LIMIT = '50kb'
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 30

app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true, methods: ['GET', 'POST'] }))
app.use(express.json({ limit: JSON_BODY_LIMIT }))
app.use(morgan('dev'))
app.use(timeoutMiddleware(REQUEST_TIMEOUT_MS))
app.use(rateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX, standardHeaders: true, legacyHeaders: false }))

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.use('/api/ads', adsRouter)
app.use('/api/analysis', analysisRouter)
app.use('/api/competitors', competitorsRouter)
app.use('/api/proxy/image', imageProxyRouter)

app.use(errorHandler)

const PORT = process.env.PORT || 4000

if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => app.listen(PORT, () => console.log(`Server running on :${PORT}`)))
}

export default app
