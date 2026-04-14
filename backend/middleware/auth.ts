import type { Request, Response, NextFunction } from 'express'

export function bearerAuth(req: Request, res: Response, next: NextFunction): void {
  const token = process.env.VPS_API_TOKEN
  if (!token) {
    res.status(503).json({ error: 'VPS API token is not configured' })
    return
  }

  const header = req.headers['authorization'] ?? ''
  const provided = header.startsWith('Bearer ') ? header.slice(7) : ''

  if (provided !== token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  next()
}
