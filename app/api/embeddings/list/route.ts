import path from 'path'
import { readStore, readMeta } from '@/lib/embeddings/store'
import { getVpsConfig, proxyToVps } from '@/lib/vpsProxy'

function getVaultPath() {
  return process.env.VAULT_PATH ? path.resolve(process.env.VAULT_PATH) : path.resolve('./vault')
}

export async function GET() {
  if (getVpsConfig()) return proxyToVps('/api/embeddings/list', 'GET')
  const vaultPath = getVaultPath()
  const [store, meta] = await Promise.all([readStore(vaultPath), readMeta(vaultPath)])
  const slugs = Object.keys(store).sort()
  return Response.json({ slugs, meta })
}
