# Phase 6 — Error Handling & UI Polish

## Goal
Harden every failure path. No silent errors. Every edge case has a user-visible explanation and a fallback action.

## Dependencies
- All previous phases complete

## Error Inventory & Handling

### Backend Errors

| Scenario | HTTP Code | `code` field | UI Message |
|---|---|---|---|
| Missing required param | 400 | `MISSING_PARAMS` | "Please enter a brand name" |
| Brand not found / no ads | 200 | — | `{ empty: true, message }` |
| Apify scrape failed | 502 | `PROVIDER_ERROR` | "Ads provider is unavailable. Try again." |
| Apify timeout | 503 | `TIMEOUT` | "Search timed out. Try a shorter brand name." |
| Rate limit hit | 429 | `RATE_LIMITED` | "Too many requests. Please wait a moment." |
| Claude API error | 502 | `AI_ERROR` | "AI analysis is temporarily unavailable." |
| Perplexity error (no fallback) | 502 | `COMPETITOR_ERROR` | "Could not find competitors right now." |
| DB connection error | 500 | `DB_ERROR` | "Service temporarily unavailable." |
| Invalid brand name (XSS/injection) | 400 | `INVALID_INPUT` | "Invalid brand name." |

### Backend: Input Validation Middleware

**`backend/src/middleware/validateBrand.js`**
```js
export function validateBrandName(req, res, next) {
  const brand = req.query.brand || req.body.brandName
  if (!brand) return res.status(400).json({ error: true, message: 'Brand name is required', code: 'MISSING_BRAND' })

  // Strip HTML/scripts, limit length
  const cleaned = brand.replace(/[<>\"']/g, '').trim().slice(0, 100)
  if (!cleaned) return res.status(400).json({ error: true, message: 'Invalid brand name', code: 'INVALID_INPUT' })

  req.cleanBrand = cleaned
  next()
}
```

**`backend/src/middleware/rateLimiter.js`**
```js
import rateLimit from 'express-rate-limit'

export const searchRateLimit = rateLimit({
  windowMs: 60_000,   // 1 minute
  max: 10,            // 10 searches per minute per IP
  message: { error: true, message: 'Too many requests. Please wait.', code: 'RATE_LIMITED' },
  standardHeaders: true,
})

export const analysisRateLimit = rateLimit({
  windowMs: 60_000,
  max: 20,
  message: { error: true, message: 'Too many AI requests. Please wait.', code: 'RATE_LIMITED' },
})
```

### Frontend: Global Error Boundary

**`frontend/src/components/shared/ErrorBoundary.jsx`**
```jsx
import { Component } from 'react'

export class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center p-8">
          <p className="text-red-500 font-medium">Something went wrong</p>
          <p className="text-gray-500 text-sm mt-1">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

### Frontend: Axios Error Interceptor

**`frontend/src/api/index.js`**
```js
import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Normalize all error responses
api.interceptors.response.use(
  res => res,
  err => {
    const message = err.response?.data?.message || err.message || 'Unexpected error'
    const code = err.response?.data?.code || 'UNKNOWN'
    return Promise.reject({ message, code, status: err.response?.status })
  }
)

export default api
```

### Frontend: Toast Notification System

**`frontend/src/components/shared/Toast.jsx`**
```jsx
import { useState, useEffect } from 'react'

export function Toast({ message, type = 'error', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [onClose])

  const colors = {
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500',
    success: 'bg-green-500',
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg text-white shadow-lg max-w-sm flex items-start gap-3 ${colors[type]}`}>
      <p className="text-sm flex-1">{message}</p>
      <button onClick={onClose} className="text-white/80 hover:text-white">✕</button>
    </div>
  )
}
```

### Slow Response: Progress Indicator

**`frontend/src/components/shared/ProgressBanner.jsx`**
```jsx
export function ProgressBanner({ message, subMessage }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-3">
      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-blue-800">{message}</p>
        {subMessage && <p className="text-xs text-blue-600 mt-0.5">{subMessage}</p>}
      </div>
    </div>
  )
}
```

Use it in AdGrid during fetch:
```jsx
{adsLoading && (
  <ProgressBanner
    message="Fetching ads from Meta Ads Library..."
    subMessage="This can take 15–30 seconds"
  />
)}
```

## Key Files Created/Updated
- `backend/src/middleware/validateBrand.js`
- `backend/src/middleware/rateLimiter.js`
- `frontend/src/components/shared/ErrorBoundary.jsx`
- `frontend/src/api/index.js` (interceptor)
- `frontend/src/components/shared/Toast.jsx`
- `frontend/src/components/shared/ProgressBanner.jsx`

## Success Criteria
- [ ] XSS attempt in brand input is sanitized, returns 400
- [ ] 11th search in 1 min returns 429 with human message
- [ ] Apify down → 502 with "try again" message (not white screen)
- [ ] Claude down → chat shows error bubble, not spinner forever
- [ ] Slow fetch (>5s) shows progress banner with realistic time estimate
- [ ] React crash → ErrorBoundary catches it, shows "Try Again" button
- [ ] All errors log to console on backend with stack traces
