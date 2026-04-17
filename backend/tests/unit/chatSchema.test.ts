import { describe, it, expect } from 'vitest'
import { ChatBodySchema } from '../../src/schemas/analysis.schemas'

const VALID_ID = 'a'.repeat(24)
const VALID_MSG = { role: 'user' as const, content: 'What patterns do you see?' }

describe('ChatBodySchema', () => {
  it('accepts valid brandId and messages', () => {
    const result = ChatBodySchema.safeParse({ brandId: VALID_ID, messages: [VALID_MSG] })
    expect(result.success).toBe(true)
  })

  it('accepts multi-turn conversation', () => {
    const result = ChatBodySchema.safeParse({
      brandId: VALID_ID,
      messages: [
        { role: 'user', content: 'What patterns?' },
        { role: 'assistant', content: 'Urgency is common.' },
        { role: 'user', content: 'What else?' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts mixed-case hex brandId', () => {
    const result = ChatBodySchema.safeParse({
      brandId: 'aAbBcCdDeEfF001122334455',
      messages: [VALID_MSG],
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing brandId', () => {
    const result = ChatBodySchema.safeParse({ messages: [VALID_MSG] })
    expect(result.success).toBe(false)
  })

  it('rejects brandId shorter than 24 chars', () => {
    const result = ChatBodySchema.safeParse({ brandId: 'abc123', messages: [VALID_MSG] })
    expect(result.success).toBe(false)
  })

  it('rejects non-hex brandId', () => {
    const result = ChatBodySchema.safeParse({ brandId: 'z'.repeat(24), messages: [VALID_MSG] })
    expect(result.success).toBe(false)
  })

  it('rejects empty messages array', () => {
    const result = ChatBodySchema.safeParse({ brandId: VALID_ID, messages: [] })
    expect(result.success).toBe(false)
  })

  it('rejects messages array exceeding 40', () => {
    const messages = Array.from({ length: 41 }, () => VALID_MSG)
    const result = ChatBodySchema.safeParse({ brandId: VALID_ID, messages })
    expect(result.success).toBe(false)
  })

  it('rejects invalid message role', () => {
    const result = ChatBodySchema.safeParse({
      brandId: VALID_ID,
      messages: [{ role: 'system', content: 'hello' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty message content', () => {
    const result = ChatBodySchema.safeParse({
      brandId: VALID_ID,
      messages: [{ role: 'user', content: '' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing messages field', () => {
    const result = ChatBodySchema.safeParse({ brandId: VALID_ID })
    expect(result.success).toBe(false)
  })

  it('rejects SQL injection in brandId', () => {
    const result = ChatBodySchema.safeParse({
      brandId: "'; DROP TABLE brands; --",
      messages: [VALID_MSG],
    })
    expect(result.success).toBe(false)
  })
})
