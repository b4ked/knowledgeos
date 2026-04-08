import { getLLMProvider } from '@/lib/llm/getLLMProvider'
import { LocalVaultAdapter } from '@/lib/vault/LocalVaultAdapter'
import { upsertEmbedding, writeMeta } from '@/lib/embeddings/store'
import { getVaultPath } from './config'

export async function reindexEmbeddings(vaultPath = getVaultPath()) {
  const adapter = new LocalVaultAdapter(vaultPath)
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
    } catch (error) {
      results.push({
        slug: note.slug,
        ok: false,
        error: error instanceof Error ? error.message : 'Embedding failed',
      })
    }
  }

  await writeMeta(vaultPath, { provider, model, updatedAt: new Date().toISOString() })

  return {
    indexed: results.filter((result) => result.ok).length,
    results,
  }
}
