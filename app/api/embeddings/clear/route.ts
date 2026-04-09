import path from 'path'
import { writeStore } from '@/lib/embeddings/store'

function getVaultPath() {
  return process.env.VAULT_PATH ? path.resolve(process.env.VAULT_PATH) : path.resolve('./vault')
}

export async function DELETE() {
  const vaultPath = getVaultPath()
  await writeStore(vaultPath, {})
  return Response.json({ ok: true, cleared: true })
}
