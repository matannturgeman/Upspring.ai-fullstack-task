import mongoose from 'mongoose'

export async function connectDB(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI as string)
  console.log('MongoDB connected')
}
