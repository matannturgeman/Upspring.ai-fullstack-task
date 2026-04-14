import mongoose from 'mongoose'
import { afterAll, beforeAll } from 'vitest'

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/upspring_test')
})

afterAll(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.connection.close()
})
