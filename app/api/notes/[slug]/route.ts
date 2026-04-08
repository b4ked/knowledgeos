import path from 'path'
import { LocalVaultAdapter } from '@/lib/vault/LocalVaultAdapter'

function getAdapter() {
  const vaultPath = process.env.VAULT_PATH
    ? path.resolve(process.env.VAULT_PATH)
    : path.resolve('./vault')
  return new LocalVaultAdapter(vaultPath)
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params
  const folder = new URL(request.url).searchParams.get('folder') as 'raw' | 'wiki' | null
  if (folder !== 'raw' && folder !== 'wiki') {
    return Response.json({ error: 'folder must be raw or wiki' }, { status: 400 })
  }

  const notePath = `${folder}/${slug}.md`
  const adapter = getAdapter()

  try {
    const content = await adapter.readNote(notePath)
    return Response.json({ content })
  } catch {
    return Response.json({ error: `Note not found: ${slug}` }, { status: 404 })
  }
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params
  const folder = new URL(request.url).searchParams.get('folder') as 'raw' | 'wiki' | null
  if (folder !== 'raw' && folder !== 'wiki') {
    return Response.json({ error: 'folder must be raw or wiki' }, { status: 400 })
  }

  const notePath = `${folder}/${slug}.md`
  const adapter = getAdapter()

  try {
    await adapter.deleteNote(notePath)
    return new Response(null, { status: 204 })
  } catch {
    return Response.json({ error: `Note not found: ${slug}` }, { status: 404 })
  }
}
