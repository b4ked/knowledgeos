import type { VaultAdapter } from '../vault/VaultAdapter'
import { parseLinks } from './parseLinks'
import type { GraphData, GraphEdge, GraphNode, NoteInput } from './parseLinks'

export interface GraphifyRunResult {
  graph: GraphData
  generatedAt: string
  source: 'graphify' | 'wikilinks'
  nodeCount: number
  edgeCount: number
}

export async function buildGraphifyOutputFromAdapter(adapter: VaultAdapter): Promise<GraphifyRunResult> {
  await adapter.ensureDirectories()
  const [wikiMeta, rawMeta] = await Promise.all([
    adapter.listNotes('wiki'),
    adapter.listNotes('raw'),
  ])
  const [wikiNotes, rawNotes] = await Promise.all([
    Promise.all(wikiMeta.map(async (note) => ({
      slug: note.slug,
      content: await adapter.readNote(note.path).catch(() => ''),
      type: 'wiki' as const,
    }))),
    Promise.all(rawMeta.map(async (note) => ({
      slug: note.slug,
      content: await adapter.readNote(note.path).catch(() => ''),
      type: 'raw' as const,
    }))),
  ])

  return buildGraphifyOutputFromNotes([...wikiNotes, ...rawNotes])
}

export function buildGraphifyOutputFromNotes(notes: NoteInput[]): GraphifyRunResult {
  // TODO: Replace this fallback with the external Graphify compiler output when
  // GRAPHIFY_COMMAND or the VPS /api/graphify/run implementation is available.
  const graph = parseLinks(notes)
  return normalizeGraphifyOutput({
    graph,
    generatedAt: new Date().toISOString(),
    source: 'wikilinks',
  })
}

export function normalizeGraphifyOutput(input: unknown): GraphifyRunResult {
  const candidate = input as Partial<GraphifyRunResult> & {
    nodes?: unknown
    edges?: unknown
    graph?: { nodes?: unknown; edges?: unknown }
  }

  const rawGraph = candidate.graph && Array.isArray(candidate.graph.nodes)
    ? candidate.graph
    : Array.isArray(candidate.nodes)
      ? candidate
      : { nodes: [], edges: [] }
  const graph = coerceGraphData(rawGraph)

  return {
    graph,
    generatedAt: typeof candidate.generatedAt === 'string' ? candidate.generatedAt : new Date().toISOString(),
    source: candidate.source === 'graphify' ? 'graphify' : 'wikilinks',
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
  }
}

function coerceGraphData(rawGraph: { nodes?: unknown; edges?: unknown; links?: unknown }): GraphData {
  const rawNodes = Array.isArray(rawGraph.nodes) ? rawGraph.nodes as Array<Record<string, unknown>> : []
  const nodes: GraphNode[] = rawNodes
    .map((node) => ({
      id: String(node.id ?? node.label ?? ''),
      label: String(node.label ?? node.id ?? ''),
      type: coerceNodeType(node.type ?? node.file_type),
    }))
    .filter((node) => node.id && node.label)
  const nodeIds = new Set(nodes.map((node) => node.id))
  const rawEdges = Array.isArray(rawGraph.edges)
    ? rawGraph.edges
    : Array.isArray(rawGraph.links)
      ? rawGraph.links
      : []
  const edges: GraphEdge[] = (rawEdges as Array<Record<string, unknown>>)
    .map((edge) => ({
      source: String(edge.source ?? edge.from ?? ''),
      target: String(edge.target ?? edge.to ?? ''),
      label: String(edge.label ?? edge.relation ?? edge.type ?? 'related'),
    }))
    .filter((edge) => edge.source && edge.target && nodeIds.has(edge.source) && nodeIds.has(edge.target))
  return { nodes, edges }
}

function coerceNodeType(value: unknown): GraphNode['type'] {
  if (value === 'raw' || value === 'stub') return value
  return 'wiki'
}
