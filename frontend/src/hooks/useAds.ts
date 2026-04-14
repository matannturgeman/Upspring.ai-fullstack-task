import { useAppStore } from '../store/appStore.ts'
import { fetchAds } from '../api/adsApi.ts'

export function useAds() {
  const {
    setCurrentBrand, setAds, setAdsLoading,
    setAdsError, setAdsEmpty, setFromCache, clearMessages,
  } = useAppStore()

  async function search(brandName: string, options: { forceRefresh?: boolean } = {}) {
    setAdsLoading(true)
    setAdsError(null)
    setAdsEmpty(false)
    clearMessages()

    try {
      const result = await fetchAds(brandName, options)

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
      const msg = (err as { message?: string }).message || 'Failed to fetch ads. Please try again.'
      setAdsError(msg)
    } finally {
      setAdsLoading(false)
    }
  }

  return { search }
}
