import { getPGliteDbPath, PGliteKnowledgeStore } from '@/lib/knowledge/adapters/PGliteKnowledgeStore'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const workspaceId = url.searchParams.get('workspaceId')
  const vaultPath = url.searchParams.get('path')
  const query = url.searchParams.get('q')
  if (!workspaceId || !vaultPath || !query) {
    return Response.json({ error: 'workspaceId, path, and q are required' }, { status: 400 })
  }

  const store = new PGliteKnowledgeStore(getPGliteDbPath(vaultPath))
  try {
    await store.init()
    return Response.json(await store.searchChunks(workspaceId, query))
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Could not search chunks' }, { status: 500 })
  } finally {
    await store.close()
  }
}

