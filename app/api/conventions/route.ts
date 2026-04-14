import path from 'path'
import fs from 'fs/promises'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { userPreferences } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
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
  const session = await auth()
  if (session?.user?.id) {
    const prefs = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, session.user.id),
    })
    return Response.json({ ...DEFAULT_CONVENTIONS, ...((prefs?.conventions as Partial<Conventions> | undefined) ?? {}) })
  }
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
  const session = await auth()
  if (session?.user?.id) {
    const merged: Conventions = { ...DEFAULT_CONVENTIONS, ...body }
    const existing = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, session.user.id),
    })
    if (existing) {
      await db.update(userPreferences)
        .set({ conventions: merged, updatedAt: new Date() })
        .where(eq(userPreferences.userId, session.user.id))
    } else {
      await db.insert(userPreferences).values({
        userId: session.user.id,
        conventions: merged,
        vaultMode: 'cloud',
      })
    }
    return Response.json(merged)
  }
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
