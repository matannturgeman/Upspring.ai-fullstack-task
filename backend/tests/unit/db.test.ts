import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('mongoose', () => ({
  default: { connect: vi.fn() },
  connect: vi.fn(),
}))

import mongoose from 'mongoose'
import { connectDB } from '../../src/config/db'

const mockedConnect = vi.mocked(
  (
    mongoose as unknown as {
      connect: (...args: unknown[]) => Promise<unknown>
    }
  ).connect,
)

describe('connectDB', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('resolves on first successful connect', async () => {
    mockedConnect.mockResolvedValueOnce(mongoose as never)
    const p = connectDB()
    await vi.runAllTimersAsync()
    await expect(p).resolves.toBeUndefined()
    expect(mockedConnect).toHaveBeenCalledTimes(1)
  })

  it('retries on failure and succeeds on second attempt', async () => {
    mockedConnect
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(mongoose as never)

    const p = connectDB()
    await vi.runAllTimersAsync()
    await expect(p).resolves.toBeUndefined()
    expect(mockedConnect).toHaveBeenCalledTimes(2)
  })

  it('retries on failure and succeeds on third attempt', async () => {
    mockedConnect
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(mongoose as never)

    const p = connectDB()
    await vi.runAllTimersAsync()
    await expect(p).resolves.toBeUndefined()
    expect(mockedConnect).toHaveBeenCalledTimes(3)
  })

  it('throws after MAX_RETRIES (3) consecutive failures', async () => {
    mockedConnect.mockRejectedValue(new Error('ECONNREFUSED'))

    const p = connectDB()
    // Attach rejection handler before advancing timers to avoid unhandled rejection
    const assertion = expect(p).rejects.toThrow('Failed to connect to MongoDB after 3 attempts')
    await vi.runAllTimersAsync()
    await assertion
    expect(mockedConnect).toHaveBeenCalledTimes(3)
  })
})
