import { getAnyVpsConfig, proxyToAnyVps } from '@/lib/vpsProxy'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) {
    return Response.json({ error: 'id is required' }, { status: 400 })
  }

  if (getAnyVpsConfig()) {
    return proxyToAnyVps(`/api/graphify/node?id=${encodeURIComponent(id)}`, 'GET')
  }

  return Response.json({ error: 'VPS Graphify node reader is not configured' }, { status: 501 })
}

