import path from 'path'
import { getLLMProvider } from '@/lib/llm/getLLMProvider'
import { retrieveContext } from '@/lib/embeddings/retrieve'
import { readMeta } from '@/lib/embeddings/store'
import { LocalVaultAdapter } from '@/lib/vault/LocalVaultAdapter'
import { getVpsConfig, proxyToVps } from '@/lib/vpsProxy'

function getVaultPath() {
  return process.env.VAULT_PATH ? path.resolve(process.env.VAULT_PATH) : path.resolve('./vault')
}

export async function POST(request: Request) {
  const body = await request.json() as { question?: string }
  const { question } = body

  if (getVpsConfig()) return proxyToVps('/api/query', 'POST', body)

  if (!question || typeof question !== 'string' || !question.trim()) {
    return Response.json({ error: 'question is required' }, { status: 400 })
  }

  const vaultPath = getVaultPath()
  const llm = getLLMProvider()

  // Warn if embeddings were generated with a different provider
  const meta = await readMeta(vaultPath)
  const currentProvider = process.env.LLM_PROVIDER ?? 'anthropic'
  if (meta && meta.provider !== currentProvider) {
    return Response.json(
      {
        error: `Embedding mismatch: vault was indexed with '${meta.provider}' but current provider is '${currentProvider}'. Re-index via POST /api/embeddings/reindex.`,
      },
      { status: 409 }
    )
  }

  try {
    // Retrieve relevant wiki notes
    const retrieved = await retrieveContext(question.trim(), vaultPath, llm)
    const context = retrieved.map((r) => r.content)
    const sources = retrieved.map((r) => r.slug)

    // Query LLM with context
    const answer = await llm.query(question.trim(), context)

    // Append to query log (non-fatal)
    appendQueryLog(vaultPath, question.trim(), answer, sources).catch(console.warn)

    return Response.json({ answer, sources })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Query failed'
    return Response.json({ error: message }, { status: 500 })
  }
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

  const ts = new Date().toISOString()
  const sourceLine = sources.length > 0
    ? `**Sources:** ${sources.map((s) => `[[${s}]]`).join(', ')}\n\n`
    : ''

  const entry = `## ${ts}\n\n**Q:** ${question}\n\n**A:** ${answer}\n\n${sourceLine}---\n\n`
  await adapter.writeNote(logPath, existing + entry)
}
