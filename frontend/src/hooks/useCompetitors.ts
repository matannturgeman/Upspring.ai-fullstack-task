import { useState } from 'react'
import { findCompetitors } from '../api/competitorApi.ts'
import { useAppStore } from '../store/appStore.ts'
import { useAds } from './useAds.ts'

export function useCompetitors() {
  const { currentBrand, setCompetitors, setSelectedCompetitor } = useAppStore()
  const { search } = useAds()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<string | null>(null)

  async function discover() {
    if (!currentBrand) return
    setLoading(true)
    setError(null)
    try {
      const result = await findCompetitors(currentBrand.name, currentBrand._id)
      setCompetitors(result.competitors)
      setSource(result.source)
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Could not find competitors')
    } finally {
      setLoading(false)
    }
  }

  async function selectCompetitor(competitor: { name: string; reason: string }) {
    setSelectedCompetitor(competitor)
    await search(competitor.name)
  }

  return { discover, selectCompetitor, loading, error, source }
}
