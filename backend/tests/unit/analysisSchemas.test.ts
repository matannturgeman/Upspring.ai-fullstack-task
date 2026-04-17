import { describe, it, expect } from 'vitest'
import { AnalysisBodySchema } from '../../src/schemas/analysis.schemas'

describe('AnalysisBodySchema', () => {
  const VALID_ID = 'a'.repeat(24)

  it('accepts a valid 24-char hex ObjectId', () => {
    const result = AnalysisBodySchema.safeParse({ adId: VALID_ID })
    expect(result.success).toBe(true)
  })

  it('accepts mixed-case hex ObjectId', () => {
    const result = AnalysisBodySchema.safeParse({ adId: 'aAbBcCdDeEfF001122334455' })
    expect(result.success).toBe(true)
  })

  it('rejects empty string', () => {
    const result = AnalysisBodySchema.safeParse({ adId: '' })
    expect(result.success).toBe(false)
  })

  it('rejects string shorter than 24 chars', () => {
    const result = AnalysisBodySchema.safeParse({ adId: 'abc123' })
    expect(result.success).toBe(false)
  })

  it('rejects string longer than 24 chars', () => {
    const result = AnalysisBodySchema.safeParse({ adId: 'a'.repeat(25) })
    expect(result.success).toBe(false)
  })

  it('rejects non-hex characters', () => {
    const result = AnalysisBodySchema.safeParse({ adId: 'z'.repeat(24) })
    expect(result.success).toBe(false)
  })

  it('rejects SQL injection attempt', () => {
    const result = AnalysisBodySchema.safeParse({ adId: "'; DROP TABLE ads; --" })
    expect(result.success).toBe(false)
  })

  it('rejects missing adId field', () => {
    const result = AnalysisBodySchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects non-string adId', () => {
    const result = AnalysisBodySchema.safeParse({ adId: 12345 })
    expect(result.success).toBe(false)
  })
})
