import { auth } from '@/auth'
import { getAdapter, getServerVaultMode } from '@/lib/vault/getAdapter'

export async function POST(request: Request) {
  const body = await request.json() as { folder?: string; folderPath?: string }
  const { folder, folderPath } = body

  if (folder !== 'raw' && folder !== 'wiki') {
    return Response.json({ error: 'folder must be raw or wiki' }, { status: 400 })
  }
  if (!folderPath || typeof folderPath !== 'string' || folderPath.includes('..') || folderPath.startsWith('/') || folderPath.endsWith('/')) {
    return Response.json({ error: 'invalid folderPath' }, { status: 400 })
  }

  const session = await auth()
  const vaultMode = await getServerVaultMode(session?.user?.id)
  const adapter = await getAdapter(vaultMode === 'cloud' ? session?.user?.id : undefined)
  await adapter.ensureDirectories()
  await adapter.writeNote(`${folder}/${folderPath}/.keep`, '')

  return Response.json({ ok: true, path: `${folder}/${folderPath}/.keep` }, { status: 201 })
}
