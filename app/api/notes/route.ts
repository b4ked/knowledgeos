import { auth } from '@/auth'
import { getLLMProvider } from '@/lib/llm/getLLMProvider'
import { upsertUserEmbedding } from '@/lib/rag/cloudStore'
import { hashContent } from '@/lib/rag/hash'
import { getAdapter, getServerVaultMode } from '@/lib/vault/getAdapter'

export async function GET(request: Request) {
  const folder = new URL(request.url).searchParams.get('folder') as 'raw' | 'wiki' | null
  if (folder !== 'raw' && folder !== 'wiki') {
    return Response.json({ error: 'folder must be raw or wiki' }, { status: 400 })
  }

  const session = await auth()
  const vaultMode = await getServerVaultMode(session?.user?.id)
  const adapter = await getAdapter(vaultMode === 'cloud' ? session?.user?.id : undefined)
  await adapter.ensureDirectories()
  const notes = await adapter.listNotes(folder)
  const filtered = notes.filter(n => n.filename !== '.keep' && !n.slug.endsWith('/.keep') && n.slug !== '.keep')
  return Response.json(filtered)
}

export async function POST(request: Request) {
  const body = await request.json() as { folder?: string; filename?: string; content?: string }
  const { folder, filename, content } = body

  if (folder !== 'raw' && folder !== 'wiki') {
    return Response.json({ error: 'folder must be raw or wiki' }, { status: 400 })
  }
  if (!filename || typeof filename !== 'string') {
    return Response.json({ error: 'filename is required' }, { status: 400 })
  }
  if (typeof content !== 'string') {
    return Response.json({ error: 'content is required' }, { status: 400 })
  }

  const safeFilename = filename.endsWith('.md') ? filename : `${filename}.md`
  const notePath = `${folder}/${safeFilename}`

  const session = await auth()
  const vaultMode = await getServerVaultMode(session?.user?.id)
  const adapter = await getAdapter(vaultMode === 'cloud' ? session?.user?.id : undefined)
  await adapter.ensureDirectories()
  await adapter.writeNote(notePath, content)

  if (vaultMode === 'cloud' && session?.user?.id && folder === 'wiki' && content.trim()) {
    const llm = getLLMProvider()
    const provider = process.env.LLM_PROVIDER ?? 'anthropic'
    const model = provider === 'openai' ? 'text-embedding-3-small' : 'voyage-3-lite'
    try {
      await upsertUserEmbedding({
        userId: session.user.id,
        folder: 'wiki',
        slug: safeFilename.replace(/\.md$/, ''),
        contentHash: hashContent(content),
        embedding: await llm.embed(content),
        provider,
        model,
      })
    } catch (embedErr) {
      console.error('notes POST: embedding upsert failed (non-fatal):', embedErr)
    }
  }

  const notes = await adapter.listNotes(folder as 'raw' | 'wiki')
  const created = notes.find((n) => n.filename === safeFilename)
  if (!created) {
    return Response.json({ error: 'Note created but metadata not found' }, { status: 500 })
  }

  return Response.json(created, { status: 201 })
}
