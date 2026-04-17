import { useRef } from 'react'
import { apiUrl } from '../config/api.ts'
import { useAppStore } from '../store/appStore.ts'

export function useAnalysis() {
  const abortRef = useRef<AbortController | null>(null)
  const {
    addMessage,
    updateLastMessage,
    clearMessages,
    setSelectedAdId,
    setAnalysisLoading,
    setAnalysisError,
  } = useAppStore()

  async function analyze(adId: string) {
    // Cancel any in-flight request
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setSelectedAdId(adId)
    setAnalysisLoading(true)
    setAnalysisError(null)
    clearMessages()

    const msgId = crypto.randomUUID()
    addMessage({ id: msgId, role: 'ai', text: '', streaming: true })

    try {
      const res = await fetch(apiUrl('/analysis'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { message?: string }).message ?? 'Analysis failed')
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
              updateLastMessage(msgId, accumulated, true)
            }
          } catch {
            // partial chunk — skip
          }
        }
      }

      updateLastMessage(msgId, accumulated, false)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setAnalysisError(msg)
      updateLastMessage(msgId, '', false)
    } finally {
      setAnalysisLoading(false)
    }
  }

  function close() {
    abortRef.current?.abort()
    setSelectedAdId(null)
    clearMessages()
    setAnalysisError(null)
  }

  return { analyze, close }
}
