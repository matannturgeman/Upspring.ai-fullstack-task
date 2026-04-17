import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { useAppStore } from '../../store/appStore.ts'
import { useAnalysis } from '../../hooks/useAnalysis.ts'

export function AnalysisPanel() {
  const { selectedAdId, analysisMessages, analysisLoading, analysisError } = useAppStore()
  const ads = useAppStore((s) => s.ads)
  const selectedAd = ads.find((a) => a._id === selectedAdId)
  const modelLabel = selectedAd?.videoUrl ? 'gemini-2.0-flash' : 'claude-sonnet-4-6'
  const { close } = useAnalysis()
  const bottomRef = useRef<HTMLDivElement>(null)

  const message = analysisMessages[0]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [message?.text])

  if (!selectedAdId) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="AI Ad Analysis"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              AI Ad Analysis
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{modelLabel}</span>
          </div>
          <button
            onClick={close}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition text-xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded"
            aria-label="Close analysis panel"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {analysisError && (
            <div
              role="alert"
              className="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3"
            >
              {analysisError}
            </div>
          )}

          {message && (
            <div className="flex gap-3">
              <div
                aria-hidden="true"
                className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold"
              >
                AI
              </div>
              <div className="flex-1 min-w-0 prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200">
                <ReactMarkdown>{message.text}</ReactMarkdown>
                {message.streaming && (
                  <span
                    aria-hidden="true"
                    className="inline-block w-2 h-4 bg-purple-500 animate-pulse rounded-sm align-middle ml-0.5"
                  />
                )}
              </div>
            </div>
          )}

          {analysisLoading && !message?.text && (
            <div role="status" aria-live="polite" className="flex gap-3 items-center">
              <div
                aria-hidden="true"
                className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center"
              >
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
              <span className="text-sm text-gray-400 dark:text-gray-500 italic">
                Analyzing ad...
              </span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
