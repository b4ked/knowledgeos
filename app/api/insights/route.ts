import { auth } from '@/auth'
import { getAdapter } from '@/lib/vault/getAdapter'
import { parseLinks } from '@/lib/graph/parseLinks'
import { analyzeGraph } from '@/lib/graph/analyze'
import { listUserEmbeddings } from '@/lib/rag/cloudStore'
import { getLLMProvider } from '@/lib/llm/getLLMProvider'
import { graphAwareRetrieveFromCloud } from '@/lib/rag/graphAwareRetrieve'
import { getVpsConfig, proxyToVps } from '@/lib/vpsProxy'
import type { NoteInput } from '@/lib/graph/parseLinks'

/**
 * GET /api/insights
 *
 * Returns structural graph insights and optionally semantic cluster data.
 * Query params:
 *   - mode: 'graph' (default) | 'semantic' — semantic requires embeddings
 *   - query: string — if provided, returns graph-aware retrieval results for that query
 */
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id && getVpsConfig()) return proxyToVps('/api/insights', 'GET')

  const url = new URL(request.url)
  const mode = url.searchParams.get('mode') ?? 'graph'
  const query = url.searchParams.get('query') ?? ''

  try {
    const adapter = await getAdapter(session?.user?.id ?? undefined)
    await adapter.ensureDirectories()

    // Build graph data
    const [wikiMeta, rawMeta] = await Promise.all([
      adapter.listNotes('wiki'),
      adapter.listNotes('raw'),
    ])

    const [wikiNotes, rawNotes] = await Promise.all([
      Promise.all(
        wikiMeta.map(async (m): Promise<NoteInput> => ({
          slug: m.slug,
          content: await adapter.readNote(m.path).catch(() => ''),
          type: 'wiki' as const,
        }))
      ),
      Promise.all(
        rawMeta.map(async (m): Promise<NoteInput> => ({
          slug: m.slug,
          content: await adapter.readNote(m.path).catch(() => ''),
          type: 'raw' as const,
        }))
      ),
    ])

    const graphData = parseLinks([...wikiNotes, ...rawNotes])
    const insights = analyzeGraph(graphData)

    // If a query is provided, also return graph-aware retrieval
    let graphAwareResults = null
    if (query.trim() && session?.user?.id) {
      try {
        const embeddings = await listUserEmbeddings(session.user.id, 'wiki')
        if (embeddings.length > 0) {
          const llm = getLLMProvider()
          const questionEmbedding = await llm.embed(query.trim())
          graphAwareResults = graphAwareRetrieveFromCloud(questionEmbedding, embeddings, graphData, {
            topK: 8,
            semanticWeight: 0.7,
          })
        }
      } catch (err) {
        console.warn('insights: graph-aware retrieval failed (non-fatal):', err)
      }
    }

    // Semantic cluster data: pairwise similarity matrix for top notes (if mode=semantic)
    let semanticClusters = null
    if (mode === 'semantic' && session?.user?.id) {
      try {
        const embeddings = await listUserEmbeddings(session.user.id, 'wiki')
        semanticClusters = computeSemanticClusters(embeddings)
      } catch (err) {
        console.warn('insights: semantic clustering failed (non-fatal):', err)
      }
    }

    return Response.json({
      insights,
      graphData: { nodeCount: graphData.nodes.length, edgeCount: graphData.edges.length },
      graphAwareResults,
      semanticClusters,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to compute insights'
    return Response.json({ error: message }, { status: 500 })
  }
}

interface EmbeddingEntry {
  slug: string
  embedding: number[]
}

interface SemanticCluster {
  id: number
  slugs: string[]
  centroid?: string
}

/**
 * Simple k-means-like semantic clustering using cosine similarity.
 * Groups semantically similar notes into clusters.
 */
function computeSemanticClusters(embeddings: EmbeddingEntry[]): SemanticCluster[] {
  if (embeddings.length < 2) return []

  // Build pairwise similarity for up to 50 notes (performance cap)
  const sample = embeddings.slice(0, 50)

  // Single-linkage agglomerative clustering with threshold
  const THRESHOLD = 0.65
  const clusterOf = new Map<string, number>()
  let nextCluster = 0

  for (let i = 0; i < sample.length; i++) {
    const a = sample[i]
    if (clusterOf.has(a.slug)) continue

    const clusterId = nextCluster++
    clusterOf.set(a.slug, clusterId)

    for (let j = i + 1; j < sample.length; j++) {
      const b = sample[j]
      if (clusterOf.has(b.slug)) continue
      try {
        const sim = cosineSim(a.embedding, b.embedding)
        if (sim >= THRESHOLD) {
          clusterOf.set(b.slug, clusterId)
        }
      } catch {
        // Dimension mismatch — skip
      }
    }
  }

  // Group into clusters
  const clusterMap = new Map<number, string[]>()
  for (const [slug, id] of clusterOf) {
    if (!clusterMap.has(id)) clusterMap.set(id, [])
    clusterMap.get(id)!.push(slug)
  }

  return Array.from(clusterMap.entries())
    .map(([id, slugs]) => ({ id, slugs, centroid: slugs[0] }))
    .filter((c) => c.slugs.length >= 2)
    .sort((a, b) => b.slugs.length - a.slugs.length)
}

function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('dimension mismatch')
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const mag = Math.sqrt(magA) * Math.sqrt(magB)
  return mag === 0 ? 0 : dot / mag
}
