import { auth } from '@/auth'
import { db } from '@/lib/db'
import { userPreferences } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getVpsConfig, proxyToVps } from '@/lib/vpsProxy'

type StoredPreset = { name: string; data: Record<string, unknown> }

async function loadUserPresets(userId: string): Promise<StoredPreset[]> {
  const prefs = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  })
  return Array.isArray(prefs?.presets) ? prefs.presets as StoredPreset[] : []
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  const session = await auth()
  if (session?.user?.id) {
    const preset = (await loadUserPresets(session.user.id)).find((entry) => entry.name === name)
    if (!preset) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json(preset.data)
  }
  if (getVpsConfig()) return proxyToVps(`/api/presets/${encodeURIComponent(name)}`, 'GET')
  return Response.json({ error: 'Not found' }, { status: 404 })
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  const body = await req.json()
  const session = await auth()
  if (session?.user?.id) {
    const presets = await loadUserPresets(session.user.id)
    const next = [...presets.filter((entry) => entry.name !== name), { name, data: body as Record<string, unknown> }]
      .sort((a, b) => a.name.localeCompare(b.name))

    const existing = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, session.user.id),
    })
    if (existing) {
      await db.update(userPreferences)
        .set({ presets: next, updatedAt: new Date() })
        .where(eq(userPreferences.userId, session.user.id))
    } else {
      await db.insert(userPreferences).values({
        userId: session.user.id,
        presets: next,
        vaultMode: 'cloud',
      })
    }
    return Response.json({ ok: true, name })
  }
  if (getVpsConfig()) return proxyToVps(`/api/presets/${encodeURIComponent(name)}`, 'PUT', body)
  return Response.json({ error: 'Not configured' }, { status: 501 })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  const session = await auth()
  if (session?.user?.id) {
    const presets = await loadUserPresets(session.user.id)
    const next = presets.filter((entry) => entry.name !== name)
    await db.update(userPreferences)
      .set({ presets: next, updatedAt: new Date() })
      .where(eq(userPreferences.userId, session.user.id))
    return Response.json({ ok: true })
  }
  if (getVpsConfig()) return proxyToVps(`/api/presets/${encodeURIComponent(name)}`, 'DELETE')
  return Response.json({ error: 'Not configured' }, { status: 501 })
}
