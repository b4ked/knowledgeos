import { deleteNote, readNote } from '@/lib/server/notes'
import { proxyToBackend, shouldProxyToBackend } from '@/lib/server/proxy'
import { jsonError } from '@/lib/server/response'

export async function GET(
  request: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  if (shouldProxyToBackend()) {
    return proxyToBackend(request)
  }

  try {
    const { slug } = await ctx.params
    const folder = new URL(request.url).searchParams.get('folder')
    return Response.json(await readNote(slug, folder))
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  if (shouldProxyToBackend()) {
    return proxyToBackend(request)
  }

  try {
    const { slug } = await ctx.params
    const folder = new URL(request.url).searchParams.get('folder')
    await deleteNote(slug, folder)
    return new Response(null, { status: 204 })
  } catch (error) {
    return jsonError(error)
  }
}
