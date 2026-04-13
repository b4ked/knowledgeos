import { auth } from '@/auth'
import { getAdapter, getServerVaultMode } from '@/lib/vault/getAdapter'
import { parseNoteFrontmatter } from '@/lib/vault/frontmatter'

export async function GET() {
  const session = await auth()
  const vaultMode = await getServerVaultMode(session?.user?.id)
  const adapter = await getAdapter(vaultMode === 'cloud' ? session?.user?.id : undefined)
  await adapter.ensureDirectories()

  const [wikiMeta, rawMeta] = await Promise.all([
    adapter.listNotes('wiki').catch(() => []),
    adapter.listNotes('raw').catch(() => []),
  ])
  const allMeta = [...wikiMeta, ...rawMeta]

  const tagCounts = new Map<string, number>()
  await Promise.all(
    allMeta.map(async (note) => {
      try {
        const content = await adapter.readNote(note.path)
        const { frontmatter } = parseNoteFrontmatter(content)
        for (const tag of frontmatter.tags) {
          tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
        }
      } catch { /* skip unreadable notes */ }
    })
  )

  const tags = Array.from(tagCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  return Response.json({ tags })
}
