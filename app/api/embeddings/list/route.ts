import path from 'path'
import { auth } from '@/auth'
import { readStore, readMeta } from '@/lib/embeddings/store'
import { listUserEmbeddings, readUserEmbeddingMeta } from '@/lib/rag/cloudStore'
import { getVpsConfig, proxyToVps } from '@/lib/vpsProxy'
import type { NoteFolder } from '@/lib/vault/VaultAdapter'

function getVaultPath() {
  return process.env.VAULT_PATH ? path.resolve(process.env.VAULT_PATH) : path.resolve('./vault')
}

export async function GET(request: Request) {
  const folderParam = new URL(request.url).searchParams.get('folder')
  const folder = folderParam === 'raw' || folderParam === 'wiki' ? folderParam : undefined
  const session = await auth()

  if (session?.user?.id) {
    const [entries, meta] = await Promise.all([
      listUserEmbeddings(session.user.id, folder as NoteFolder | undefined),
      readUserEmbeddingMeta(session.user.id, folder as NoteFolder | undefined),
    ])
    const slugs = entries.map((entry) => entry.slug).sort()
    return Response.json({ slugs, meta })
  }

  if (getVpsConfig()) return proxyToVps('/api/embeddings/list', 'GET')
  const vaultPath = getVaultPath()
  const [store, meta] = await Promise.all([readStore(vaultPath), readMeta(vaultPath)])
  const slugs = Object.keys(store).sort()
  return Response.json({ slugs, meta })
}
