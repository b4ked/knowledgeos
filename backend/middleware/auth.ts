import type { Request, Response, NextFunction } from 'express'

export function bearerAuth(req: Request, res: Response, next: NextFunction): void {
  const token = process.env.VPS_API_TOKEN
  if (!token) {
    // No token configured — allow all (dev mode)
    next()
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
