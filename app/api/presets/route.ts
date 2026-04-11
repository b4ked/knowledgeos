import { auth } from '@/auth'
import { getVpsConfig, proxyToVps } from '@/lib/vpsProxy'

export async function GET() {
  // Authenticated users (cloud mode) don't have filesystem presets — return empty
  const session = await auth()
  if (session?.user?.id) return Response.json({ names: [] })

  if (getVpsConfig()) return proxyToVps('/api/presets', 'GET')
  return Response.json({ names: [] })
}
