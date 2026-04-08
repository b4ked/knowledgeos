import { reindexEmbeddings } from '@/lib/server/embeddings'
import { proxyToBackend, shouldProxyToBackend } from '@/lib/server/proxy'
import { jsonError } from '@/lib/server/response'

export async function POST(request: Request) {
  if (shouldProxyToBackend()) {
    return proxyToBackend(request)
  }

  try {
    return Response.json(await reindexEmbeddings())
  } catch (error) {
    return jsonError(error)
  }
}
