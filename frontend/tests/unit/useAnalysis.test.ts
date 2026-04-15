import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnalysis } from '../../src/hooks/useAnalysis.ts'

const mockStore = {
  addMessage: vi.fn(),
  updateLastMessage: vi.fn(),
  clearMessages: vi.fn(),
  setSelectedAdId: vi.fn(),
  setAnalysisLoading: vi.fn(),
  setAnalysisError: vi.fn(),
}

vi.mock('../../src/store/appStore.ts', () => ({
  useAppStore: () => mockStore,
}))

function makeStreamResponse(chunks: string[]) {
  const lines = [
    ...chunks.map(c => `data: ${JSON.stringify({ text: c })}\n\n`),
    'data: [DONE]\n\n',
  ].join('')

  const encoder = new TextEncoder()
  const encoded = encoder.encode(lines)
  let pos = 0

  const stream = new ReadableStream({
    pull(controller) {
      if (pos >= encoded.length) { controller.close(); return }
      controller.enqueue(encoded.slice(pos, pos + 50))
      pos += 50
    },
  })

  return new Response(stream, { status: 200 })
}

describe('useAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' })
  })

  it('uses a string UUID as message ID (not Date.now)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeStreamResponse(['Hello']))

    const { result } = renderHook(() => useAnalysis())
    await act(() => result.current.analyze('aabbccddeeff001122334455'))

    expect(mockStore.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'test-uuid-1234', role: 'ai' })
    )
  })

  it('calls setSelectedAdId with the adId', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeStreamResponse(['text']))

    const { result } = renderHook(() => useAnalysis())
    await act(() => result.current.analyze('aabbccddeeff001122334455'))

    expect(mockStore.setSelectedAdId).toHaveBeenCalledWith('aabbccddeeff001122334455')
  })

  it('sets loading true then false', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeStreamResponse(['text']))

    const { result } = renderHook(() => useAnalysis())
    await act(() => result.current.analyze('aabbccddeeff001122334455'))

    expect(mockStore.setAnalysisLoading).toHaveBeenCalledWith(true)
    expect(mockStore.setAnalysisLoading).toHaveBeenCalledWith(false)
  })

  it('silently ignores AbortError (user cancelled)', async () => {
    const abortError = Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })
    vi.mocked(fetch).mockRejectedValueOnce(abortError)

    const { result } = renderHook(() => useAnalysis())
    await act(() => result.current.analyze('aabbccddeeff001122334455'))

    expect(mockStore.setAnalysisError).not.toHaveBeenCalledWith(expect.any(String))
  })

  it('sets error on non-abort failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failed'))

    const { result } = renderHook(() => useAnalysis())
    await act(() => result.current.analyze('aabbccddeeff001122334455'))

    expect(mockStore.setAnalysisError).toHaveBeenCalledWith('Network failed')
  })

  it('close() resets selectedAdId and clears messages', () => {
    const { result } = renderHook(() => useAnalysis())
    act(() => result.current.close())

    expect(mockStore.setSelectedAdId).toHaveBeenCalledWith(null)
    expect(mockStore.clearMessages).toHaveBeenCalled()
    expect(mockStore.setAnalysisError).toHaveBeenCalledWith(null)
  })
})
