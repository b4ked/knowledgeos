import path from 'path'
import { writeStore } from '@/lib/embeddings/store'
import { getVpsConfig, proxyToVps } from '@/lib/vpsProxy'

function getVaultPath() {
  return process.env.VAULT_PATH ? path.resolve(process.env.VAULT_PATH) : path.resolve('./vault')
}

export async function DELETE() {
  if (getVpsConfig()) return proxyToVps('/api/embeddings/clear', 'DELETE')
  const vaultPath = getVaultPath()
  await writeStore(vaultPath, {})
  return Response.json({ ok: true, cleared: true })
}
