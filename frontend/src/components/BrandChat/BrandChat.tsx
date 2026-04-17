import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import { useAppStore } from '../../store/appStore.ts'
import { useChat } from '../../hooks/useChat.ts'

const SUGGESTIONS = [
  'What messaging angles are used most?',
  'What patterns do you see across creatives?',
  'What might be working well here, and why?',
  'Who is the target audience for these ads?',
]

export function BrandChat() {
  const { currentBrand, chatMessages, chatLoading, chatError, chatOpen } = useAppStore()
  const { sendMessage, closeChat } = useChat()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const lastAiMsg = [...chatMessages].reverse().find((m) => m.role === 'ai')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lastAiMsg?.text])

  useEffect(() => {
    if (chatOpen) inputRef.current?.focus()
  }, [chatOpen])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || chatLoading || !currentBrand) return
    setInput('')
    void sendMessage(currentBrand._id, text)
  }, [input, chatLoading, currentBrand, sendMessage])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleSuggestion = useCallback(
    (text: string) => {
      if (chatLoading || !currentBrand) return
      void sendMessage(currentBrand._id, text)
    },
    [chatLoading, currentBrand, sendMessage],
  )

  if (!chatOpen || !currentBrand) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="AI Chat about brand ads"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Ask AI about {currentBrand.name}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
              claude-sonnet-4-6
            </span>
          </div>
          <button
            onClick={closeChat}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition text-xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded"
            aria-label="Close chat"
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {chatMessages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ask anything about the brand's ad strategy and creative patterns.
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestion(s)}
                    disabled={chatLoading}
                    className="text-xs px-3 py-1.5 rounded-full border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950 hover:bg-purple-100 dark:hover:bg-purple-900 transition disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'ai' && (
                <div
                  aria-hidden="true"
                  className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold"
                >
                  AI
                </div>
              )}
              <div
                className={
                  msg.role === 'user'
                    ? 'max-w-[80%] px-4 py-2 rounded-2xl rounded-tr-sm bg-blue-600 text-white text-sm'
                    : 'flex-1 min-w-0 prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200'
                }
              >
                {msg.role === 'ai' ? (
                  <>
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                    {msg.streaming && (
                      <span
                        aria-hidden="true"
                        className="inline-block w-2 h-4 bg-purple-500 animate-pulse rounded-sm align-middle ml-0.5"
                      />
                    )}
                    {msg.streaming && !msg.text && (
                      <span className="text-sm text-gray-400 dark:text-gray-500 italic">
                        Thinking...
                      </span>
                    )}
                  </>
                ) : (
                  msg.text
                )}
              </div>
            </div>
          ))}

          {chatError && (
            <div
              role="alert"
              className="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3"
            >
              {chatError}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about messaging angles, creative patterns, target audience..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 placeholder-gray-400 dark:placeholder-gray-500"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
            aria-label="Chat message input"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || chatLoading}
            className="flex-shrink-0 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            aria-label="Send message"
          >
            {chatLoading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin block" />
            ) : (
              'Send'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
