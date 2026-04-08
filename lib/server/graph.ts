import { LocalVaultAdapter } from '@/lib/vault/LocalVaultAdapter'
import { parseLinks } from '@/lib/graph/parseLinks'
import type { NoteInput } from '@/lib/graph/parseLinks'
import { getVaultPath } from './config'

export async function getGraph(vaultPath = getVaultPath()) {
  const adapter = new LocalVaultAdapter(vaultPath)
  await adapter.ensureDirectories()

  const wikiMeta = await adapter.listNotes('wiki')
  const wikiNotes: NoteInput[] = await Promise.all(
    wikiMeta.map(async (note) => ({
      slug: note.slug,
      content: await adapter.readNote(note.path).catch(() => ''),
      type: 'wiki' as const,
    }))
  )

  const rawMeta = await adapter.listNotes('raw')
  const rawNotes: NoteInput[] = await Promise.all(
    rawMeta.map(async (note) => ({
      slug: note.slug,
      content: await adapter.readNote(note.path).catch(() => ''),
      type: 'raw' as const,
    }))
  )

  return parseLinks([...wikiNotes, ...rawNotes])
}
