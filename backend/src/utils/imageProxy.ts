import { Router, type Request, type Response } from 'express'

const router = Router()

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { url } = req.query

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: true, message: 'url query param required', code: 'MISSING_URL' })
    return
  }

  try {
    const upstream = await fetch(decodeURIComponent(url), {
      signal: AbortSignal.timeout(10_000),
    })

    if (!upstream.ok) {
      res.status(502).send('upstream error')
      return
    }

    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=3600')

    const buffer = await upstream.arrayBuffer()
    res.send(Buffer.from(buffer))
  } catch {
    res.status(504).send('image fetch timeout')
  }
})

export default router
