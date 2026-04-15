import { Router, type Request, type Response } from 'express'
import { StatusCodes } from 'http-status-codes'

const router = Router()

const ALLOWED_HOSTS = new Set([
  'scontent.cdninstagram.com',
  'scontent-lga3-2.cdninstagram.com',
  'external.fimg1.com',
  'lookaside.fbsbx.com',
  'scontent.fbed1-1.fna.fbcdn.net',
  'z-m-scontent.fbcdn.net',
  'z-m-scontent.fvie1-1.fna.fbcdn.net',
])

const FBCDN_PATTERN = /^([a-z0-9-]+\.)?fbcdn\.net$/
const APIFY_PATTERN = /^([a-z0-9-]+\.)?apify\.com$/

function isAllowedUrl(raw: string): boolean {
  try {
    const { protocol, hostname } = new URL(raw)
    if (protocol !== 'https:') return false
    if (ALLOWED_HOSTS.has(hostname)) return true
    if (FBCDN_PATTERN.test(hostname)) return true
    if (APIFY_PATTERN.test(hostname)) return true
    return false
  } catch {
    return false
  }
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { url } = req.query

  if (!url || typeof url !== 'string') {
    res.status(StatusCodes.BAD_REQUEST).json({ error: true, message: 'url query param required', code: 'MISSING_URL' })
    return
  }

  const decoded = decodeURIComponent(url)

  if (!isAllowedUrl(decoded)) {
    res.status(StatusCodes.FORBIDDEN).json({ error: true, message: 'URL not allowed', code: 'DISALLOWED_URL' })
    return
  }

  try {
    const upstream = await fetch(decoded, {
      signal: AbortSignal.timeout(10_000),
    })

    if (!upstream.ok || !upstream.body) {
      res.status(StatusCodes.BAD_GATEWAY).send('upstream error')
      return
    }

    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=3600')

    // Stream instead of buffering entire image in memory
    const reader = upstream.body.getReader()
    const pump = async (): Promise<void> => {
      const { done, value } = await reader.read()
      if (done) { res.end(); return }
      res.write(Buffer.from(value))
      return pump()
    }
    await pump()
  } catch {
    res.status(StatusCodes.GATEWAY_TIMEOUT).send('image fetch timeout')
  }
})

export default router
