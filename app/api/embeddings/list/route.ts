import path from 'path'
import { readStore, readMeta } from '@/lib/embeddings/store'

function getVaultPath() {
  return process.env.VAULT_PATH ? path.resolve(process.env.VAULT_PATH) : path.resolve('./vault')
}

export async function GET() {
  const vaultPath = getVaultPath()
  const [store, meta] = await Promise.all([readStore(vaultPath), readMeta(vaultPath)])
  const slugs = Object.keys(store).sort()
  return Response.json({ slugs, meta })
}
