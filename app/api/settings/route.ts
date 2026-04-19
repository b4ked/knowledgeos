import { readSettings, writeSettings } from '@/lib/vault/settings'
import type { VaultSettings } from '@/lib/vault/settings'
import { auth } from '@/auth'
import { getVpsConfig, proxyToVps } from '@/lib/vpsProxy'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (getVpsConfig()) return proxyToVps('/api/settings', 'GET')
  const settings = await readSettings()
  return Response.json({
    rawPath: settings.rawPath,
    wikiPath: settings.wikiPath,
    presetsPath: settings.presetsPath,
  })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json() as Partial<VaultSettings>
  if (getVpsConfig()) return proxyToVps('/api/settings', 'POST', body)
  const { rawPath, wikiPath, presetsPath } = body
  await writeSettings({
    rawPath: rawPath || undefined,
    wikiPath: wikiPath || undefined,
    presetsPath: presetsPath || undefined,
  })
  return Response.json({ ok: true })
}
