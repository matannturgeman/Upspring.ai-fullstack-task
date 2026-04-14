# Phase 4 — AI Analysis (Claude Vision)

## Goal
Let users ask natural language questions about the fetched ads. Claude analyzes both the ad text AND the images/thumbnails (multimodal). Responses stream to the UI via SSE.

## Dependencies
- Phase 2 (ads in MongoDB)
- Phase 3 (frontend store + AIChat component slot)
- Anthropic API key

## Steps

### 4.1 — Prompt Builder

**`backend/src/utils/promptBuilder.js`**
```js
/**
 * Builds a structured prompt for Claude that includes:
 * - System context (role + task)
 * - Text summary of all ads
 * - Image URLs for multimodal analysis
 * - The user's question
 */
export function buildAnalysisPrompt(ads, userQuestion) {
  const adSummaries = ads.slice(0, 15).map((ad, i) => {
    const lines = [`Ad ${i + 1}:`]
    if (ad.headline) lines.push(`  Headline: ${ad.headline}`)
    if (ad.primaryText) lines.push(`  Text: ${ad.primaryText.slice(0, 300)}`)
    if (ad.platform) lines.push(`  Platform: ${ad.platform}`)
    if (ad.startDate) lines.push(`  Start: ${new Date(ad.startDate).toLocaleDateString()}`)
    if (ad.status) lines.push(`  Status: ${ad.status}`)
    return lines.join('\n')
  }).join('\n\n')

  const systemPrompt = `You are a creative strategist and advertising analyst.
You are analyzing a brand's public Meta ads (Facebook/Instagram) to help marketers understand their creative strategy.
Be specific, structured, and grounded in the actual ad content shown. Avoid vague generalities.
When you see images, describe what you observe about the visual style, color palette, subject matter, and creative approach.`

  return { systemPrompt, adSummaries }
}

/**
 * Build image content blocks for Claude's multimodal API
 * Only include ads that have a usable image URL (max 10 images to control cost)
 */
export function buildImageBlocks(ads) {
  return ads
    .filter(ad => ad.thumbnailUrl || ad.imageUrl)
    .slice(0, 10)
    .map(ad => ({
      type: 'image',
      source: {
        type: 'url',
        url: ad.thumbnailUrl || ad.imageUrl,
      },
    }))
}
```

### 4.2 — Claude Service

**`backend/src/services/claudeService.js`**
```js
import Anthropic from '@anthropic-ai/sdk'
import { buildAnalysisPrompt, buildImageBlocks } from '../utils/promptBuilder.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function analyzeAdsStream(ads, userQuestion, onChunk, onDone, onError) {
  const { systemPrompt, adSummaries } = buildAnalysisPrompt(ads, userQuestion)
  const imageBlocks = buildImageBlocks(ads)

  const userContent = [
    // Include images first (multimodal)
    ...imageBlocks,
    {
      type: 'text',
      text: `Here are the ads for this brand:\n\n${adSummaries}\n\nQuestion: ${userQuestion}`,
    },
  ]

  try {
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        onChunk(chunk.delta.text)
      }
    }

    const final = await stream.finalMessage()
    onDone(final)
  } catch (err) {
    onError(err)
  }
}
```

### 4.3 — Analysis Route (SSE Streaming)

**`backend/src/routes/analysis.js`**
```js
import { Router } from 'express'
import Ad from '../models/Ad.js'
import { analyzeAdsStream } from '../services/claudeService.js'

const router = Router()

// POST /api/analysis/ask
// Body: { brandId, question }
// Response: text/event-stream (SSE)
router.post('/ask', async (req, res, next) => {
  const { brandId, question } = req.body

  if (!brandId || !question) {
    return res.status(400).json({ error: true, message: 'brandId and question required', code: 'MISSING_PARAMS' })
  }
  if (question.length > 1000) {
    return res.status(400).json({ error: true, message: 'Question too long (max 1000 chars)', code: 'QUESTION_TOO_LONG' })
  }

  const ads = await Ad.find({ brandId }).lean()
  if (!ads.length) {
    return res.status(404).json({ error: true, message: 'No ads found for this brand', code: 'NO_ADS' })
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  await analyzeAdsStream(
    ads,
    question,
    (text) => sendEvent('chunk', { text }),
    () => {
      sendEvent('done', { finished: true })
      res.end()
    },
    (err) => {
      sendEvent('error', { message: err.message || 'AI analysis failed' })
      res.end()
    }
  )
})

export default router
```

### 4.4 — Frontend: Analysis API

**`frontend/src/api/analysisApi.js`**
```js
export function askAboutAds(brandId, question, { onChunk, onDone, onError }) {
  return fetch('/api/analysis/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brandId, question }),
  }).then(res => {
    if (!res.ok) return res.json().then(d => onError(d.message))

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    function read() {
      reader.read().then(({ done, value }) => {
        if (done) { onDone(); return }
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6))
              if (parsed.text) onChunk(parsed.text)
              if (parsed.finished) onDone()
              if (parsed.message) onError(parsed.message)
            } catch {}
          }
        }
        read()
      })
    }
    read()
  }).catch(err => onError(err.message))
}
```

### 4.5 — AIChat Component

**`frontend/src/components/AIChat/AIChat.jsx`**
```jsx
import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { askAboutAds } from '../../api/analysisApi'

const SUGGESTED_QUESTIONS = [
  'What messaging angles are used most?',
  'What patterns do you see across creatives?',
  'What might be working well here, and why?',
  'What emotions do the visuals evoke?',
]

export function AIChat() {
  const { currentBrand, analysisMessages, addMessage } = useAppStore()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [analysisMessages])

  async function ask(question) {
    if (!question.trim() || loading) return
    setInput('')
    setLoading(true)

    addMessage({ role: 'user', text: question })
    let aiText = ''
    const msgId = Date.now()
    addMessage({ role: 'ai', text: '', id: msgId, streaming: true })

    await askAboutAds(currentBrand._id, question, {
      onChunk: (text) => {
        aiText += text
        // Update last message in place
        useAppStore.setState(s => ({
          analysisMessages: s.analysisMessages.map(m =>
            m.id === msgId ? { ...m, text: aiText } : m
          )
        }))
      },
      onDone: () => {
        useAppStore.setState(s => ({
          analysisMessages: s.analysisMessages.map(m =>
            m.id === msgId ? { ...m, streaming: false } : m
          )
        }))
        setLoading(false)
      },
      onError: (msg) => {
        useAppStore.setState(s => ({
          analysisMessages: s.analysisMessages.map(m =>
            m.id === msgId ? { ...m, text: `Error: ${msg}`, error: true, streaming: false } : m
          )
        }))
        setLoading(false)
      },
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col h-[500px]">
      <div className="px-4 py-3 border-b font-semibold text-gray-800">AI Analysis</div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {analysisMessages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">Ask anything about these ads:</p>
            {SUGGESTED_QUESTIONS.map(q => (
              <button key={q} onClick={() => ask(q)}
                className="block w-full text-left text-sm px-3 py-2 bg-gray-50 hover:bg-blue-50 rounded-lg text-gray-700 transition">
                {q}
              </button>
            ))}
          </div>
        )}

        {analysisMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white'
                : msg.error
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-gray-100 text-gray-800'
            }`}>
              {msg.text}
              {msg.streaming && <span className="animate-pulse">▊</span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={e => { e.preventDefault(); ask(input) }}
        className="p-3 border-t flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about these ads..."
          disabled={loading}
          className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" disabled={loading || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition">
          Ask
        </button>
      </form>
    </div>
  )
}
```

## Key Files Created
- `backend/src/utils/promptBuilder.js`
- `backend/src/services/claudeService.js`
- `backend/src/routes/analysis.js`
- `frontend/src/api/analysisApi.js`
- `frontend/src/components/AIChat/AIChat.jsx`

## Success Criteria
- [ ] Asking "What messaging angles are used most?" returns a streamed, structured answer
- [ ] Claude references actual ad headlines/text in its response (not hallucinated)
- [ ] Image blocks sent to Claude for multimodal analysis
- [ ] Response streams token-by-token (not all at once)
- [ ] AI error (API key invalid, rate limit) shows graceful error in chat
- [ ] Suggested questions clickable on first open
- [ ] Max 15 ads context-selected to avoid token overflow
