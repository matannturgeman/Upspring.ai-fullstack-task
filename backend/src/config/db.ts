import mongoose from 'mongoose'

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

export async function connectDB(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await mongoose.connect(process.env.MONGODB_URI as string)
      console.log('MongoDB connected')
      return
    } catch (err) {
      const isLast = attempt === MAX_RETRIES
      console.error(`MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed:`, (err as Error).message)
      if (isLast) throw new Error(`Failed to connect to MongoDB after ${MAX_RETRIES} attempts`)
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt))
    }
  }
}
