import { auth } from '@/auth'
import { getLLMProvider } from '@/lib/llm/getLLMProvider'
import { deleteUserEmbeddings, upsertUserEmbedding } from '@/lib/rag/cloudStore'
import { hashContent } from '@/lib/rag/hash'
import { getAdapter, getServerVaultMode } from '@/lib/vault/getAdapter'

export async function GET(
  request: Request,
  ctx: { params: Promise<{ slug: string[] }> }
) {
  const { slug: slugParts } = await ctx.params
  const slug = slugParts.join('/')
  const folder = new URL(request.url).searchParams.get('folder') as 'raw' | 'wiki' | null
  if (folder !== 'raw' && folder !== 'wiki') {
    return Response.json({ error: 'folder must be raw or wiki' }, { status: 400 })
  }

  const notePath = `${folder}/${slug}.md`
  const session = await auth()
  const vaultMode = await getServerVaultMode(session?.user?.id)
  const adapter = await getAdapter(vaultMode === 'cloud' ? session?.user?.id : undefined)

  try {
    const content = await adapter.readNote(notePath)
    return Response.json({ content })
  } catch {
    return Response.json({ error: `Note not found: ${slug}` }, { status: 404 })
  }
}

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ slug: string[] }> }
) {
  const { slug: slugParts } = await ctx.params
  const slug = slugParts.join('/')
  const folder = new URL(request.url).searchParams.get('folder') as 'raw' | 'wiki' | null
  if (folder !== 'raw' && folder !== 'wiki') {
    return Response.json({ error: 'folder must be raw or wiki' }, { status: 400 })
  }
  const body = await request.json() as { content?: string }
  if (typeof body.content !== 'string') {
    return Response.json({ error: 'content is required' }, { status: 400 })
  }

  const notePath = `${folder}/${slug}.md`
  const session = await auth()
  const vaultMode = await getServerVaultMode(session?.user?.id)
  const adapter = await getAdapter(vaultMode === 'cloud' ? session?.user?.id : undefined)
  await adapter.writeNote(notePath, body.content)

  if (vaultMode === 'cloud' && session?.user?.id && folder === 'wiki' && body.content.trim()) {
    const llm = getLLMProvider()
    const provider = process.env.LLM_PROVIDER ?? 'anthropic'
    const model = provider === 'openai' ? 'text-embedding-3-small' : 'voyage-3-lite'
    try {
      await upsertUserEmbedding({
        userId: session.user.id,
        folder: 'wiki',
        slug,
        contentHash: hashContent(body.content),
        embedding: await llm.embed(body.content),
        provider,
        model,
      })
    } catch (embedErr) {
      console.error('notes PUT: embedding upsert failed (non-fatal):', embedErr)
    }
  }

  const notes = await adapter.listNotes(folder)
  const updated = notes.find((n) => n.slug === slug)
  if (!updated) {
    return Response.json({ error: 'Note updated but metadata not found' }, { status: 500 })
  }

  return Response.json(updated)
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ slug: string[] }> }
) {
  const { slug: slugParts } = await ctx.params
  const slug = slugParts.join('/')
  const folder = new URL(request.url).searchParams.get('folder') as 'raw' | 'wiki' | null
  if (folder !== 'raw' && folder !== 'wiki') {
    return Response.json({ error: 'folder must be raw or wiki' }, { status: 400 })
  }

  const notePath = `${folder}/${slug}.md`
  const session = await auth()
  const vaultMode = await getServerVaultMode(session?.user?.id)
  const adapter = await getAdapter(vaultMode === 'cloud' ? session?.user?.id : undefined)

  try {
    await adapter.deleteNote(notePath)
    if (vaultMode === 'cloud' && session?.user?.id && folder === 'wiki') {
      await deleteUserEmbeddings(session.user.id, { folder: 'wiki', slug })
    }
    return new Response(null, { status: 204 })
  } catch {
    return Response.json({ error: `Note not found: ${slug}` }, { status: 404 })
  }
}
