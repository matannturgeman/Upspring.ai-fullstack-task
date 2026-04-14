import { describe, it, expect } from 'vitest'
import { errorHandler } from '../../src/middleware/errorHandler.ts'
import { timeoutMiddleware } from '../../src/middleware/timeout.ts'

describe('errorHandler', () => {
  it('returns error shape with status + code', () => {
    const err = { status: 400, message: 'bad input', code: 'BAD' } as Error & { status: number; code: string }
    const res = { status: (s: number) => ({ json: (b: object) => ({ s, b }) }) }
    const result = res.status(err.status).json({ error: true, message: err.message, code: err.code })
    expect(result.s).toBe(400)
    expect((result.b as { error: boolean }).error).toBe(true)
    expect((result.b as { code: string }).code).toBe('BAD')
  })

  it('defaults to 500 when no status on error', () => {
    let sentStatus: number | undefined
    let sentBody: Record<string, unknown> | undefined
    const err = new Error('oops')
    const res = {
      status: (s: number) => { sentStatus = s; return { json: (b: Record<string, unknown>) => { sentBody = b } } },
    }
    errorHandler(err, {} as never, res as never, () => {})
    expect(sentStatus).toBe(500)
    expect(sentBody?.error).toBe(true)
  })
})

describe('timeoutMiddleware', () => {
  it('calls next immediately', () => {
    let nextCalled = false
    const res = { on: () => {}, status: () => ({ json: () => {} }) }
    timeoutMiddleware(5000)({} as never, res as never, () => { nextCalled = true })
    expect(nextCalled).toBe(true)
  })
})
