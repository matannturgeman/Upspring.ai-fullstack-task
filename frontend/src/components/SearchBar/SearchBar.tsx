import { useState } from 'react'
import { useAds } from '../../hooks/useAds.ts'
import { useAppStore } from '../../store/appStore.ts'

export function SearchBar() {
  const [input, setInput] = useState('')
  const { search } = useAds()
  const adsLoading = useAppStore(s => s.adsLoading)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (trimmed) search(trimmed)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2 w-full max-w-xl mx-auto"
      role="search"
      aria-label="Search for brand ads"
    >
      <label htmlFor="brand-search" className="sr-only">Brand name</label>
      <input
        id="brand-search"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Enter a brand name (e.g. Nike, Airbnb)"
        disabled={adsLoading}
        autoComplete="off"
        spellCheck={false}
        aria-label="Brand name to search"
        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={adsLoading || !input.trim()}
        aria-label={adsLoading ? 'Searching, please wait' : 'Search brand ads'}
        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {adsLoading ? 'Searching...' : 'Search'}
      </button>
    </form>
  )
}
