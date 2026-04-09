import path from 'path'
import { getAdapter } from '@/lib/vault/getAdapter'
import { getLLMProvider } from '@/lib/llm/getLLMProvider'
import { readStore, upsertEmbedding, writeMeta } from '@/lib/embeddings/store'

function getVaultPath() {
  return process.env.VAULT_PATH ? path.resolve(process.env.VAULT_PATH) : path.resolve('./vault')
}

export async function POST(request: Request) {
  const body = await request.json() as { folder?: string }
  const { folder } = body

  if (folder !== 'raw' && folder !== 'wiki') {
    return Response.json({ error: 'folder must be raw or wiki' }, { status: 400 })
  }

  const vaultPath = getVaultPath()
  const adapter = await getAdapter()
  const llm = getLLMProvider()
  const provider = process.env.LLM_PROVIDER ?? 'anthropic'
  const model = provider === 'openai' ? 'text-embedding-3-small' : 'voyage-3-lite'

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
    await writeMeta(vaultPath, { provider, model, updatedAt: new Date().toISOString() })
  }

  return Response.json({ indexed, skipped, total: notes.length, errors })
}
