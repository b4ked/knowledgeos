import type { VaultAdapter } from '../vault/VaultAdapter'
import { parseLinks } from './parseLinks'
import type { GraphData, NoteInput } from './parseLinks'

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

  const graph = candidate.graph && Array.isArray(candidate.graph.nodes) && Array.isArray(candidate.graph.edges)
    ? candidate.graph as GraphData
    : Array.isArray(candidate.nodes) && Array.isArray(candidate.edges)
      ? { nodes: candidate.nodes, edges: candidate.edges } as GraphData
      : { nodes: [], edges: [] }

  return {
    graph,
    generatedAt: typeof candidate.generatedAt === 'string' ? candidate.generatedAt : new Date().toISOString(),
    source: candidate.source === 'graphify' ? 'graphify' : 'wikilinks',
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
  }
}
