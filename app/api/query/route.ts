import { proxyToBackend, shouldProxyToBackend } from '@/lib/server/proxy'
import { queryVault } from '@/lib/server/query'
import { jsonError } from '@/lib/server/response'

export async function POST(request: Request) {
  if (shouldProxyToBackend()) {
    return proxyToBackend(request)
  }

  try {
    return Response.json(await queryVault(await request.json()))
  } catch (error) {
    return jsonError(error)
  }
}
