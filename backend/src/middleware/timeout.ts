import type { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'

export function timeoutMiddleware(ms: number) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(StatusCodes.SERVICE_UNAVAILABLE).json({ error: true, message: 'Request timed out', code: 'TIMEOUT' })
      }
    }, ms)

    const clear = () => clearTimeout(timer)
    res.on('finish', clear)
    res.on('close', clear)
    res.on('error', clear)
    next()
  }
}
