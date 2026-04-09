import path from 'path'
import fs from 'fs/promises'
import { DEFAULT_CONVENTIONS } from '@/lib/conventions/defaults'
import type { Conventions } from '@/lib/conventions/types'
import { getVpsConfig, proxyToVps } from '@/lib/vpsProxy'

function getVaultPath() {
  return process.env.VAULT_PATH ? path.resolve(process.env.VAULT_PATH) : path.resolve('./vault')
}

function conventionsPath(vaultPath: string) {
  return path.join(vaultPath, 'CONVENTIONS.json')
}

export async function GET() {
  if (getVpsConfig()) return proxyToVps('/api/conventions', 'GET')
  const filePath = conventionsPath(getVaultPath())
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return Response.json(JSON.parse(raw) as Conventions)
  } catch {
    return Response.json(DEFAULT_CONVENTIONS)
  }
}

export async function PUT(request: Request) {
  const body = await request.json() as Partial<Conventions>
  if (getVpsConfig()) return proxyToVps('/api/conventions', 'PUT', body)
  const merged: Conventions = { ...DEFAULT_CONVENTIONS, ...body }
  const vaultPath = getVaultPath()
  try {
    await fs.mkdir(vaultPath, { recursive: true })
    await fs.writeFile(conventionsPath(vaultPath), JSON.stringify(merged, null, 2), 'utf-8')
    return Response.json(merged)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save conventions'
    return Response.json({ error: message }, { status: 500 })
  }
}
