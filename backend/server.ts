import express from 'express'
import process from 'process'
import rateLimit from 'express-rate-limit'
import cors, { type CorsOptions } from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { connectDB } from './src/config/db'
import { env } from './src/config/env'
import { errorHandler } from './src/middleware/errorHandler'
import { timeoutMiddleware } from './src/middleware/timeout'
import adsRouter from './src/routes/ads'
import analysisRouter from './src/routes/analysis'
import competitorsRouter from './src/routes/competitors'
import imageProxyRouter from './src/utils/imageProxy'

const app = express()

const REQUEST_TIMEOUT_MS = 30_000
const JSON_BODY_LIMIT = '50kb'
const corsOrigin = env.FRONTEND_URL ?? (env.NODE_ENV === 'development' ? 'http://localhost:5173' : false)
const corsOptions: CorsOptions = {
  origin: corsOrigin,
  credentials: Boolean(corsOrigin),
  methods: ['GET', 'POST'],
}

app.use(helmet())
app.use(cors(corsOptions) as unknown as express.RequestHandler)
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
    .catch((err) => {
      console.error('[startup] DB connection failed, exiting:', err)
      process.exit(1)
    })
}

export default app
