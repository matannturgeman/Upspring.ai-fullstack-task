import { useAppStore } from '../../store/appStore.ts'
import { useCompetitors } from '../../hooks/useCompetitors.ts'

export function CompetitorPanel() {
  const { competitors, selectedCompetitor } = useAppStore()
  const { discover, selectCompetitor, loading, error, source } = useCompetitors()

  return (
    <aside
      aria-label="Competitor discovery"
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Competitors</h2>
        <button
          onClick={discover}
          disabled={loading}
          className="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white rounded-lg disabled:opacity-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          {loading ? 'Finding...' : 'Find Competitors'}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-500 dark:text-red-400 mb-2">{error}</p>
      )}

      {source && !error && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic mb-3">
          {source === 'perplexity' ? 'Via web search' :
           source === 'claude'     ? 'Via AI reasoning from ad content' :
                                     'Mock data'}
        </p>
      )}

      {competitors.length === 0 && !loading && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Click "Find Competitors" to discover competing brands.
        </p>
      )}

      <ul className="space-y-2" role="list">
        {competitors.map(c => (
          <li key={c.name}>
            <button
              onClick={() => selectCompetitor(c)}
              aria-pressed={selectedCompetitor?.name === c.name}
              className={`w-full text-left p-3 rounded-lg border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                selectedCompetitor?.name === c.name
                  ? 'border-purple-400 bg-purple-50 dark:bg-purple-950 dark:border-purple-700'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <p className="font-medium text-xs text-gray-900 dark:text-gray-100">{c.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{c.reason}</p>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
