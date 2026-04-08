import { getLLMProvider } from '@/lib/llm/getLLMProvider'
import { retrieveContext } from '@/lib/embeddings/retrieve'
import { readMeta } from '@/lib/embeddings/store'
import { LocalVaultAdapter } from '@/lib/vault/LocalVaultAdapter'
import { getVaultPath } from './config'
import { ApiError, requireNonEmptyString } from './errors'

export async function queryVault(
  payload: { question?: string },
  vaultPath = getVaultPath()
): Promise<{ answer: string; sources: string[] }> {
  const question = requireNonEmptyString(payload.question, 'question is required')
  const llm = getLLMProvider()

  const meta = await readMeta(vaultPath)
  const currentProvider = process.env.LLM_PROVIDER ?? 'anthropic'
  if (meta && meta.provider !== currentProvider) {
    throw new ApiError(
      409,
      `Embedding mismatch: vault was indexed with '${meta.provider}' but current provider is '${currentProvider}'. Re-index via POST /api/embeddings/reindex.`
    )
  }

  const retrieved = await retrieveContext(question, vaultPath, llm)
  const context = retrieved.map((result) => result.content)
  const sources = retrieved.map((result) => result.slug)
  const answer = await llm.query(question, context)

  appendQueryLog(vaultPath, question, answer, sources).catch(console.warn)
  return { answer, sources }
}

async function appendQueryLog(
  vaultPath: string,
  question: string,
  answer: string,
  sources: string[]
): Promise<void> {
  const adapter = new LocalVaultAdapter(vaultPath)
  const logPath = 'wiki/query-log.md'

  let existing = ''
  try {
    existing = await adapter.readNote(logPath)
  } catch {
    existing = '# Query Log\n\n'
  }

  const timestamp = new Date().toISOString()
  const sourceLine = sources.length > 0
    ? `**Sources:** ${sources.map((slug) => `[[${slug}]]`).join(', ')}\n\n`
    : ''

  const entry = `## ${timestamp}\n\n**Q:** ${question}\n\n**A:** ${answer}\n\n${sourceLine}---\n\n`
  await adapter.writeNote(logPath, existing + entry)
}
