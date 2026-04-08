import { compileNotes } from '@/lib/server/compile'
import { proxyToBackend, shouldProxyToBackend } from '@/lib/server/proxy'
import { jsonError } from '@/lib/server/response'

export async function POST(request: Request) {
  if (shouldProxyToBackend()) {
    return proxyToBackend(request)
  }

  try {
    return Response.json(await compileNotes(await request.json()), { status: 200 })
  } catch (error) {
    return jsonError(error)
  }
}
