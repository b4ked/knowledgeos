import { auth } from '@/auth'
import { db } from '@/lib/db'
import { userPreferences } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getVpsConfig, proxyToVps } from '@/lib/vpsProxy'

type StoredPreset = { name: string; data: Record<string, unknown> }

export async function GET() {
  const session = await auth()
  if (session?.user?.id) {
    const prefs = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, session.user.id),
    })
    const presets = Array.isArray(prefs?.presets) ? prefs.presets as StoredPreset[] : []
    return Response.json({ names: presets.map((preset) => preset.name).sort((a, b) => a.localeCompare(b)) })
  }

  if (getVpsConfig()) return proxyToVps('/api/presets', 'GET')
  return Response.json({ names: [] })
}
