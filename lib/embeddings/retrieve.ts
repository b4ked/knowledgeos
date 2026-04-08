import { LocalVaultAdapter } from '@/lib/vault/LocalVaultAdapter'
import { cosineSimilarity } from './cosine'
import { readStore } from './store'
import type { LLMProvider } from '@/lib/llm/LLMProvider'

export interface RetrievedContext {
  slug: string
  content: string
  score: number
}

const SCORE_THRESHOLD = 0.1

export async function retrieveContext(
  question: string,
  vaultPath: string,
  llm: LLMProvider,
  topK = 5
): Promise<RetrievedContext[]> {
  const store = await readStore(vaultPath)
  if (Object.keys(store).length === 0) return []

  const questionEmbedding = await llm.embed(question)
  const adapter = new LocalVaultAdapter(vaultPath)

  const scored = Object.entries(store)
    .map(([slug, vec]) => ({ slug, score: cosineSimilarity(questionEmbedding, vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((r) => r.score >= SCORE_THRESHOLD)

  const results = await Promise.all(
    scored.map(async ({ slug, score }) => {
      const content = await adapter.readNote(`wiki/${slug}.md`).catch(() => '')
      return { slug, content, score }
    })
  )

  return results.filter((r) => r.content.length > 0)
}
