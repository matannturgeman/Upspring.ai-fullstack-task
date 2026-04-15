import { useAppStore } from '../store/appStore.ts'

export function useAnalysis() {
  const {
    addMessage,
    updateLastMessage,
    clearMessages,
    setSelectedAdId,
    setAnalysisLoading,
    setAnalysisError,
  } = useAppStore()

  async function analyze(adId: string) {
    setSelectedAdId(adId)
    setAnalysisLoading(true)
    setAnalysisError(null)
    clearMessages()

    const msgId = Date.now()
    addMessage({ id: msgId, role: 'ai', text: '', streaming: true })

    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId }),
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
        const lines = raw.split('\n')

        for (const line of lines) {
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
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setAnalysisError(msg)
      updateLastMessage(msgId, '', false)
    } finally {
      setAnalysisLoading(false)
    }
  }

  function close() {
    setSelectedAdId(null)
    clearMessages()
    setAnalysisError(null)
  }

  return { analyze, close }
}
