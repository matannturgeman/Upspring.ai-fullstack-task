import { SearchBar } from '../components/SearchBar/SearchBar.tsx'
import { AdGrid } from '../components/AdGrid/AdGrid.tsx'
import { useAppStore } from '../store/appStore.ts'

export function Home() {
  const { ads, currentBrand, adsLoading } = useAppStore()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Upspring.ai — Ad Intelligence</h1>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-semibold text-gray-800">Research Brand Ads</h2>
          <p className="text-gray-500 text-sm">Enter a brand name to explore their Meta ads</p>
          <SearchBar />
        </div>

        {adsLoading && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 max-w-md mx-auto">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800">Fetching ads from Meta Ads Library...</p>
              <p className="text-xs text-blue-600">This can take 15–30 seconds</p>
            </div>
          </div>
        )}

        {!adsLoading && ads.length > 0 && currentBrand && (
          <p className="text-sm text-gray-600 font-medium">
            {ads.length} ads found for <span className="text-blue-600">{currentBrand.name}</span>
          </p>
        )}

        <AdGrid />
      </main>
    </div>
  )
}
