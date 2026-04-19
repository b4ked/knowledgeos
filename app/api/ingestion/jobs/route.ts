import { getAnyVpsConfig } from '@/lib/vpsProxy'

export const maxDuration = 60

async function proxy(path: string, method: 'GET' | 'POST', body?: unknown): Promise<Response> {
  const vps = getAnyVpsConfig()
  if (!vps) {
    return Response.json({ error: 'VPS ingestion is not configured.' }, { status: 501 })
  }
  const res = await fetch(`${vps.baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${vps.token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  return Response.json(data, { status: res.status })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const ownerId = url.searchParams.get('ownerId')
  const path = ownerId ? `/api/ingestion/jobs?ownerId=${encodeURIComponent(ownerId)}` : '/api/ingestion/jobs'
  return proxy(path, 'GET')
}

export async function POST(request: Request) {
  const body = await request.json()
  return proxy('/api/ingestion/jobs', 'POST', body)
}
