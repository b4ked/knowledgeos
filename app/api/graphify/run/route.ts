import { auth } from '@/auth'
import { getAdapter, getServerVaultMode } from '@/lib/vault/getAdapter'
import { getVpsConfig, proxyToVps } from '@/lib/vpsProxy'
import { runGraphifyForAdapter, writeGraphifyOutput } from '@/lib/graph/graphifyServer'
import { buildGraphifyOutputFromNotes } from '@/lib/graph/graphify'
import type { NoteInput } from '@/lib/graph/parseLinks'

type Body = {
  notes?: NoteInput[]
  persist?: boolean
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Body
  const session = await auth()
  const vaultMode = await getServerVaultMode(session?.user?.id)

  if (vaultMode === 'remote' && getVpsConfig() && !body.notes) {
    return proxyToVps('/api/graphify/run', 'POST', body)
  }

  try {
    if (Array.isArray(body.notes)) {
      return Response.json(buildGraphifyOutputFromNotes(body.notes))
    }

    const adapter = await getAdapter(vaultMode === 'cloud' ? session?.user?.id : undefined)
    const result = await runGraphifyForAdapter(adapter)
    if (body.persist !== false) await writeGraphifyOutput(adapter, result)
    return Response.json(result)
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Graphify failed' }, { status: 500 })
  }
}

