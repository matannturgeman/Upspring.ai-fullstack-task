import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/utils/mockMode.ts', () => ({ isMockMode: vi.fn() }))
vi.mock('../../src/mocks/claudeMock.ts', () => ({
  streamMockAnalysis: async function* () {
    yield 'Headline '
    yield 'analysis '
    yield 'complete.'
  },
}))

import { isMockMode } from '../../src/utils/mockMode.ts'
import { streamAnalysis } from '../../src/services/claudeService.ts'

const ad = {
  platform: 'Facebook',
  status: 'ACTIVE' as const,
  headline: 'Buy now',
  primaryText: '50% off today only.',
  imageUrl: undefined,
  videoUrl: undefined,
  thumbnailUrl: undefined,
}

describe('claudeService.streamAnalysis', () => {
  beforeEach(() => vi.clearAllMocks())

  it('yields mock tokens in mock mode', async () => {
    vi.mocked(isMockMode).mockReturnValue(true)
    const chunks: string[] = []
    for await (const chunk of streamAnalysis(ad)) {
      chunks.push(chunk)
    }
    expect(chunks).toEqual(['Headline ', 'analysis ', 'complete.'])
  })

  it('yields at least one chunk in mock mode', async () => {
    vi.mocked(isMockMode).mockReturnValue(true)
    const gen = streamAnalysis(ad)
    const first = await gen.next()
    expect(first.done).toBe(false)
    expect(typeof first.value).toBe('string')
  })
})
