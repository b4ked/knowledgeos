import { readSettings, writeSettings } from '@/lib/vault/settings'
import type { VaultSettings } from '@/lib/vault/settings'

export async function GET() {
  const settings = await readSettings()
  return Response.json(settings)
}

export async function POST(request: Request) {
  const body = await request.json() as Partial<VaultSettings>
  const { rawPath, wikiPath } = body
  await writeSettings({
    rawPath: rawPath || undefined,
    wikiPath: wikiPath || undefined,
  })
  return Response.json({ ok: true })
}
