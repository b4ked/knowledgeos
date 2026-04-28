import { z } from 'zod'
import { scanVault } from '@/lib/knowledge/vault/scanVault'

const Body = z.object({ path: z.string().min(1) })

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  try {
    return Response.json(await scanVault(parsed.data.path))
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Could not scan vault' }, { status: 500 })
  }
}

