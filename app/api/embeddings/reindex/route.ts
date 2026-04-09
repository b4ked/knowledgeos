import path from 'path'
import { getAdapter } from '@/lib/vault/getAdapter'
import { getLLMProvider } from '@/lib/llm/getLLMProvider'
import { upsertEmbedding, writeMeta } from '@/lib/embeddings/store'

export async function POST() {
  const vaultPath = process.env.VAULT_PATH
    ? path.resolve(process.env.VAULT_PATH)
    : path.resolve('./vault')

  const adapter = await getAdapter()
  const llm = getLLMProvider()
  const provider = process.env.LLM_PROVIDER ?? 'anthropic'
  const model = provider === 'openai' ? 'text-embedding-3-small' : 'voyage-3-lite'

  await adapter.ensureDirectories()
  const notes = await adapter.listNotes('wiki')

  const results: { slug: string; ok: boolean; error?: string }[] = []

  for (const note of notes) {
    try {
      const content = await adapter.readNote(note.path)
      const embedding = await llm.embed(content)
      await upsertEmbedding(vaultPath, note.slug, embedding)
      results.push({ slug: note.slug, ok: true })
    } catch (err) {
      results.push({ slug: note.slug, ok: false, error: (err as Error).message })
    }
  }

  await writeMeta(vaultPath, { provider, model, updatedAt: new Date().toISOString() })

  return Response.json({ indexed: results.filter((r) => r.ok).length, results })
}
