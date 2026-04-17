import mongoose from 'mongoose'
import { env } from './env'

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000
const mongooseClient = mongoose as unknown as {
  connect(uri: string): Promise<unknown>
}

export async function connectDB(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await mongooseClient.connect(env.MONGODB_URI)
      console.log('MongoDB connected')
      return
    } catch (err) {
      const isLast = attempt === MAX_RETRIES
      console.error(
        `MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed:`,
        (err as Error).message,
      )
      if (isLast)
        throw new Error(`Failed to connect to MongoDB after ${MAX_RETRIES} attempts`, {
          cause: err,
        })
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt))
    }
  }
}
