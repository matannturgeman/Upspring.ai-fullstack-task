import express from 'express'
import rateLimit from 'express-rate-limit'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { connectDB } from './src/config/db.ts'
import { env } from './src/config/env.ts'
import { errorHandler } from './src/middleware/errorHandler.ts'
import { timeoutMiddleware } from './src/middleware/timeout.ts'
import adsRouter from './src/routes/ads.ts'
import analysisRouter from './src/routes/analysis.ts'
import competitorsRouter from './src/routes/competitors.ts'
import imageProxyRouter from './src/utils/imageProxy.ts'

const app = express()

const REQUEST_TIMEOUT_MS = 30_000
const JSON_BODY_LIMIT = '50kb'
app.use(helmet())
app.use(cors({ origin: env.FRONTEND_URL, credentials: true, methods: ['GET', 'POST'] }))
app.use(express.json({ limit: JSON_BODY_LIMIT }))
app.use(morgan('dev'))
app.use(timeoutMiddleware(REQUEST_TIMEOUT_MS))
if (env.NODE_ENV === 'production') {
  app.use(rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false }))
}

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.use('/api/ads', adsRouter)
app.use('/api/analysis', analysisRouter)
app.use('/api/competitors', competitorsRouter)
app.use('/api/proxy/image', imageProxyRouter)

app.use(errorHandler)

if (env.NODE_ENV !== 'test') {
  connectDB()
    .then(() => app.listen(env.PORT, () => console.log(`Server running on :${env.PORT}`)))
    .catch(err => {
      console.error('[startup] DB connection failed, exiting:', err)
      process.exit(1)
    })
}

export default app
