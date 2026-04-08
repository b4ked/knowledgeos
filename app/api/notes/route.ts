import path from 'path'
import { LocalVaultAdapter } from '@/lib/vault/LocalVaultAdapter'

function getAdapter() {
  const vaultPath = process.env.VAULT_PATH
    ? path.resolve(process.env.VAULT_PATH)
    : path.resolve('./vault')
  return new LocalVaultAdapter(vaultPath)
}

export async function GET(request: Request) {
  const folder = new URL(request.url).searchParams.get('folder') as 'raw' | 'wiki' | null
  if (folder !== 'raw' && folder !== 'wiki') {
    return Response.json({ error: 'folder must be raw or wiki' }, { status: 400 })
  }

  const adapter = getAdapter()
  await adapter.ensureDirectories()
  const notes = await adapter.listNotes(folder)
  return Response.json(notes)
}

export async function POST(request: Request) {
  const body = await request.json() as { folder?: string; filename?: string; content?: string }
  const { folder, filename, content } = body

  if (folder !== 'raw' && folder !== 'wiki') {
    return Response.json({ error: 'folder must be raw or wiki' }, { status: 400 })
  }
  if (!filename || typeof filename !== 'string') {
    return Response.json({ error: 'filename is required' }, { status: 400 })
  }
  if (typeof content !== 'string') {
    return Response.json({ error: 'content is required' }, { status: 400 })
  }

  const safeFilename = filename.endsWith('.md') ? filename : `${filename}.md`
  const notePath = `${folder}/${safeFilename}`

  const adapter = getAdapter()
  await adapter.ensureDirectories()
  await adapter.writeNote(notePath, content)

  const notes = await adapter.listNotes(folder as 'raw' | 'wiki')
  const created = notes.find((n) => n.filename === safeFilename)
  if (!created) {
    return Response.json({ error: 'Note created but metadata not found' }, { status: 500 })
  }

  return Response.json(created, { status: 201 })
}
