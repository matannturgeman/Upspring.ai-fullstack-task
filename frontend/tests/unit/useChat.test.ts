import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChat } from '../../src/hooks/useChat.ts'

const mockStore = {
  chatMessages: [] as { id: string; role: 'user' | 'ai'; text: string; streaming?: boolean }[],
  addChatMessage: vi.fn(),
  updateChatMessage: vi.fn(),
  setChatLoading: vi.fn(),
  setChatError: vi.fn(),
  setChatOpen: vi.fn(),
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

const BRAND_ID = 'aabbccddeeff001122334455'

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.chatMessages = []
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValueOnce('user-id').mockReturnValueOnce('ai-id') })
  })

  it('adds user message and AI placeholder on sendMessage', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeStreamResponse(['Hello']))

    const { result } = renderHook(() => useChat())
    await act(() => result.current.sendMessage(BRAND_ID, 'What patterns?'))

    expect(mockStore.addChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'user', text: 'What patterns?' })
    )
    expect(mockStore.addChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'ai', text: '', streaming: true })
    )
  })

  it('posts to /api/analysis/chat with brandId and conversation history', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeStreamResponse(['ok']))

    mockStore.chatMessages = [
      { id: 'prev-ai', role: 'ai', text: 'Prior response' },
    ]

    const { result } = renderHook(() => useChat())
    await act(() => result.current.sendMessage(BRAND_ID, 'Follow-up?'))

    expect(fetch).toHaveBeenCalledWith('/api/analysis/chat', expect.objectContaining({
      method: 'POST',
    }))

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)
    expect(body.brandId).toBe(BRAND_ID)
    expect(body.messages).toEqual(expect.arrayContaining([
      { role: 'assistant', content: 'Prior response' },
      { role: 'user', content: 'Follow-up?' },
    ]))
  })

  it('accumulates streamed text into AI message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeStreamResponse(['Hello ', 'world']))

    const { result } = renderHook(() => useChat())
    await act(() => result.current.sendMessage(BRAND_ID, 'What patterns?'))

    const calls = vi.mocked(mockStore.updateChatMessage).mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall[1]).toBe('Hello world')
    expect(lastCall[2]).toBe(false) // streaming ended
  })

  it('sets loading true then false', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeStreamResponse(['text']))

    const { result } = renderHook(() => useChat())
    await act(() => result.current.sendMessage(BRAND_ID, 'Q'))

    expect(mockStore.setChatLoading).toHaveBeenCalledWith(true)
    expect(mockStore.setChatLoading).toHaveBeenCalledWith(false)
  })

  it('silently ignores AbortError', async () => {
    const abortError = Object.assign(new Error('Aborted'), { name: 'AbortError' })
    vi.mocked(fetch).mockRejectedValueOnce(abortError)

    const { result } = renderHook(() => useChat())
    await act(() => result.current.sendMessage(BRAND_ID, 'Q'))

    expect(mockStore.setChatError).not.toHaveBeenCalledWith(expect.any(String))
  })

  it('sets chatError on network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useChat())
    await act(() => result.current.sendMessage(BRAND_ID, 'Q'))

    expect(mockStore.setChatError).toHaveBeenCalledWith('Network error')
  })

  it('sets chatError on 500 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Server error' }), { status: 500 })
    )

    const { result } = renderHook(() => useChat())
    await act(() => result.current.sendMessage(BRAND_ID, 'Q'))

    expect(mockStore.setChatError).toHaveBeenCalledWith('Server error')
  })

  it('closeChat sets chatOpen false', () => {
    const { result } = renderHook(() => useChat())
    act(() => result.current.closeChat())
    expect(mockStore.setChatOpen).toHaveBeenCalledWith(false)
  })

  it('maps ai role to assistant for API payload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeStreamResponse(['ok']))

    mockStore.chatMessages = [
      { id: 'u1', role: 'user', text: 'First question' },
      { id: 'a1', role: 'ai', text: 'First answer' },
    ]

    const { result } = renderHook(() => useChat())
    await act(() => result.current.sendMessage(BRAND_ID, 'Next question'))

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)
    const roles = body.messages.map((m: { role: string }) => m.role)
    expect(roles).toContain('assistant') // ai → assistant
    expect(roles).not.toContain('ai')
  })
})
