import { getVpsConfig, proxyToVps } from '@/lib/vpsProxy'

export async function GET() {
  if (getVpsConfig()) return proxyToVps('/api/presets', 'GET')
  return Response.json({ names: [] })
}
