import { readSettings, writeSettings } from '@/lib/vault/settings'
import type { VaultSettings } from '@/lib/vault/settings'
import { getVpsConfig, proxyToVps } from '@/lib/vpsProxy'

export async function GET() {
  if (getVpsConfig()) return proxyToVps('/api/settings', 'GET')
  const settings = await readSettings()
  return Response.json(settings)
}

export async function POST(request: Request) {
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
