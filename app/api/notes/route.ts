import { createNote, listNotes } from '@/lib/server/notes'
import { proxyToBackend, shouldProxyToBackend } from '@/lib/server/proxy'
import { jsonError } from '@/lib/server/response'

export async function GET(request: Request) {
  if (shouldProxyToBackend()) {
    return proxyToBackend(request)
  }

  try {
    const folder = new URL(request.url).searchParams.get('folder')
    return Response.json(await listNotes(folder))
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: Request) {
  if (shouldProxyToBackend()) {
    return proxyToBackend(request)
  }

  try {
    const body = await request.json() as { folder?: string; filename?: string; content?: string }
    return Response.json(await createNote(body), { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
