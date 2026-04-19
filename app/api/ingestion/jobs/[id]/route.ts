import { getAnyVpsConfig } from '@/lib/vpsProxy'

export const maxDuration = 60

async function proxy(path: string): Promise<Response> {
  const vps = getAnyVpsConfig()
  if (!vps) {
    return Response.json({ error: 'VPS ingestion is not configured.' }, { status: 501 })
  }
  const res = await fetch(`${vps.baseUrl}${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${vps.token}`,
    },
  })
  const data = await res.json()
  return Response.json(data, { status: res.status })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return proxy(`/api/ingestion/jobs/${encodeURIComponent(id)}`)
}
