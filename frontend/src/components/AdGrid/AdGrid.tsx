import { AdCard } from '../AdCard/AdCard.tsx'
import { LoadingSkeleton } from '../shared/LoadingSkeleton.tsx'
import { EmptyState } from '../shared/EmptyState.tsx'
import { ErrorState } from '../shared/ErrorState.tsx'
import { useAppStore } from '../../store/appStore.ts'

export function AdGrid() {
  const { ads, adsLoading, adsError, adsEmpty, fromCache } = useAppStore()

  if (adsLoading) return <LoadingSkeleton count={6} />

  if (adsError) return <ErrorState message={adsError} />

  if (adsEmpty) return <EmptyState />

  if (!ads.length) return null

  return (
    <div>
      {fromCache && (
        <p role="note" className="text-xs text-gray-400 dark:text-gray-600 mb-3 text-right">
          Showing cached results
        </p>
      )}
      <ul
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        aria-label={`${ads.length} ads`}
      >
        {ads.map((ad) => (
          <li key={ad._id}>
            <AdCard ad={ad} />
          </li>
        ))}
      </ul>
    </div>
  )
}
