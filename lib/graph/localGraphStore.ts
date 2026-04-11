import type { BrowserVaultAdapter } from '@/lib/vault/BrowserVaultAdapter'
import type { GraphInsights } from '@/lib/graph/analyze'
import type { GraphData } from '@/lib/graph/parseLinks'

const GRAPH_INDEX_PATH = 'wiki/.graph-index.json'

export interface LocalGraphIndex {
  updatedAt: string
  insights: GraphInsights
}

export async function readLocalGraphIndex(adapter: BrowserVaultAdapter): Promise<LocalGraphIndex | null> {
  try {
    const raw = await adapter.readNote(GRAPH_INDEX_PATH)
    return JSON.parse(raw) as LocalGraphIndex
  } catch {
    return null
  }
}

export async function writeLocalGraphIndex(
  adapter: BrowserVaultAdapter,
  insights: GraphInsights,
): Promise<void> {
  const index: LocalGraphIndex = {
    updatedAt: new Date().toISOString(),
    insights,
  }
  await adapter.writeNote(GRAPH_INDEX_PATH, JSON.stringify(index))
}

/**
 * Compute and persist graph insights for a local vault.
 * Called after graph data is built from notes.
 */
export async function persistLocalGraphInsights(
  adapter: BrowserVaultAdapter,
  graphData: GraphData,
): Promise<GraphInsights> {
  const { analyzeGraph } = await import('@/lib/graph/analyze')
  const insights = analyzeGraph(graphData)
  await writeLocalGraphIndex(adapter, insights).catch(() => {
    // Non-fatal — insights still returned even if write fails
  })
  return insights
}
