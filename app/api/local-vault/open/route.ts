import { z } from 'zod'
import { initVault } from '@/lib/knowledge/vault/initVault'

const Body = z.object({ path: z.string().min(1) })

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  try {
    const vault = await initVault(parsed.data.path)
    await vault.store.close()
    return Response.json({ workspace: vault.workspace, config: vault.config })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Could not open vault' }, { status: 500 })
  }
}

