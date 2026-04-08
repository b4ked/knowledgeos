import { readConventions, saveConventions } from '@/lib/server/conventions'
import { proxyToBackend, shouldProxyToBackend } from '@/lib/server/proxy'
import { jsonError } from '@/lib/server/response'

export async function GET(request: Request) {
  if (shouldProxyToBackend()) {
    return proxyToBackend(request)
  }

  try {
    return Response.json(await readConventions())
  } catch (error) {
    return jsonError(error)
  }
}

export async function PUT(request: Request) {
  if (shouldProxyToBackend()) {
    return proxyToBackend(request)
  }

  try {
    return Response.json(await saveConventions(await request.json()))
  } catch (error) {
    return jsonError(error)
  }
}
