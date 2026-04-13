import { auth } from '@/auth'
import { getAdapter, getServerVaultMode } from '@/lib/vault/getAdapter'
import { parseLinks } from '@/lib/graph/parseLinks'
import type { NoteInput } from '@/lib/graph/parseLinks'
import { getVpsConfig, proxyToVps } from '@/lib/vpsProxy'

export async function GET() {
  const session = await auth()
  const vaultMode = await getServerVaultMode(session?.user?.id)

  if (vaultMode === 'remote' && getVpsConfig()) return proxyToVps('/api/graph', 'GET')

  const adapter = await getAdapter(vaultMode === 'cloud' ? session?.user?.id : undefined)
  await adapter.ensureDirectories()

  const wikiMeta = await adapter.listNotes('wiki')
  const wikiNotes: NoteInput[] = await Promise.all(
    wikiMeta.map(async (m) => ({
      slug: m.slug,
      content: await adapter.readNote(m.path).catch(() => ''),
      type: 'wiki' as const,
    }))
  )

  const rawMeta = await adapter.listNotes('raw')
  const rawNotes: NoteInput[] = await Promise.all(
    rawMeta.map(async (m) => ({
      slug: m.slug,
      content: await adapter.readNote(m.path).catch(() => ''),
      type: 'raw' as const,
    }))
  )

  const graphData = parseLinks([...wikiNotes, ...rawNotes])
  return Response.json(graphData)
}
