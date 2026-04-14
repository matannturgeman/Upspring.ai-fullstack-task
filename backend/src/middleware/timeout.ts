import type { Request, Response, NextFunction } from 'express'

export function timeoutMiddleware(ms: number) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      res.status(503).json({ error: true, message: 'Request timed out', code: 'TIMEOUT' })
    }, ms)
    res.on('finish', () => clearTimeout(timer))
    next()
  }
}
