import { auth } from '@/auth'
import { getAdapter, getServerVaultMode } from '@/lib/vault/getAdapter'
import { runGraphifyForAdapter, writeGraphifyOutput } from '@/lib/graph/graphifyServer'
import { buildGraphifyOutputFromNotes } from '@/lib/graph/graphify'
import { getAnyVpsConfig, proxyToAnyVps } from '@/lib/vpsProxy'
import type { NoteInput } from '@/lib/graph/parseLinks'

type Body = {
  notes?: NoteInput[]
  persist?: boolean
  forceVps?: boolean
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Body
  try {
    const session = await auth()
    const vaultMode = await getServerVaultMode(session?.user?.id)

    if (Array.isArray(body.notes)) {
      return Response.json(buildGraphifyOutputFromNotes(body.notes))
    }

    if ((body.forceVps || vaultMode === 'remote') && getAnyVpsConfig()) {
      return proxyToAnyVps('/api/graphify/run', 'POST', { persist: body.persist !== false })
    }

    const adapter = await getAdapter(vaultMode === 'cloud' ? session?.user?.id : undefined)
    const result = await runGraphifyForAdapter(adapter)
    let warning: string | undefined
    if (body.persist !== false && vaultMode !== 'cloud') {
      try {
        await writeGraphifyOutput(adapter, result)
      } catch (err) {
        warning = err instanceof Error ? err.message : 'Could not persist Graphify output'
      }
    }
    return Response.json({ ...result, warning })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Graphify failed' }, { status: 500 })
  }
}
