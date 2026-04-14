export function timeoutMiddleware(ms) {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      res.status(503).json({ error: true, message: 'Request timed out', code: 'TIMEOUT' })
    }, ms)
    res.on('finish', () => clearTimeout(timer))
    next()
  }
}
