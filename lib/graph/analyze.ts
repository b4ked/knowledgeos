import type { GraphData, GraphNode } from './parseLinks'

export interface NodeDegree {
  slug: string
  label: string
  inDegree: number
  outDegree: number
  totalDegree: number
}

export interface Cluster {
  id: number
  slugs: string[]
  labels: string[]
  size: number
}

export interface GraphInsights {
  /** Top N most-connected wiki/raw notes (by in+out degree) */
  hubs: NodeDegree[]
  /** Wiki/raw notes with zero connections */
  orphans: GraphNode[]
  /** Referenced but not yet created notes */
  stubs: GraphNode[]
  /** Notes that act as bridges between clusters (high betweenness proxies) */
  bridges: NodeDegree[]
  /** Connected components of wiki/raw nodes */
  clusters: Cluster[]
  /** Degree list for all wiki/raw nodes, sorted descending */
  allDegrees: NodeDegree[]
  /** Summary stats */
  stats: {
    totalNotes: number
    totalEdges: number
    totalStubs: number
    orphanCount: number
    clusterCount: number
    avgDegree: number
    maxDegree: number
  }
}

/**
 * Compute structural graph insights from a GraphData object.
 * Does not require embeddings — pure graph analysis.
 */
export function analyzeGraph(graph: GraphData): GraphInsights {
  const realNodes = graph.nodes.filter((n) => n.type !== 'stub')
  const stubNodes = graph.nodes.filter((n) => n.type === 'stub')

  // Build adjacency maps
  const outEdges = new Map<string, Set<string>>()
  const inEdges = new Map<string, Set<string>>()
  for (const n of realNodes) {
    outEdges.set(n.id, new Set())
    inEdges.set(n.id, new Set())
  }

  for (const edge of graph.edges) {
    // Only track edges where source is a real node
    const srcOut = outEdges.get(edge.source)
    if (srcOut) srcOut.add(edge.target)

    const tgtIn = inEdges.get(edge.target)
    if (tgtIn) tgtIn.add(edge.source)
  }

  // Compute degrees
  const degrees: NodeDegree[] = realNodes.map((n) => {
    const out = outEdges.get(n.id)?.size ?? 0
    const inn = inEdges.get(n.id)?.size ?? 0
    return { slug: n.id, label: n.label, inDegree: inn, outDegree: out, totalDegree: inn + out }
  })
  degrees.sort((a, b) => b.totalDegree - a.totalDegree)

  const totalDegree = degrees.reduce((s, d) => s + d.totalDegree, 0)
  const avgDegree = degrees.length > 0 ? totalDegree / degrees.length : 0
  const maxDegree = degrees.length > 0 ? degrees[0].totalDegree : 0

  // Hubs: top 10 most connected real nodes
  const hubs = degrees.slice(0, 10).filter((d) => d.totalDegree > 0)

  // Orphans: real nodes with no connections at all
  const orphanSlugs = new Set(degrees.filter((d) => d.totalDegree === 0).map((d) => d.slug))
  const orphans = realNodes.filter((n) => orphanSlugs.has(n.id))

  // Connected components (BFS over undirected adjacency)
  const visited = new Set<string>()
  const clusters: Cluster[] = []
  let clusterId = 0

  // Build undirected adjacency for real nodes only
  const undirected = new Map<string, Set<string>>()
  for (const n of realNodes) undirected.set(n.id, new Set())
  for (const edge of graph.edges) {
    const u = undirected.get(edge.source)
    const v = undirected.get(edge.target)
    if (u && v) {
      u.add(edge.target)
      v.add(edge.source)
    } else if (u && !v) {
      // edge to stub — still valid for undirected but stub not in realNodes
      // skip — clusters are over real nodes only
    }
  }

  for (const n of realNodes) {
    if (visited.has(n.id)) continue
    const queue: string[] = [n.id]
    const component: string[] = []
    while (queue.length > 0) {
      const cur = queue.pop()!
      if (visited.has(cur)) continue
      visited.add(cur)
      component.push(cur)
      for (const nb of undirected.get(cur) ?? []) {
        if (!visited.has(nb)) queue.push(nb)
      }
    }
    const clusterNodes = realNodes.filter((x) => component.includes(x.id))
    clusters.push({
      id: clusterId++,
      slugs: component,
      labels: clusterNodes.map((x) => x.label),
      size: component.length,
    })
  }
  clusters.sort((a, b) => b.size - a.size)

  // Bridges: proxy via betweenness — nodes that have connections to multiple different clusters
  // Simple heuristic: nodes that appear as the only connector between clusters
  // We use a simpler signal: nodes with high out-degree OR in-degree that straddle clusters
  // For the purposes of insights, we identify articulation points using Tarjan's algorithm
  const bridges = findBridgeNodes(realNodes.map((n) => n.id), undirected, degrees)

  return {
    hubs,
    orphans,
    stubs: stubNodes,
    bridges,
    clusters,
    allDegrees: degrees,
    stats: {
      totalNotes: realNodes.length,
      totalEdges: graph.edges.length,
      totalStubs: stubNodes.length,
      orphanCount: orphans.length,
      clusterCount: clusters.length,
      avgDegree: Math.round(avgDegree * 10) / 10,
      maxDegree,
    },
  }
}

/**
 * Find articulation points (bridge nodes) using DFS.
 * Returns the top N bridge nodes sorted by degree (most connected first).
 */
function findBridgeNodes(
  nodeIds: string[],
  adj: Map<string, Set<string>>,
  degrees: NodeDegree[]
): NodeDegree[] {
  if (nodeIds.length === 0) return []

  const visited = new Map<string, number>()
  const low = new Map<string, number>()
  const parent = new Map<string, string | null>()
  const articulationPoints = new Set<string>()
  let timer = 0

  function dfs(u: string) {
    visited.set(u, timer)
    low.set(u, timer)
    timer++
    let childCount = 0

    for (const v of adj.get(u) ?? []) {
      if (!visited.has(v)) {
        childCount++
        parent.set(v, u)
        dfs(v)
        const lowV = low.get(v) ?? Infinity
        const lowU = low.get(u) ?? Infinity
        low.set(u, Math.min(lowU, lowV))

        const visU = visited.get(u) ?? Infinity
        // Articulation point conditions
        if (parent.get(u) === null && childCount > 1) {
          articulationPoints.add(u)
        }
        if (parent.get(u) !== null && lowV >= visU) {
          articulationPoints.add(u)
        }
      } else if (v !== parent.get(u)) {
        const lowU = low.get(u) ?? Infinity
        const visV = visited.get(v) ?? Infinity
        low.set(u, Math.min(lowU, visV))
      }
    }
  }

  for (const id of nodeIds) {
    if (!visited.has(id)) {
      parent.set(id, null)
      dfs(id)
    }
  }

  const degreeMap = new Map(degrees.map((d) => [d.slug, d]))
  return Array.from(articulationPoints)
    .map((id) => degreeMap.get(id))
    .filter((d): d is NodeDegree => d !== undefined)
    .sort((a, b) => b.totalDegree - a.totalDegree)
    .slice(0, 10)
}
