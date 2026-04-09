import { getVpsConfig, proxyToVps } from '@/lib/vpsProxy'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  if (getVpsConfig()) return proxyToVps(`/api/presets/${encodeURIComponent(name)}`, 'GET')
  return Response.json({ error: 'Not found' }, { status: 404 })
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  const body = await req.json()
  if (getVpsConfig()) return proxyToVps(`/api/presets/${encodeURIComponent(name)}`, 'PUT', body)
  return Response.json({ error: 'Not configured' }, { status: 501 })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  if (getVpsConfig()) return proxyToVps(`/api/presets/${encodeURIComponent(name)}`, 'DELETE')
  return Response.json({ error: 'Not configured' }, { status: 501 })
}
