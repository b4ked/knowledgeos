import { getAnyVpsConfig } from '@/lib/vpsProxy'

export const maxDuration = 60

async function proxy(path: string, body?: unknown): Promise<Response> {
  const vps = getAnyVpsConfig()
  if (!vps) {
    return Response.json({ error: 'VPS ingestion is not configured.' }, { status: 501 })
  }
  const res = await fetch(`${vps.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${vps.token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  return Response.json(data, { status: res.status })
}

const ALLOWED_ACTIONS = new Set(['start', 'retry', 'cancel', 'files'])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const { id, action } = await params
  if (!ALLOWED_ACTIONS.has(action)) {
    return Response.json({ error: `Unsupported ingestion action: ${action}` }, { status: 404 })
  }
  const body = await request.json().catch(() => undefined)
  return proxy(`/api/ingestion/jobs/${encodeURIComponent(id)}/${action}`, body)
}
