# Phase 2 — Ads Data Acquisition (Apify + Meta Ads Library)

## Goal
Implement the full data acquisition pipeline: accept a brand name, scrape Meta Ads Library via Apify, parse & normalize the results, persist to MongoDB with caching, and expose a clean REST API.

## Dependencies
- Phase 1 complete (models, DB, middleware in place)
- Apify account + API token
- Apify actor: `apify/facebook-ads-scraper` or `curious_coder/facebook-ad-library-scraper`

## Steps

### 2.1 — Apify Service

**`backend/src/services/apifyService.js`**
```js
import { ApifyClient } from 'apify-client'

const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN })

// Actor ID for Meta Ads Library scraper
const ACTOR_ID = 'apify/facebook-ads-scraper'
const DEFAULT_TIMEOUT_MS = 120_000 // 2 min max for scrape

export async function scrapeMetaAds(brandName, { limit = 20 } = {}) {
  const run = await client.actor(ACTOR_ID).call({
    searchTerms: [brandName],
    maxAdsCount: limit,
    adType: 'ALL',
    publisherPlatforms: ['FACEBOOK', 'INSTAGRAM'],
  }, { timeout: DEFAULT_TIMEOUT_MS })

  const { items } = await client.dataset(run.defaultDatasetId).listItems()

  if (!items || items.length === 0) {
    return { ads: [], partial: false, empty: true }
  }

  return { ads: items, partial: items.length < limit, empty: false }
}
```

### 2.2 — Ad Parser / Normalizer

**`backend/src/utils/apifyParser.js`**
```js
export function parseApifyAd(raw) {
  return {
    adId: raw.id || raw.ad_archive_id || null,
    platform: parsePlatform(raw.publisher_platforms),
    headline: raw.snapshot?.title || raw.snapshot?.cards?.[0]?.title || null,
    primaryText: raw.snapshot?.body?.markup?.text || raw.snapshot?.body?.text || null,
    imageUrl: raw.snapshot?.images?.[0]?.url || null,
    videoUrl: raw.snapshot?.videos?.[0]?.video_hd_url || raw.snapshot?.videos?.[0]?.video_sd_url || null,
    thumbnailUrl: raw.snapshot?.videos?.[0]?.video_preview_image_url
      || raw.snapshot?.images?.[0]?.url
      || null,
    startDate: raw.start_date ? new Date(raw.start_date * 1000) : null,
    status: raw.is_active ? 'ACTIVE' : 'INACTIVE',
    performanceData: null, // Meta doesn't expose this publicly
    rawData: raw,
  }
}

function parsePlatform(platforms) {
  if (!platforms || platforms.length === 0) return 'Facebook/Instagram'
  return platforms.join(', ')
}
```

### 2.3 — Ads Route

**`backend/src/routes/ads.js`**
```js
import { Router } from 'express'
import Brand from '../models/Brand.js'
import Ad from '../models/Ad.js'
import SearchSession from '../models/SearchSession.js'
import { scrapeMetaAds } from '../services/apifyService.js'
import { parseApifyAd } from '../utils/apifyParser.js'

const router = Router()

// GET /api/ads?brand=Nike&limit=20
router.get('/', async (req, res, next) => {
  try {
    const { brand, limit = 20, forceRefresh = false } = req.query
    if (!brand) return res.status(400).json({ error: true, message: 'brand query param required', code: 'MISSING_BRAND' })

    const normalizedName = brand.trim().toLowerCase()

    // Check cache — skip if forceRefresh
    if (!forceRefresh) {
      const cached = await Brand.findOne({ normalizedName })
      if (cached) {
        const ads = await Ad.find({ brandId: cached._id }).lean()
        if (ads.length > 0) {
          return res.json({ brand: cached, ads, fromCache: true })
        }
      }
    }

    // Create session for tracking
    const session = await SearchSession.create({ query: brand, status: 'fetching' })

    let scrapeResult
    try {
      scrapeResult = await scrapeMetaAds(brand, { limit: parseInt(limit) })
    } catch (err) {
      await SearchSession.findByIdAndUpdate(session._id, {
        status: 'error',
        errorMessage: err.message,
      })
      const error = new Error(`Ads provider error: ${err.message}`)
      error.status = 502
      error.code = 'PROVIDER_ERROR'
      return next(error)
    }

    if (scrapeResult.empty) {
      await SearchSession.findByIdAndUpdate(session._id, { status: 'done', adsFound: 0 })
      return res.json({ brand: null, ads: [], empty: true, message: `No ads found for "${brand}"` })
    }

    // Upsert brand
    const brandDoc = await Brand.findOneAndUpdate(
      { normalizedName },
      { name: brand, normalizedName, lastFetched: new Date(), adCount: scrapeResult.ads.length },
      { upsert: true, new: true }
    )

    // Delete old ads for brand, insert fresh
    await Ad.deleteMany({ brandId: brandDoc._id })
    const parsed = scrapeResult.ads.map(raw => ({ ...parseApifyAd(raw), brandId: brandDoc._id }))
    const ads = await Ad.insertMany(parsed)

    await SearchSession.findByIdAndUpdate(session._id, { status: 'done', brandId: brandDoc._id, adsFound: ads.length })

    res.json({ brand: brandDoc, ads, fromCache: false, partial: scrapeResult.partial })
  } catch (err) {
    next(err)
  }
})

// GET /api/ads/:brandId — get cached ads for a brand
router.get('/:brandId', async (req, res, next) => {
  try {
    const ads = await Ad.find({ brandId: req.params.brandId }).lean()
    if (!ads.length) return res.status(404).json({ error: true, message: 'No ads found', code: 'NOT_FOUND' })
    res.json({ ads })
  } catch (err) {
    next(err)
  }
})

export default router
```

### 2.4 — Image Proxy (avoids CORS on Apify CDN images)

**`backend/src/utils/imageProxy.js`**
```js
import { Router } from 'express'
import fetch from 'node-fetch'

const router = Router()

// GET /api/proxy/image?url=https://...
router.get('/image', async (req, res) => {
  const { url } = req.query
  if (!url) return res.status(400).send('url required')

  try {
    const response = await fetch(decodeURIComponent(url), { timeout: 10_000 })
    if (!response.ok) return res.status(502).send('upstream error')
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    response.body.pipe(res)
  } catch {
    res.status(504).send('image fetch timeout')
  }
})

export default router
```

## Key Files Created
- `backend/src/services/apifyService.js`
- `backend/src/utils/apifyParser.js`
- `backend/src/routes/ads.js`
- `backend/src/utils/imageProxy.js`

## Error Handling Covered
| Scenario | Response |
|---|---|
| Missing brand param | 400 MISSING_BRAND |
| Apify timeout / crash | 502 PROVIDER_ERROR |
| No ads found | 200 `{ empty: true }` |
| Partial results | 200 `{ partial: true }` |
| Cache hit | 200 `{ fromCache: true }` |

## Success Criteria
- [ ] `GET /api/ads?brand=Nike` returns real Meta ads
- [ ] Second request within 1hr returns cached results (`fromCache: true`)
- [ ] `forceRefresh=true` bypasses cache
- [ ] Apify timeout returns 502 with useful message, not 500 crash
- [ ] Empty brand returns `{ empty: true, message: "..." }` not an error
- [ ] Ad documents have `imageUrl` or `thumbnailUrl` populated for most results
