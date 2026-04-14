# Phase 5 — Competitor Discovery

## Goal
Add a "Find Competitors" button. Use Claude + Perplexity to identify relevant competing brands, explain *why* each is a competitor, then let the user select one and explore their ads using the same flow.

## Dependencies
- Phase 2 (ads scraping pipeline)
- Phase 3 (frontend store)
- Phase 4 (Claude service pattern)
- Perplexity API key

## Steps

### 5.1 — Perplexity Service

**`backend/src/services/perplexityService.js`**
```js
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions'

export async function searchCompetitors(brandName, industry) {
  const prompt = `Who are the top 5 direct competitors of the brand "${brandName}"${industry ? ` in the ${industry} industry` : ''}?
List only real brand names that run paid ads on Facebook/Instagram.
For each competitor, explain in one sentence why they compete with ${brandName}.
Return JSON: [{ "name": "...", "reason": "..." }]
Only return the JSON array, no other text.`

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) throw new Error(`Perplexity error: ${response.status}`)

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''

  try {
    // Extract JSON from response
    const match = content.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON array in response')
    return JSON.parse(match[0])
  } catch {
    throw new Error('Failed to parse competitor list from Perplexity')
  }
}
```

### 5.2 — Competitor Service (Claude fallback)

**`backend/src/services/competitorService.js`**
```js
import Anthropic from '@anthropic-ai/sdk'
import { searchCompetitors } from './perplexityService.js'
import Ad from '../models/Ad.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function findCompetitors(brandName, brandId) {
  // Strategy 1: Perplexity web search (most accurate)
  try {
    const competitors = await searchCompetitors(brandName)
    if (competitors.length > 0) return { competitors, source: 'perplexity' }
  } catch (err) {
    console.warn('Perplexity competitor search failed, falling back to Claude:', err.message)
  }

  // Strategy 2: Claude reasoning from ad content (fallback)
  const ads = await Ad.find({ brandId }).lean().limit(10)
  const adContext = ads.map(a => `${a.headline || ''} ${a.primaryText || ''}`).join('\n').slice(0, 2000)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Based on this brand "${brandName}" and their ad copy below, identify 5 direct competitors.
Return JSON: [{ "name": "...", "reason": "one sentence why they compete" }]
Only return the JSON array.

Ad copy:
${adContext}`
    }],
  })

  const content = response.content[0].text
  try {
    const match = content.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON')
    return { competitors: JSON.parse(match[0]), source: 'claude' }
  } catch {
    throw new Error('Could not identify competitors')
  }
}
```

### 5.3 — Competitors Route

**`backend/src/routes/competitors.js`**
```js
import { Router } from 'express'
import { findCompetitors } from '../services/competitorService.js'
import Brand from '../models/Brand.js'

const router = Router()

// POST /api/competitors/find
// Body: { brandName, brandId }
router.post('/find', async (req, res, next) => {
  try {
    const { brandName, brandId } = req.body
    if (!brandName || !brandId) {
      return res.status(400).json({ error: true, message: 'brandName and brandId required', code: 'MISSING_PARAMS' })
    }

    const result = await findCompetitors(brandName, brandId)

    // Persist to brand record
    await Brand.findByIdAndUpdate(brandId, { competitors: result.competitors })

    res.json({
      competitors: result.competitors,
      source: result.source,
      disclaimer: result.source === 'claude'
        ? 'Identified by AI reasoning from ad content (not web search)'
        : 'Identified via web search',
    })
  } catch (err) {
    next(err)
  }
})

export default router
```

Update `Brand.js` model to include competitors field:
```js
competitors: [{
  name: String,
  reason: String,
}],
```

### 5.4 — Frontend: Competitor API

**`frontend/src/api/competitorApi.js`**
```js
import axios from 'axios'
const api = axios.create({ baseURL: '/api' })

export async function findCompetitors(brandName, brandId) {
  const { data } = await api.post('/competitors/find', { brandName, brandId })
  return data
}
```

### 5.5 — useCompetitors Hook

**`frontend/src/hooks/useCompetitors.js`**
```js
import { useState } from 'react'
import { findCompetitors } from '../api/competitorApi'
import { useAppStore } from '../store/appStore'
import { useAds } from './useAds'

export function useCompetitors() {
  const { currentBrand, setCompetitors, setSelectedCompetitor } = useAppStore()
  const { search } = useAds()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [source, setSource] = useState(null)

  async function discover() {
    if (!currentBrand) return
    setLoading(true)
    setError(null)

    try {
      const result = await findCompetitors(currentBrand.name, currentBrand._id)
      setCompetitors(result.competitors)
      setSource(result.source)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not find competitors')
    } finally {
      setLoading(false)
    }
  }

  async function selectCompetitor(competitor) {
    setSelectedCompetitor(competitor)
    await search(competitor.name)
  }

  return { discover, selectCompetitor, loading, error, source }
}
```

### 5.6 — CompetitorPanel Component

**`frontend/src/components/CompetitorPanel/CompetitorPanel.jsx`**
```jsx
import { useAppStore } from '../../store/appStore'
import { useCompetitors } from '../../hooks/useCompetitors'

export function CompetitorPanel() {
  const { competitors, selectedCompetitor } = useAppStore()
  const { discover, selectCompetitor, loading, error, source } = useCompetitors()

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800">Competitors</h3>
        <button
          onClick={discover}
          disabled={loading}
          className="text-sm px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition"
        >
          {loading ? 'Finding...' : 'Find Competitors'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-500 mb-2">{error}</p>
      )}

      {source && (
        <p className="text-xs text-gray-400 mb-3 italic">
          {source === 'perplexity' ? 'Via web search' : 'Via AI reasoning from ad content'}
        </p>
      )}

      {competitors.length === 0 && !loading && (
        <p className="text-sm text-gray-500">Click "Find Competitors" to discover competing brands.</p>
      )}

      <div className="space-y-2">
        {competitors.map(c => (
          <button
            key={c.name}
            onClick={() => selectCompetitor(c)}
            className={`w-full text-left p-3 rounded-lg border transition ${
              selectedCompetitor?.name === c.name
                ? 'border-purple-400 bg-purple-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <p className="font-medium text-sm text-gray-900">{c.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{c.reason}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
```

## Key Files Created
- `backend/src/services/perplexityService.js`
- `backend/src/services/competitorService.js`
- `backend/src/routes/competitors.js`
- `frontend/src/api/competitorApi.js`
- `frontend/src/hooks/useCompetitors.js`
- `frontend/src/components/CompetitorPanel/CompetitorPanel.jsx`

## Success Criteria
- [ ] "Find Competitors" returns 3–5 real brand names with reasons
- [ ] Source shown: "Via web search" (Perplexity) or "Via AI reasoning" (Claude fallback)
- [ ] Clicking a competitor triggers ad fetch for that brand
- [ ] Perplexity failure falls back to Claude silently (no error shown)
- [ ] Both failure = shows friendly error in panel
- [ ] Reason text is meaningful (not "they are in the same industry")
