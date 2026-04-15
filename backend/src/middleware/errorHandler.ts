import type { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'

interface AppError extends Error {
  status?: number
  code?: string
}

export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction): void {
  console.error(err)
  const status = err.status || StatusCodes.INTERNAL_SERVER_ERROR
  res.status(status).json({
    error: true,
    message: err.message || 'Internal server error',
    code: err.code || 'UNKNOWN_ERROR',
  })
}
