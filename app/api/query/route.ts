import path from 'path'
import { auth } from '@/auth'
import { getLLMProvider } from '@/lib/llm/getLLMProvider'
import { retrieveContext } from '@/lib/embeddings/retrieve'
import { readMeta } from '@/lib/embeddings/store'
import { getAdapter } from '@/lib/vault/getAdapter'
import { LocalVaultAdapter } from '@/lib/vault/LocalVaultAdapter'
import { cosineSimilarity } from '@/lib/embeddings/cosine'
import { getVpsConfig, proxyToVps } from '@/lib/vpsProxy'

interface QueryNoteInput {
  slug: string
  content: string
}

function getVaultPath() {
  return process.env.VAULT_PATH ? path.resolve(process.env.VAULT_PATH) : path.resolve('./vault')
}

async function queryFromNotes(question: string, notes: QueryNoteInput[]) {
  const llm = getLLMProvider()
  const cleanNotes = notes.filter((note) => note.content.trim().length > 0)
  const questionEmbedding = await llm.embed(question)

  const scored = await Promise.all(
    cleanNotes.map(async (note) => ({
      slug: note.slug,
      content: note.content,
      score: cosineSimilarity(questionEmbedding, await llm.embed(note.content)),
    }))
  )

  const retrieved = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .filter((note) => note.score >= 0.05)

  const context = retrieved.map((note) => note.content)
  const sources = retrieved.map((note) => note.slug)
  const answer = await llm.query(question, context)

  return { answer, sources }
}

export async function POST(request: Request) {
  const body = await request.json() as { question?: string; notes?: QueryNoteInput[] }
  const { question, notes } = body

  if (!question || typeof question !== 'string' || !question.trim()) {
    return Response.json({ error: 'question is required' }, { status: 400 })
  }

  try {
    if (Array.isArray(notes) && notes.length > 0) {
      const result = await queryFromNotes(question.trim(), notes)
      return Response.json(result)
    }

    if (getVpsConfig()) return proxyToVps('/api/query', 'POST', body)

    const session = await auth()
    if (session?.user?.id) {
      const adapter = await getAdapter(session.user.id)
      const wikiMeta = await adapter.listNotes('wiki')
      const wikiNotes = await Promise.all(
        wikiMeta.map(async (note) => ({
          slug: note.slug,
          content: await adapter.readNote(note.path).catch(() => ''),
        }))
      )
      const result = await queryFromNotes(question.trim(), wikiNotes)
      return Response.json(result)
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

    const retrieved = await retrieveContext(question.trim(), vaultPath, llm)
    const context = retrieved.map((r) => r.content)
    const sources = retrieved.map((r) => r.slug)
    const answer = await llm.query(question.trim(), context)

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
