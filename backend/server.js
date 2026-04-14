import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { connectDB } from './src/config/db.js'
import { validateEnv } from './src/config/env.js'
import { errorHandler } from './src/middleware/errorHandler.js'
import { timeoutMiddleware } from './src/middleware/timeout.js'
import adsRouter from './src/routes/ads.js'
import analysisRouter from './src/routes/analysis.js'
import competitorsRouter from './src/routes/competitors.js'

validateEnv()

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

if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => app.listen(PORT, () => console.log(`Server running on :${PORT}`)))
}

export default app
