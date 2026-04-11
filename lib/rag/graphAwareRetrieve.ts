import { cosineSimilarity } from '@/lib/embeddings/cosine'
import type { GraphData } from '@/lib/graph/parseLinks'
import type { CloudEmbeddingRecord } from '@/lib/rag/cloudStore'

export interface GraphAwareResult {
  slug: string
  semanticScore: number
  structuralScore: number
  combinedScore: number
  isGraphExpanded: boolean
}

interface EmbeddingEntry {
  slug: string
  embedding: number[]
}

/**
 * Graph-aware retrieval: combines semantic similarity with structural graph signals.
 *
 * Algorithm:
 * 1. Rank all notes by cosine similarity to the question embedding
 * 2. Take top-K semantic hits as "seed" nodes
 * 3. Expand each seed via 1-hop graph neighbors (notes linked to/from the seed)
 * 4. Compute structural score based on hub-ness (total degree) of each note
 * 5. Re-rank candidates using: combined = semanticScore * 0.7 + hubScore * 0.3
 * 6. Return top-K final results
 */
export function graphAwareRetrieve(
  questionEmbedding: number[],
  embeddings: EmbeddingEntry[],
  graph: GraphData,
  options: { topK?: number; semanticWeight?: number; minScore?: number } = {}
): GraphAwareResult[] {
  const { topK = 5, semanticWeight = 0.7, minScore = 0.05 } = options
  const structuralWeight = 1 - semanticWeight

  if (embeddings.length === 0) return []

  // Build embedding lookup
  const embeddingMap = new Map<string, number[]>()
  for (const e of embeddings) embeddingMap.set(e.slug, e.embedding)

  // Build adjacency for 1-hop expansion (undirected)
  const neighbors = new Map<string, Set<string>>()
  for (const e of embeddings) neighbors.set(e.slug, new Set())
  for (const edge of graph.edges) {
    const srcNeighbors = neighbors.get(edge.source)
    if (srcNeighbors) srcNeighbors.add(edge.target)
    const tgtNeighbors = neighbors.get(edge.target)
    if (tgtNeighbors) tgtNeighbors.add(edge.source)
  }

  // Compute degree for each note (used as hub score)
  const degreeMap = new Map<string, number>()
  for (const node of graph.nodes) {
    if (node.type !== 'stub') degreeMap.set(node.id, 0)
  }
  for (const edge of graph.edges) {
    if (degreeMap.has(edge.source)) degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1)
    if (degreeMap.has(edge.target)) degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1)
  }
  const maxDegree = Math.max(1, ...Array.from(degreeMap.values()))

  // Step 1: semantic similarity for all notes
  const semanticScores = new Map<string, number>()
  for (const e of embeddings) {
    try {
      semanticScores.set(e.slug, cosineSimilarity(questionEmbedding, e.embedding))
    } catch {
      semanticScores.set(e.slug, 0)
    }
  }

  // Step 2: find top-K semantic seeds (expanded pool = 2x topK)
  const seedPool = Array.from(semanticScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK * 2)
    .map(([slug]) => slug)

  // Step 3: expand candidates via 1-hop neighbors
  const candidateSlugs = new Set<string>(seedPool)
  for (const seed of seedPool) {
    for (const neighbor of neighbors.get(seed) ?? []) {
      if (embeddingMap.has(neighbor)) candidateSlugs.add(neighbor)
    }
  }

  // Step 4 & 5: score all candidates and rank
  const results: GraphAwareResult[] = []
  for (const slug of candidateSlugs) {
    const semanticScore = semanticScores.get(slug) ?? 0
    const degree = degreeMap.get(slug) ?? 0
    const structuralScore = degree / maxDegree
    const combinedScore = semanticScore * semanticWeight + structuralScore * structuralWeight
    const isGraphExpanded = !seedPool.includes(slug)
    results.push({ slug, semanticScore, structuralScore, combinedScore, isGraphExpanded })
  }

  return results
    .filter((r) => r.combinedScore >= minScore)
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, topK)
}

/**
 * Convenience wrapper that accepts CloudEmbeddingRecord[] (the cloud store format).
 */
export function graphAwareRetrieveFromCloud(
  questionEmbedding: number[],
  cloudEmbeddings: CloudEmbeddingRecord[],
  graph: GraphData,
  options?: { topK?: number; semanticWeight?: number; minScore?: number }
): GraphAwareResult[] {
  return graphAwareRetrieve(
    questionEmbedding,
    cloudEmbeddings.map((e) => ({ slug: e.slug, embedding: e.embedding })),
    graph,
    options
  )
}
