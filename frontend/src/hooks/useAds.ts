import { useRef } from 'react'
import { useAppStore } from '../store/appStore.ts'
import { fetchAds } from '../api/adsApi.ts'

export function useAds() {
  const abortRef = useRef<AbortController | null>(null)
  const {
    setCurrentBrand, setAds, setAdsLoading,
    setAdsError, setAdsEmpty, setFromCache, clearMessages,
    clearChatMessages, setChatOpen,
    setCompetitors, setSelectedCompetitor,
  } = useAppStore()

  async function search(brandName: string, options: { forceRefresh?: boolean } = {}) {
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setAdsLoading(true)
    setAdsError(null)
    setAdsEmpty(false)
    clearMessages()
    clearChatMessages()
    setChatOpen(false)
    setCompetitors([])
    setSelectedCompetitor(null)

    try {
      const result = await fetchAds(brandName, { ...options, signal: abortRef.current.signal })

      if (result.empty) {
        setAdsEmpty(true)
        setAds([])
        setCurrentBrand(null)
        return
      }

      setCurrentBrand(result.brand)
      setAds(result.ads)
      setFromCache(result.fromCache ?? false)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      const msg = (err as { message?: string }).message || 'Failed to fetch ads. Please try again.'
      setAdsError(msg)
    } finally {
      setAdsLoading(false)
    }
  }

  return { search }
}
