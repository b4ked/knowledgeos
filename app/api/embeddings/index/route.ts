import path from 'path'
import { auth } from '@/auth'
import { getAdapter } from '@/lib/vault/getAdapter'
import { getLLMProvider } from '@/lib/llm/getLLMProvider'
import { readStore, upsertEmbedding, writeMeta } from '@/lib/embeddings/store'
import { listUserEmbeddings, upsertUserEmbedding } from '@/lib/rag/cloudStore'
import { hashContent } from '@/lib/rag/hash'
import { getVpsConfig, proxyToVps } from '@/lib/vpsProxy'
import type { NoteFolder } from '@/lib/vault/VaultAdapter'

function getVaultPath() {
  return process.env.VAULT_PATH ? path.resolve(process.env.VAULT_PATH) : path.resolve('./vault')
}

interface ExplicitNoteInput {
  slug: string
  content: string
}

export const maxDuration = 60

export async function POST(request: Request) {
  const body = await request.json() as { folder?: string; notes?: ExplicitNoteInput[] }
  const { folder, notes: explicitNotes } = body

  if (folder !== 'raw' && folder !== 'wiki') {
    return Response.json({ error: 'folder must be raw or wiki' }, { status: 400 })
  }

  const llm = getLLMProvider()
  const provider = process.env.LLM_PROVIDER ?? 'anthropic'
  const model = provider === 'openai' ? 'text-embedding-3-small' : 'voyage-3-lite'
  const updatedAt = new Date().toISOString()

  if (Array.isArray(explicitNotes)) {
    const errors: string[] = []
    const entries: Array<{ slug: string; contentHash: string; embedding: number[]; updatedAt: string }> = []

    const validNotes = explicitNotes.filter(
      (n) => n?.slug && typeof n.content === 'string' && n.content.trim()
    )

    await Promise.all(
      validNotes.map(async (note) => {
        try {
          const embedding = await llm.embed(note.content)
          entries.push({
            slug: note.slug,
            contentHash: hashContent(note.content),
            embedding,
            updatedAt,
          })
        } catch (err) {
          errors.push(`${note.slug}: ${(err as Error).message}`)
        }
      })
    )

    return Response.json({
      indexed: entries.length,
      skipped: explicitNotes.length - entries.length - errors.length,
      total: explicitNotes.length,
      errors,
      entries,
      meta: { provider, model, updatedAt },
    })
  }

  const session = await auth()
  if (session?.user?.id) {
    const adapter = await getAdapter(session.user.id)
    const notes = await adapter.listNotes(folder)
    const existing = new Map(
      (await listUserEmbeddings(session.user.id, folder as NoteFolder)).map((entry) => [entry.slug, entry])
    )

    let indexed = 0
    let skipped = 0
    const errors: string[] = []

    for (const note of notes) {
      try {
        const content = await adapter.readNote(note.path)
        if (!content.trim()) {
          skipped++
          continue
        }
        const contentHash = hashContent(content)
        const previous = existing.get(note.slug)
        if (previous?.contentHash === contentHash) {
          skipped++
          continue
        }
        const embedding = await llm.embed(content)
        await upsertUserEmbedding({
          userId: session.user.id,
          folder,
          slug: note.slug,
          contentHash,
          embedding,
          provider,
          model,
        })
        indexed++
      } catch (err) {
        errors.push(`${note.slug}: ${(err as Error).message}`)
      }
    }

    return Response.json({ indexed, skipped, total: notes.length, errors, meta: { provider, model, updatedAt } })
  }

  if (getVpsConfig()) return proxyToVps('/api/embeddings/index', 'POST', body)

  const vaultPath = getVaultPath()
  const adapter = await getAdapter()
  await adapter.ensureDirectories()
  const notes = await adapter.listNotes(folder)

  // Load existing store — skip slugs already present
  const store = await readStore(vaultPath)

  let indexed = 0
  let skipped = 0
  const errors: string[] = []

  for (const note of notes) {
    if (store[note.slug] !== undefined) {
      skipped++
      continue
    }
    try {
      const content = await adapter.readNote(note.path)
      const embedding = await llm.embed(content)
      await upsertEmbedding(vaultPath, note.slug, embedding)
      indexed++
    } catch (err) {
      errors.push(`${note.slug}: ${(err as Error).message}`)
    }
  }

  if (indexed > 0) {
    await writeMeta(vaultPath, { provider, model, updatedAt })
  }

  return Response.json({ indexed, skipped, total: notes.length, errors, meta: { provider, model, updatedAt } })
}
