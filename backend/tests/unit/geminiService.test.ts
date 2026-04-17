import { describe, it, expect, vi } from 'vitest'

vi.mock('../../src/utils/mockMode', () => ({ isMockLLM: vi.fn(), isMockScraper: vi.fn() }))
vi.mock('../../src/mocks/claudeMock', () => ({
  streamMockAnalysis: async function* () {
    yield 'Video '
    yield 'analysis '
    yield 'complete.'
  },
}))

import { isMockLLM } from '../../src/utils/mockMode'
import { GeminiService } from '../../src/services/GeminiService'

const videoAd = {
  platform: 'Facebook',
  status: 'ACTIVE' as const,
  headline: 'Watch our story',
  primaryText: 'See why thousands switched.',
  videoUrl: 'https://example.com/ad.mp4',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  imageUrl: undefined,
}

const imageAd = {
  platform: 'Instagram',
  status: 'ACTIVE' as const,
  headline: 'Shop now',
  primaryText: '50% off today.',
  videoUrl: undefined,
  thumbnailUrl: undefined,
  imageUrl: 'https://example.com/image.jpg',
}

describe('GeminiService.streamAnalysis', () => {
  const service = new GeminiService()

  it('yields mock tokens in mock mode (video ad)', async () => {
    vi.mocked(isMockLLM).mockReturnValue(true)
    const chunks: string[] = []
    for await (const chunk of service.streamAnalysis(videoAd)) {
      chunks.push(chunk)
    }
    expect(chunks).toEqual(['Video ', 'analysis ', 'complete.'])
  })

  it('yields mock tokens in mock mode (image ad)', async () => {
    vi.mocked(isMockLLM).mockReturnValue(true)
    const chunks: string[] = []
    for await (const chunk of service.streamAnalysis(imageAd)) {
      chunks.push(chunk)
    }
    expect(chunks).toEqual(['Video ', 'analysis ', 'complete.'])
  })

  it('yields at least one chunk in mock mode', async () => {
    vi.mocked(isMockLLM).mockReturnValue(true)
    const gen = service.streamAnalysis(videoAd)
    const first = await gen.next()
    expect(first.done).toBe(false)
    expect(typeof first.value).toBe('string')
  })

  it('throws if GEMINI_API_KEY missing and not mock mode', async () => {
    vi.mocked(isMockLLM).mockReturnValue(false)
    const gen = service.streamAnalysis(videoAd)
    await expect(gen.next()).rejects.toThrow('GEMINI_API_KEY')
  })
})
