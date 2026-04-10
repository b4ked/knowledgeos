import { auth } from '@/auth'
import { getAdapter } from '@/lib/vault/getAdapter'

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
  const adapter = await getAdapter(session?.user?.id ?? undefined)

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
  const adapter = await getAdapter(session?.user?.id ?? undefined)
  await adapter.writeNote(notePath, body.content)

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
  const adapter = await getAdapter(session?.user?.id ?? undefined)

  try {
    await adapter.deleteNote(notePath)
    return new Response(null, { status: 204 })
  } catch {
    return Response.json({ error: `Note not found: ${slug}` }, { status: 404 })
  }
}
