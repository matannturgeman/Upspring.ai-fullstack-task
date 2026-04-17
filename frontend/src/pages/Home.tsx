import { SearchBar } from '../components/SearchBar/SearchBar.tsx'
import { AdGrid } from '../components/AdGrid/AdGrid.tsx'
import { ThemeToggle } from '../components/ThemeToggle/ThemeToggle.tsx'
import { AnalysisPanel } from '../components/AnalysisPanel/AnalysisPanel.tsx'
import { CompetitorPanel } from '../components/CompetitorPanel/CompetitorPanel.tsx'
import { BrandChat } from '../components/BrandChat/BrandChat.tsx'
import { useAppStore } from '../store/appStore.ts'
import { useTheme } from '../hooks/useTheme.ts'

export function Home() {
  const { ads, currentBrand, adsLoading, setChatOpen } = useAppStore()
  const { theme, toggle } = useTheme()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header
        className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 shadow-sm"
        role="banner"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <a
            href="/"
            className="text-xl font-bold text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            Upspring.ai — Ad Intelligence
          </a>
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6" id="main-content" role="main">
        <section aria-labelledby="search-heading" className="flex flex-col items-center gap-2">
          <h1
            id="search-heading"
            className="text-2xl font-semibold text-gray-800 dark:text-gray-100"
          >
            Research Brand Ads
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Enter a brand name to explore their Meta ads
          </p>
          <SearchBar />
        </section>

        {adsLoading && (
          <div
            role="status"
            aria-live="polite"
            aria-label="Fetching ads"
            className="flex items-center gap-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 max-w-md mx-auto"
          >
            <div
              aria-hidden="true"
              className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0"
            />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                Fetching ads from Meta Ads Library...
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                This can take 15–30 seconds
              </p>
            </div>
          </div>
        )}

        {!adsLoading && ads.length > 0 && currentBrand && (
          <div className="flex items-center justify-between">
            <p aria-live="polite" className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              {ads.length} ads found for{' '}
              <span className="text-blue-600 dark:text-blue-400">{currentBrand.name}</span>
            </p>
            <button
              onClick={() => setChatOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <span aria-hidden="true">✦</span>
              Ask AI about these ads
            </button>
          </div>
        )}

        {!adsLoading && ads.length > 0 && currentBrand && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
            <section aria-label="Ad results">
              <AdGrid />
            </section>
            <CompetitorPanel />
          </div>
        )}

        {(adsLoading || ads.length === 0) && (
          <section aria-label="Ad results">
            <AdGrid />
          </section>
        )}
      </main>

      <AnalysisPanel />
      <BrandChat />
    </div>
  )
}
