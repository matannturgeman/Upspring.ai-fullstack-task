import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { timeoutMiddleware } from '../../src/middleware/timeout'

function makeMocks() {
  const events: Record<string, (() => void)[]> = {}
  const res = {
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    on: vi.fn((event: string, cb: () => void) => {
      events[event] = events[event] ?? []
      events[event].push(cb)
    }),
    emit: (event: string) => events[event]?.forEach((cb) => cb()),
  } as unknown as Response & { emit: (e: string) => void; headersSent: boolean }

  const req = {} as Request
  const next = vi.fn() as unknown as NextFunction
  return { req, res, next }
}

describe('timeoutMiddleware', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('calls next()', () => {
    const { req, res, next } = makeMocks()
    timeoutMiddleware(1000)(req, res, next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('sends 503 after timeout if headers not sent', () => {
    const { req, res, next } = makeMocks()
    timeoutMiddleware(1000)(req, res, next)
    vi.advanceTimersByTime(1001)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TIMEOUT' }))
  })

  it('does NOT send response if headers already sent', () => {
    const { req, res, next } = makeMocks()
    ;(res as unknown as { headersSent: boolean }).headersSent = true
    timeoutMiddleware(1000)(req, res, next)
    vi.advanceTimersByTime(1001)
    expect(res.status).not.toHaveBeenCalled()
  })

  it('clears timer on finish', () => {
    const { req, res, next } = makeMocks()
    timeoutMiddleware(1000)(req, res, next)
    res.emit('finish')
    vi.advanceTimersByTime(2000)
    expect(res.status).not.toHaveBeenCalled()
  })

  it('clears timer on close', () => {
    const { req, res, next } = makeMocks()
    timeoutMiddleware(1000)(req, res, next)
    res.emit('close')
    vi.advanceTimersByTime(2000)
    expect(res.status).not.toHaveBeenCalled()
  })

  it('clears timer on error', () => {
    const { req, res, next } = makeMocks()
    timeoutMiddleware(1000)(req, res, next)
    res.emit('error')
    vi.advanceTimersByTime(2000)
    expect(res.status).not.toHaveBeenCalled()
  })
})
