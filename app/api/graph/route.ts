import path from 'path'
import { LocalVaultAdapter } from '@/lib/vault/LocalVaultAdapter'
import { parseLinks } from '@/lib/graph/parseLinks'
import type { NoteInput } from '@/lib/graph/parseLinks'

export async function GET() {
  const vaultPath = process.env.VAULT_PATH
    ? path.resolve(process.env.VAULT_PATH)
    : path.resolve('./vault')

  const adapter = new LocalVaultAdapter(vaultPath)
  await adapter.ensureDirectories()

  // Load wiki notes (primary graph source)
  const wikiMeta = await adapter.listNotes('wiki')
  const wikiNotes: NoteInput[] = await Promise.all(
    wikiMeta.map(async (m) => ({
      slug: m.slug,
      content: await adapter.readNote(m.path).catch(() => ''),
      type: 'wiki' as const,
    }))
  )

  // Also include raw notes so they appear as orange source nodes
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
