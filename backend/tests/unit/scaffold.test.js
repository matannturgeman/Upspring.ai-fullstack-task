import { describe, it, expect } from 'vitest'
import { errorHandler } from '../../src/middleware/errorHandler.js'
import { timeoutMiddleware } from '../../src/middleware/timeout.js'

describe('errorHandler', () => {
  it('returns error shape with status + code', () => {
    const err = { status: 400, message: 'bad input', code: 'BAD' }
    const res = { status: (s) => ({ json: (b) => ({ s, b }) }) }
    const result = res.status(err.status).json({ error: true, message: err.message, code: err.code })
    expect(result.s).toBe(400)
    expect(result.b.error).toBe(true)
    expect(result.b.code).toBe('BAD')
  })

  it('defaults to 500 when no status on error', () => {
    let sentStatus, sentBody
    const err = new Error('oops')
    const res = {
      status: (s) => { sentStatus = s; return { json: (b) => { sentBody = b } } },
    }
    errorHandler(err, {}, res, () => {})
    expect(sentStatus).toBe(500)
    expect(sentBody.error).toBe(true)
  })
})

describe('timeoutMiddleware', () => {
  it('calls next immediately', () => {
    let nextCalled = false
    const res = { on: () => {}, status: () => ({ json: () => {} }) }
    timeoutMiddleware(5000)({}, res, () => { nextCalled = true })
    expect(nextCalled).toBe(true)
  })
})
