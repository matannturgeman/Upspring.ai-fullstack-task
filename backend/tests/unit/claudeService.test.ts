import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/utils/mockMode.ts', () => ({ isMockLLM: vi.fn(), isMockMode: vi.fn() }))
vi.mock('../../src/mocks/claudeMock.ts', () => ({
  streamMockAnalysis: async function* () {
    yield 'Headline '
    yield 'analysis '
    yield 'complete.'
  },
}))

import { isMockLLM } from '../../src/utils/mockMode.ts'
import { ClaudeService } from '../../src/services/ClaudeService.ts'

const ad = {
  platform: 'Facebook',
  status: 'ACTIVE' as const,
  headline: 'Buy now',
  primaryText: '50% off today only.',
  imageUrl: undefined,
  videoUrl: undefined,
  thumbnailUrl: undefined,
}

describe('ClaudeService.streamAnalysis', () => {
  const service = new ClaudeService()

  beforeEach(() => vi.clearAllMocks())

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
