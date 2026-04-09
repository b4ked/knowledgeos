export interface GraphNode {
  id: string          // slug used as unique key
  label: string       // display name
  type: 'wiki' | 'raw' | 'stub'
}

export interface GraphEdge {
  source: string      // node id
  target: string      // node id
  label: string       // original wikilink text (display name for the edge)
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface NoteInput {
  slug: string
  content: string
  type: 'wiki' | 'raw'
}

/** Convert a [[Wikilink]] text to a slug for node lookup */
export function wikilinkToSlug(link: string): string {
  return link
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

/** Extract all [[wikilink]] targets from a markdown string */
export function extractLinks(markdown: string): string[] {
  const matches = markdown.match(/\[\[([^\]]+)\]\]/g) ?? []
  return [...new Set(matches.map((m) => m.slice(2, -2).trim()))]
}

/**
 * Build a graph from a list of notes.
 *
 * - Each note becomes a node (type: 'wiki' | 'raw')
 * - Each [[wikilink]] in a note body becomes an edge to a target node
 * - If the target has no matching note, a stub node is created
 * - Edges are deduplicated
 */
export function parseLinks(notes: NoteInput[]): GraphData {
  // Build a lookup: slug → node type, to resolve wikilinks
  const slugMap = new Map<string, 'wiki' | 'raw'>()
  for (const note of notes) {
    slugMap.set(note.slug, note.type)
    // Also index by the wikilink-slug form in case note slugs contain mixed casing
    slugMap.set(wikilinkToSlug(note.slug), note.type)
  }

  const nodes: GraphNode[] = notes.map((n) => ({
    id: n.slug,
    label: n.slug.split('/').pop() ?? n.slug,
    type: n.type,
  }))

  const stubIds = new Set<string>()
  const edgeKeys = new Set<string>()
  const edges: GraphEdge[] = []

  for (const note of notes) {
    const links = extractLinks(note.content)
    for (const link of links) {
      const targetSlug = wikilinkToSlug(link)
      const edgeKey = `${note.slug}→${targetSlug}`

      if (edgeKeys.has(edgeKey)) continue
      edgeKeys.add(edgeKey)
      edges.push({ source: note.slug, target: targetSlug, label: link })

      // If target has no matching note, register as stub
      if (!slugMap.has(targetSlug) && !stubIds.has(targetSlug)) {
        stubIds.add(targetSlug)
        nodes.push({ id: targetSlug, label: link, type: 'stub' })
      }
    }
  }

  return { nodes, edges }
}
