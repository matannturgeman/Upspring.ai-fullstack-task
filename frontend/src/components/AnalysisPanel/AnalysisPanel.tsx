import { useEffect, useRef } from 'react'
import { useAppStore } from '../../store/appStore.ts'
import { useAnalysis } from '../../hooks/useAnalysis.ts'

export function AnalysisPanel() {
  const { selectedAdId, analysisMessages, analysisLoading, analysisError } = useAppStore()
  const { close } = useAnalysis()
  const bottomRef = useRef<HTMLDivElement>(null)

  const message = analysisMessages[0]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [message?.text])

  if (!selectedAdId) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              AI Ad Analysis
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
              claude-sonnet-4-6
            </span>
          </div>
          <button
            onClick={close}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {analysisError && (
            <div className="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
              {analysisError}
            </div>
          )}

          {message && (
            <div className="flex gap-3">
              {/* Avatar */}
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                AI
              </div>
              {/* Message */}
              <div className="flex-1 min-w-0">
                <MarkdownText text={message.text} streaming={message.streaming ?? false} />
              </div>
            </div>
          )}

          {analysisLoading && !message?.text && (
            <div className="flex gap-3 items-center">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
              <span className="text-sm text-gray-400 dark:text-gray-500 italic">Analyzing ad...</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}

function MarkdownText({ text, streaming }: { text: string; streaming: boolean }) {
  if (!text) return null

  const lines = text.split('\n')

  return (
    <div className="text-sm text-gray-800 dark:text-gray-200 space-y-2 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return <h3 key={i} className="font-bold text-base text-gray-900 dark:text-white mt-3 first:mt-0">{line.slice(3)}</h3>
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} className="font-semibold text-gray-900 dark:text-white">{line.slice(2, -2)}</p>
        }
        // Inline bold
        const parts = line.split(/(\*\*[^*]+\*\*)/)
        const rendered = parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j} className="font-semibold text-gray-900 dark:text-white">{part.slice(2, -2)}</strong>
            : part
        )
        return line ? <p key={i}>{rendered}</p> : <div key={i} className="h-1" />
      })}
      {streaming && (
        <span className="inline-block w-2 h-4 bg-purple-500 animate-pulse rounded-sm align-middle ml-0.5" />
      )}
    </div>
  )
}
