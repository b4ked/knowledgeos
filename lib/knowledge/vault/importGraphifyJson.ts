import fs from 'fs/promises'
import type { KnowledgeStore } from '../adapters/KnowledgeStore'

type GraphifyNode = { id?: string; label?: string; name?: string; type?: string; metadata?: Record<string, unknown> }
type GraphifyEdge = { source?: string; target?: string; type?: string; metadata?: Record<string, unknown> }

export async function importGraphifyJson(
  pathToGraphJson: string,
  workspaceId: string,
  store: KnowledgeStore,
): Promise<{ nodesImported: number; edgesImported: number }> {
  const parsed = JSON.parse(await fs.readFile(pathToGraphJson, 'utf-8')) as {
    nodes?: GraphifyNode[]
    edges?: GraphifyEdge[]
  }
  const nodeIds = new Map<string, string>()
  let nodesImported = 0

  for (const node of parsed.nodes ?? []) {
    const externalId = node.id ?? node.label ?? node.name
    const label = node.label ?? node.name ?? externalId
    if (!externalId || !label) continue
    const stored = await store.upsertGraphNode({
      workspaceId,
      externalId,
      label,
      type: node.type ?? null,
      metadata: node.metadata ?? {},
    })
    nodeIds.set(externalId, stored.id)
    nodesImported++
  }

  let edgesImported = 0
  for (const edge of parsed.edges ?? []) {
    const sourceNodeId = edge.source ? nodeIds.get(edge.source) : undefined
    const targetNodeId = edge.target ? nodeIds.get(edge.target) : undefined
    if (!sourceNodeId || !targetNodeId) continue
    await store.upsertGraphEdge({
      workspaceId,
      sourceNodeId,
      targetNodeId,
      type: edge.type ?? 'related',
      metadata: edge.metadata ?? {},
    })
    edgesImported++
  }

  return { nodesImported, edgesImported }
}

