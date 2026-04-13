import path from 'path'
import { auth } from '@/auth'
import { writeStore } from '@/lib/embeddings/store'
import { deleteUserEmbeddings } from '@/lib/rag/cloudStore'
import { getVpsConfig, proxyToVps } from '@/lib/vpsProxy'
import { getServerVaultMode } from '@/lib/vault/getAdapter'

function getVaultPath() {
  return process.env.VAULT_PATH ? path.resolve(process.env.VAULT_PATH) : path.resolve('./vault')
}

export async function DELETE() {
  const session = await auth()
  const vaultMode = await getServerVaultMode(session?.user?.id)
  if (vaultMode === 'cloud' && session?.user?.id) {
    await deleteUserEmbeddings(session.user.id)
    return Response.json({ ok: true, cleared: true })
  }

  if (vaultMode === 'remote' && getVpsConfig()) return proxyToVps('/api/embeddings/clear', 'DELETE')
  const vaultPath = getVaultPath()
  await writeStore(vaultPath, {})
  return Response.json({ ok: true, cleared: true })
}
