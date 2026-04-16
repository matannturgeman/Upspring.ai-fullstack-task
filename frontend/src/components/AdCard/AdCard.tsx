import { useState } from 'react'
import type { AdDto } from '../../types/ad.types.ts'
import { useAnalysis } from '../../hooks/useAnalysis.ts'
import { useAppStore } from '../../store/appStore.ts'

interface Props {
  ad: AdDto
}

export function AdCard({ ad }: Props) {
  const [imgError, setImgError] = useState(false)
  const { analyze } = useAnalysis()
  const { selectedAdId, analysisLoading } = useAppStore(s => ({
    selectedAdId: s.selectedAdId,
    analysisLoading: s.analysisLoading,
  }))

  const mediaUrl = ad.thumbnailUrl || ad.imageUrl
  const proxyUrl = mediaUrl
    ? `/api/proxy/image?url=${encodeURIComponent(mediaUrl)}`
    : null

  const isSelected = selectedAdId === ad._id
  const isAnalyzing = isSelected && analysisLoading

  return (
    <article
      data-testid="ad-card"
      aria-label={ad.headline ?? 'Ad'}
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-md dark:hover:shadow-gray-900 transition h-full flex flex-col"
    >
      {/* Media */}
      <div className="aspect-video bg-gray-100 dark:bg-gray-800 flex items-center justify-center relative" role="img" aria-label={ad.headline ? `Ad image for: ${ad.headline}` : 'Ad creative'}>
        {proxyUrl && !imgError ? (
          <img
            src={proxyUrl}
            alt={ad.headline ?? 'Ad creative'}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <span className="text-gray-400 dark:text-gray-600 text-sm" aria-label="No preview available">No preview available</span>
        )}
        {ad.videoUrl && (
          <span
            aria-label={mediaUrl ? 'Video ad — thumbnail analyzed' : 'Video ad — no thumbnail, visual analysis limited'}
            title={mediaUrl ? 'Video ad — thumbnail used as visual proxy for AI analysis' : 'Video ad — no thumbnail available; AI analysis based on copy only'}
            className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded font-medium"
          >
            {mediaUrl ? 'VIDEO' : 'VIDEO · no thumbnail'}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-1 flex flex-col flex-1">
        {ad.headline && (
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm line-clamp-2">{ad.headline}</h3>
        )}
        {ad.primaryText && (
          <p className="text-gray-600 dark:text-gray-400 text-xs line-clamp-3">{ad.primaryText}</p>
        )}

        <div className="flex items-center justify-between pt-1 text-xs text-gray-400 dark:text-gray-500">
          <span aria-label={`Platform: ${ad.platform}`}>{ad.platform}</span>
          <time dateTime={ad.startDate} aria-label={ad.startDate ? `Started ${new Date(ad.startDate).toLocaleDateString()}` : 'Date unknown'}>
            {ad.startDate ? new Date(ad.startDate).toLocaleDateString() : 'Date unknown'}
          </time>
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <span
            role="status"
            aria-label={`Status: ${ad.status === 'ACTIVE' ? 'Active' : 'Inactive'}`}
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              ad.status === 'ACTIVE'
                ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}
          >
            {ad.status === 'ACTIVE' ? 'Active' : 'Inactive'}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-600 italic">Performance data unavailable</span>
        </div>

        <button
          onClick={() => analyze(ad._id)}
          disabled={analysisLoading}
          aria-label={isAnalyzing ? 'Analyzing with AI' : `Analyze with AI${ad.headline ? ` – ${ad.headline}` : ''}`}
          aria-pressed={isSelected}
          className={`w-full mt-auto pt-2 py-1.5 text-xs font-medium rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
            isSelected
              ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-purple-50 dark:hover:bg-purple-950 hover:text-purple-700 dark:hover:text-purple-300'
          } disabled:opacity-50`}
        >
          {isAnalyzing ? 'Analyzing...' : '✦ Analyze with AI'}
        </button>
      </div>
    </article>
  )
}
