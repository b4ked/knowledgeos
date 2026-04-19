import path from 'path'
import { auth } from '@/auth'
import { checkAndIncrementUsage } from '@/lib/usage'
import { getLLMProvider } from '@/lib/llm/getLLMProvider'
import { retrieveContext } from '@/lib/embeddings/retrieve'
import { readMeta } from '@/lib/embeddings/store'
import { listUserEmbeddings } from '@/lib/rag/cloudStore'
import { getAdapter, getServerVaultMode } from '@/lib/vault/getAdapter'
import { LocalVaultAdapter } from '@/lib/vault/LocalVaultAdapter'
import { cosineSimilarity } from '@/lib/embeddings/cosine'
import { getVpsConfig, proxyToVps } from '@/lib/vpsProxy'
import { parseLinks } from '@/lib/graph/parseLinks'
import { graphAwareRetrieveFromCloud } from '@/lib/rag/graphAwareRetrieve'
import type { NoteInput } from '@/lib/graph/parseLinks'
import { readPlatformSettings } from '@/lib/admin/platformSettings'

interface QueryNoteInput {
  slug: string
  content: string
}

function getVaultPath() {
  return process.env.VAULT_PATH ? path.resolve(process.env.VAULT_PATH) : path.resolve('./vault')
}

async function queryFromNotes(
  question: string,
  notes: QueryNoteInput[],
  runtime: { compileMaxTokens: number; queryMaxTokens: number; queryModel?: string },
) {
  const llm = getLLMProvider(
    runtime.queryModel ? { queryModel: runtime.queryModel } : undefined,
    runtime,
  )
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

async function queryFromCloud(
  question: string,
  userId: string,
  runtime: { compileMaxTokens: number; queryMaxTokens: number; queryModel?: string },
  useGraphAware = true,
) {
  const llm = getLLMProvider(
    runtime.queryModel ? { queryModel: runtime.queryModel } : undefined,
    runtime,
  )
  const embeddings = await listUserEmbeddings(userId, 'wiki')

  if (embeddings.length === 0) {
    return {
      error: 'Cloud RAG index is empty. Open Settings and tokenise your wiki notes first.',
      status: 409,
    }
  }

  const questionEmbedding = await llm.embed(question)
  const adapter = await getAdapter(userId)

  let slugsToRetrieve: string[]

  if (useGraphAware) {
    // Build live graph for graph-aware retrieval
    try {
      const wikiMeta = await adapter.listNotes('wiki')
      const wikiNotes: NoteInput[] = await Promise.all(
        wikiMeta.map(async (m) => ({
          slug: m.slug,
          content: await adapter.readNote(m.path).catch(() => ''),
          type: 'wiki' as const,
        }))
      )
      const graphData = parseLinks(wikiNotes)
      const graphResults = graphAwareRetrieveFromCloud(questionEmbedding, embeddings, graphData, {
        topK: 5,
        semanticWeight: 0.7,
        minScore: 0.08,
      })
      slugsToRetrieve = graphResults.map((r) => r.slug)
    } catch {
      // Fall back to standard RAG if graph-aware fails
      slugsToRetrieve = embeddings
        .map((entry) => ({ slug: entry.slug, score: cosineSimilarity(questionEmbedding, entry.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .filter((entry) => entry.score >= 0.1)
        .map((entry) => entry.slug)
    }
  } else {
    slugsToRetrieve = embeddings
      .map((entry) => ({ slug: entry.slug, score: cosineSimilarity(questionEmbedding, entry.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .filter((entry) => entry.score >= 0.1)
      .map((entry) => entry.slug)
  }

  const sources: string[] = []
  const context: string[] = []

  for (const slug of slugsToRetrieve) {
    const content = await adapter.readNote(`wiki/${slug}.md`).catch(() => '')
    if (!content.trim()) continue
    sources.push(slug)
    context.push(content)
  }

  const answer = await llm.query(question, context)
  return { answer, sources, status: 200 }
}

export async function POST(request: Request) {
  const body = await request.json() as { question?: string; notes?: QueryNoteInput[] }
  const { question, notes } = body

  if (!question || typeof question !== 'string' || !question.trim()) {
    return Response.json({ error: 'question is required' }, { status: 400 })
  }

  try {
    const session = await auth()
    const vaultMode = await getServerVaultMode(session?.user?.id)

    if (Array.isArray(notes) && notes.length > 0) {
      if (session?.user?.id) {
        try {
          const usage = await checkAndIncrementUsage(session.user.id, 'chat')
          if (!usage.allowed) {
            return Response.json(
              { error: `Daily limit reached (${usage.used}/${usage.limit}). Upgrade your plan for unlimited access.` },
              { status: 429 }
            )
          }
        } catch (usageErr) {
          console.error('query: usage check failed (non-fatal):', usageErr)
        }
      }
      const admin = await readPlatformSettings()
      const runtime = {
        compileMaxTokens: admin.compileMaxOutputTokens,
        queryMaxTokens: admin.queryMaxOutputTokens,
        queryModel: admin.globalQueryModel,
      }
      const result = await queryFromNotes(question.trim(), notes, runtime)
      return Response.json(result)
    }

    if (vaultMode === 'cloud' && session?.user?.id) {
      try {
        const usage = await checkAndIncrementUsage(session.user.id, 'chat')
        if (!usage.allowed) {
          return Response.json(
            { error: `Daily limit reached (${usage.used}/${usage.limit}). Upgrade your plan for unlimited access.` },
            { status: 429 }
          )
        }
      } catch (usageErr) {
        console.error('query: usage check failed (non-fatal):', usageErr)
      }
      const admin = await readPlatformSettings()
      const runtime = {
        compileMaxTokens: admin.compileMaxOutputTokens,
        queryMaxTokens: admin.queryMaxOutputTokens,
        queryModel: admin.globalQueryModel,
      }
      const result = await queryFromCloud(question.trim(), session.user.id, runtime)
      if (result.status !== 200) {
        return Response.json({ error: result.error }, { status: result.status })
      }
      return Response.json({ answer: result.answer, sources: result.sources })
    }

    if (vaultMode === 'remote' && getVpsConfig()) return proxyToVps('/api/query', 'POST', body)

    const vaultPath = getVaultPath()
    const admin = await readPlatformSettings()
    const llm = getLLMProvider(undefined, {
      compileMaxTokens: admin.compileMaxOutputTokens,
      queryMaxTokens: admin.queryMaxOutputTokens,
      queryModel: admin.globalQueryModel,
    })

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
