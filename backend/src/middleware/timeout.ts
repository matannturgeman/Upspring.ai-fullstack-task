import type { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'

type ObservableResponse = Response & {
  on(event: 'finish' | 'close' | 'error', listener: () => void): void
}

export function timeoutMiddleware(ms: number) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const stream = res as ObservableResponse
    const timer = setTimeout(() => {
      if (!stream.headersSent) {
        stream
          .status(StatusCodes.SERVICE_UNAVAILABLE)
          .json({ error: true, message: 'Request timed out', code: 'TIMEOUT' })
      }
    }, ms)

    const clear = () => clearTimeout(timer)
    stream.on('finish', clear)
    stream.on('close', clear)
    stream.on('error', clear)
    next()
  }
}
