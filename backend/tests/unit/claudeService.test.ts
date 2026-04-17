import { describe, it, expect, vi } from 'vitest'

vi.mock('../../src/utils/mockMode', () => ({ isMockLLM: vi.fn(), isMockMode: vi.fn() }))
vi.mock('../../src/mocks/claudeMock', () => ({
  streamMockAnalysis: async function* () {
    yield 'Headline '
    yield 'analysis '
    yield 'complete.'
  },
  streamMockChat: async function* () {
    yield 'Urgency '
    yield 'dominates.'
  },
}))

import { isMockLLM } from '../../src/utils/mockMode'
import { ClaudeService } from '../../src/services/ClaudeService'

const ad = {
  platform: 'Facebook',
  status: 'ACTIVE' as const,
  headline: 'Buy now',
  primaryText: '50% off today only.',
  imageUrl: undefined,
  videoUrl: undefined,
  thumbnailUrl: undefined,
}

const ads = [ad]
const messages = [{ role: 'user' as const, content: 'What patterns do you see?' }]

describe('ClaudeService.streamChat', () => {
  const service = new ClaudeService()

  it('yields mock tokens in mock mode', async () => {
    vi.mocked(isMockLLM).mockReturnValue(true)
    const chunks: string[] = []
    for await (const chunk of service.streamChat('Nike', ads, messages)) {
      chunks.push(chunk)
    }
    expect(chunks).toEqual(['Urgency ', 'dominates.'])
  })

  it('yields at least one chunk in mock mode', async () => {
    vi.mocked(isMockLLM).mockReturnValue(true)
    const gen = service.streamChat('Nike', ads, messages)
    const first = await gen.next()
    expect(first.done).toBe(false)
    expect(typeof first.value).toBe('string')
  })

  it('works with empty ads array in mock mode', async () => {
    vi.mocked(isMockLLM).mockReturnValue(true)
    const chunks: string[] = []
    for await (const chunk of service.streamChat('Nike', [], messages)) {
      chunks.push(chunk)
    }
    expect(chunks.length).toBeGreaterThan(0)
  })
})

describe('ClaudeService.streamAnalysis', () => {
  const service = new ClaudeService()

  it('yields mock tokens in mock mode', async () => {
    vi.mocked(isMockLLM).mockReturnValue(true)
    const chunks: string[] = []
    for await (const chunk of service.streamAnalysis(ad)) {
      chunks.push(chunk)
    }
    expect(chunks).toEqual(['Headline ', 'analysis ', 'complete.'])
  })

  it('yields at least one chunk in mock mode', async () => {
    vi.mocked(isMockLLM).mockReturnValue(true)
    const gen = service.streamAnalysis(ad)
    const first = await gen.next()
    expect(first.done).toBe(false)
    expect(typeof first.value).toBe('string')
  })
})
