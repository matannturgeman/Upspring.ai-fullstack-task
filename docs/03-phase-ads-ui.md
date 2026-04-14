# Phase 3 — Ads Exploration UI

## Goal
Build the React frontend: search bar, ad card grid with images/thumbnails/metadata, loading skeletons, empty/error states. User can browse fetched ads before AI analysis.

## Dependencies
- Phase 1 (frontend scaffold)
- Phase 2 (backend `/api/ads` endpoint working)

## Steps

### 3.1 — Global State (Zustand)

**`frontend/src/store/appStore.js`**
```js
import { create } from 'zustand'

export const useAppStore = create((set) => ({
  // Brand & Ads
  currentBrand: null,
  ads: [],
  adsLoading: false,
  adsError: null,
  adsEmpty: false,
  fromCache: false,

  // Competitors
  competitors: [],
  selectedCompetitor: null,

  // AI
  analysisMessages: [],

  setCurrentBrand: (brand) => set({ currentBrand: brand }),
  setAds: (ads) => set({ ads }),
  setAdsLoading: (loading) => set({ adsLoading: loading }),
  setAdsError: (error) => set({ adsError: error }),
  setAdsEmpty: (empty) => set({ adsEmpty: empty }),
  setFromCache: (v) => set({ fromCache: v }),
  setCompetitors: (c) => set({ competitors: c }),
  setSelectedCompetitor: (c) => set({ selectedCompetitor: c }),
  addMessage: (msg) => set(s => ({ analysisMessages: [...s.analysisMessages, msg] })),
  clearMessages: () => set({ analysisMessages: [] }),
  resetSearch: () => set({
    currentBrand: null, ads: [], adsError: null, adsEmpty: false,
    competitors: [], selectedCompetitor: null, analysisMessages: [],
  }),
}))
```

### 3.2 — API Layer

**`frontend/src/api/adsApi.js`**
```js
import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export async function fetchAds(brand, { limit = 20, forceRefresh = false } = {}) {
  const { data } = await api.get('/ads', { params: { brand, limit, forceRefresh } })
  return data
}

export async function fetchAdsByBrandId(brandId) {
  const { data } = await api.get(`/ads/${brandId}`)
  return data
}
```

### 3.3 — useAds Hook

**`frontend/src/hooks/useAds.js`**
```js
import { useState } from 'react'
import { fetchAds } from '../api/adsApi'
import { useAppStore } from '../store/appStore'

export function useAds() {
  const { setCurrentBrand, setAds, setAdsLoading, setAdsError, setAdsEmpty, setFromCache, clearMessages } = useAppStore()
  const [partial, setPartial] = useState(false)

  async function search(brandName, options = {}) {
    setAdsLoading(true)
    setAdsError(null)
    setAdsEmpty(false)
    clearMessages()

    try {
      const result = await fetchAds(brandName, options)

      if (result.empty) {
        setAdsEmpty(true)
        setAds([])
        return
      }

      setCurrentBrand(result.brand)
      setAds(result.ads)
      setFromCache(result.fromCache ?? false)
      setPartial(result.partial ?? false)
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to fetch ads. Please try again.'
      setAdsError(msg)
    } finally {
      setAdsLoading(false)
    }
  }

  return { search, partial }
}
```

### 3.4 — SearchBar Component

**`frontend/src/components/SearchBar/SearchBar.jsx`**
```jsx
import { useState } from 'react'
import { useAds } from '../../hooks/useAds'
import { useAppStore } from '../../store/appStore'

export function SearchBar() {
  const [input, setInput] = useState('')
  const { search } = useAds()
  const adsLoading = useAppStore(s => s.adsLoading)

  function handleSubmit(e) {
    e.preventDefault()
    if (input.trim()) search(input.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-xl mx-auto">
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Enter a brand name (e.g. Nike, Airbnb)"
        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={adsLoading}
      />
      <button
        type="submit"
        disabled={adsLoading || !input.trim()}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {adsLoading ? 'Searching...' : 'Search'}
      </button>
    </form>
  )
}
```

### 3.5 — AdCard Component

**`frontend/src/components/AdCard/AdCard.jsx`**
```jsx
import { useState } from 'react'

export function AdCard({ ad }) {
  const [imgError, setImgError] = useState(false)

  const mediaUrl = ad.thumbnailUrl || ad.imageUrl
  const proxyUrl = mediaUrl
    ? `/api/proxy/image?url=${encodeURIComponent(mediaUrl)}`
    : null

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition">
      {/* Media */}
      <div className="aspect-video bg-gray-100 flex items-center justify-center">
        {proxyUrl && !imgError ? (
          <img
            src={proxyUrl}
            alt="Ad creative"
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="text-gray-400 text-sm">No preview available</div>
        )}
        {ad.videoUrl && (
          <span className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
            VIDEO
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-1">
        {ad.headline && (
          <p className="font-semibold text-gray-900 text-sm line-clamp-2">{ad.headline}</p>
        )}
        {ad.primaryText && (
          <p className="text-gray-600 text-xs line-clamp-3">{ad.primaryText}</p>
        )}

        {/* Metadata */}
        <div className="flex items-center justify-between pt-1 text-xs text-gray-400">
          <span>{ad.platform || 'Facebook/Instagram'}</span>
          <span>{ad.startDate ? new Date(ad.startDate).toLocaleDateString() : 'Date unknown'}</span>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            ad.status === 'ACTIVE'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {ad.status === 'ACTIVE' ? 'Active' : 'Inactive'}
          </span>
          <span className="text-xs text-gray-400 italic">Performance data unavailable</span>
        </div>
      </div>
    </div>
  )
}
```

### 3.6 — AdGrid + Loading Skeleton

**`frontend/src/components/AdGrid/AdGrid.jsx`**
```jsx
import { AdCard } from '../AdCard/AdCard'
import { LoadingSkeleton } from '../shared/LoadingSkeleton'
import { useAppStore } from '../../store/appStore'

export function AdGrid() {
  const { ads, adsLoading, adsError, adsEmpty, fromCache } = useAppStore()

  if (adsLoading) return <LoadingSkeleton count={6} />

  if (adsError) return (
    <div className="text-center py-12 text-red-500">
      <p className="font-medium">Something went wrong</p>
      <p className="text-sm mt-1">{adsError}</p>
    </div>
  )

  if (adsEmpty) return (
    <div className="text-center py-12 text-gray-500">
      <p className="font-medium">No ads found</p>
      <p className="text-sm mt-1">Try a different brand name or check the spelling.</p>
    </div>
  )

  if (!ads.length) return null

  return (
    <div>
      {fromCache && (
        <p className="text-xs text-gray-400 mb-3 text-right">Showing cached results</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ads.map(ad => <AdCard key={ad._id} ad={ad} />)}
      </div>
    </div>
  )
}
```

**`frontend/src/components/shared/LoadingSkeleton.jsx`**
```jsx
export function LoadingSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
          <div className="aspect-video bg-gray-200" />
          <div className="p-3 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-full" />
            <div className="h-3 bg-gray-200 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
```

### 3.7 — Home Page

**`frontend/src/pages/Home.jsx`**
```jsx
import { SearchBar } from '../components/SearchBar/SearchBar'
import { AdGrid } from '../components/AdGrid/AdGrid'
import { AIChat } from '../components/AIChat/AIChat'
import { CompetitorPanel } from '../components/CompetitorPanel/CompetitorPanel'
import { useAppStore } from '../store/appStore'

export function Home() {
  const { ads, currentBrand } = useAppStore()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Upspring.ai — Ad Intelligence</h1>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <SearchBar />

        {ads.length > 0 && (
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {ads.length} ads for <span className="text-blue-600">{currentBrand?.name}</span>
            </h2>
          </div>
        )}

        <AdGrid />

        {ads.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <AIChat />
            </div>
            <div>
              <CompetitorPanel />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
```

## Key Files Created
- `frontend/src/store/appStore.js`
- `frontend/src/api/adsApi.js`
- `frontend/src/hooks/useAds.js`
- `frontend/src/components/SearchBar/SearchBar.jsx`
- `frontend/src/components/AdCard/AdCard.jsx`
- `frontend/src/components/AdGrid/AdGrid.jsx`
- `frontend/src/components/shared/LoadingSkeleton.jsx`
- `frontend/src/pages/Home.jsx`

## Success Criteria
- [ ] Search for "Nike" shows a grid of real Meta ads
- [ ] Each card shows image/thumbnail, headline, text, date, status
- [ ] "Performance data unavailable" shown clearly (not hidden)
- [ ] Loading skeleton animates during fetch
- [ ] Empty state renders for unknown brands
- [ ] Error state shows provider error message
- [ ] Image proxy handles broken image URLs gracefully
- [ ] Cache indicator shows when results are from cache
