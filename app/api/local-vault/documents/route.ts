import { getPGliteDbPath, PGliteKnowledgeStore } from '@/lib/knowledge/adapters/PGliteKnowledgeStore'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const workspaceId = url.searchParams.get('workspaceId')
  const vaultPath = url.searchParams.get('path')
  if (!workspaceId || !vaultPath) {
    return Response.json({ error: 'workspaceId and path are required' }, { status: 400 })
  }

  const store = new PGliteKnowledgeStore(getPGliteDbPath(vaultPath))
  try {
    await store.init()
    return Response.json(await store.listDocuments(workspaceId))
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Could not list documents' }, { status: 500 })
  } finally {
    await store.close()
  }
}

