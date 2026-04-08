import { getGraph } from '@/lib/server/graph'
import { proxyToBackend, shouldProxyToBackend } from '@/lib/server/proxy'
import { jsonError } from '@/lib/server/response'

export async function GET(request: Request) {
  if (shouldProxyToBackend()) {
    return proxyToBackend(request)
  }

  try {
    return Response.json(await getGraph())
  } catch (error) {
    return jsonError(error)
  }
}
