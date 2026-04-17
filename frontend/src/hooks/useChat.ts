import { useRef } from 'react'
import { useAppStore } from '../store/appStore.ts'

export function useChat() {
  const abortRef = useRef<AbortController | null>(null)
  const {
    chatMessages,
    addChatMessage,
    updateChatMessage,
    setChatLoading,
    setChatError,
    setChatOpen,
  } = useAppStore()

  async function sendMessage(brandId: string, userText: string) {
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const userMsgId = crypto.randomUUID()
    addChatMessage({ id: userMsgId, role: 'user', text: userText })

    const aiMsgId = crypto.randomUUID()
    addChatMessage({ id: aiMsgId, role: 'ai', text: '', streaming: true })

    setChatLoading(true)
    setChatError(null)

    // chatMessages is the pre-send snapshot (captured at render time, before addChatMessage calls above).
    // Intentional: the API receives only prior history + new user message,
    // not the blank AI placeholder just added for the UI.
    const history = [
      ...chatMessages.map(m => ({ role: m.role === 'ai' ? 'assistant' as const : 'user' as const, content: m.text })),
      { role: 'user' as const, content: userText },
    ]

    try {
      const res = await fetch('/api/analysis/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, messages: history }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { message?: string }).message ?? 'Chat failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const raw = decoder.decode(value, { stream: true })
        for (const line of raw.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') break
          try {
            const parsed = JSON.parse(payload) as { text?: string; error?: string }
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.text) {
              accumulated += parsed.text
              updateChatMessage(aiMsgId, accumulated, true)
            }
          } catch {
            // partial chunk — skip
          }
        }
      }

      updateChatMessage(aiMsgId, accumulated, false)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setChatError(msg)
      updateChatMessage(aiMsgId, '', false)
    } finally {
      setChatLoading(false)
    }
  }

  function closeChat() {
    abortRef.current?.abort()
    setChatOpen(false)
  }

  return { sendMessage, closeChat }
}
