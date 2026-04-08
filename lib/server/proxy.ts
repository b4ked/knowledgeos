import { BACKEND_SHARED_SECRET_HEADER } from './auth'
import { getBackendUrl, getFrontendBackendSecret } from './config'
import { ApiError } from './errors'

export function shouldProxyToBackend(): boolean {
  return getBackendUrl() !== null
}

export async function proxyToBackend(request: Request): Promise<Response> {
  const backendUrl = getBackendUrl()
  if (!backendUrl) {
    throw new ApiError(500, 'KNOWLEDGEOS_BACKEND_URL is not set')
  }

  const sharedSecret = getFrontendBackendSecret()
  if (!sharedSecret) {
    throw new ApiError(500, 'KNOWLEDGEOS_BACKEND_SHARED_SECRET is not set')
  }

  const incomingUrl = new URL(request.url)
  const targetUrl = new URL(`${backendUrl}${incomingUrl.pathname}${incomingUrl.search}`)
  const headers = new Headers()

  const contentType = request.headers.get('content-type')
  if (contentType) {
    headers.set('content-type', contentType)
  }

  const accept = request.headers.get('accept')
  if (accept) {
    headers.set('accept', accept)
  }

  headers.set(BACKEND_SHARED_SECRET_HEADER, sharedSecret)

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.text(),
    cache: 'no-store',
  })

  const proxyHeaders = new Headers()
  const responseType = response.headers.get('content-type')
  if (responseType) {
    proxyHeaders.set('content-type', responseType)
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: proxyHeaders,
  })
}
