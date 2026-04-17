import mongoose from 'mongoose'
import process from 'process'
import { afterAll, beforeAll } from 'vitest'

const mongooseClient = mongoose as unknown as {
  connect(uri: string): Promise<unknown>
  connection: {
    dropDatabase(): Promise<unknown>
    close(): Promise<unknown>
  }
}

beforeAll(async () => {
  await mongooseClient.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/upspring_test')
})

afterAll(async () => {
  await mongooseClient.connection.dropDatabase()
  await mongooseClient.connection.close()
})
