import { describe, expect, it } from 'vitest'
import { buildGraphifyOutputFromNotes, normalizeGraphifyOutput } from '@/lib/graph/graphify'

describe('graphify output', () => {
  it('builds a displayable graph from notes', () => {
    const result = buildGraphifyOutputFromNotes([
      { slug: 'strategy', content: 'See [[Execution]]', type: 'wiki' },
      { slug: 'execution', content: 'Execution note', type: 'wiki' },
    ])

    expect(result.graph.nodes.map((node) => node.id).sort()).toEqual(['execution', 'strategy'])
    expect(result.graph.edges).toContainEqual({ source: 'strategy', target: 'execution', label: 'Execution' })
    expect(result.nodeCount).toBe(2)
    expect(result.edgeCount).toBe(1)
  })

  it('normalizes graphify-shaped output', () => {
    const result = normalizeGraphifyOutput({
      source: 'graphify',
      graph: {
        nodes: [{ id: 'a', label: 'A', file_type: 'document' }, { id: 'b', label: 'B', file_type: 'stub' }],
        links: [{ source: 'a', target: 'b', relation: 'wikilink' }],
      },
    })

    expect(result.source).toBe('graphify')
    expect(result.nodeCount).toBe(2)
    expect(result.edgeCount).toBe(1)
    expect(result.graph.nodes[0]).toMatchObject({ id: 'a', type: 'wiki' })
    expect(result.graph.nodes[1]).toMatchObject({ id: 'b', type: 'stub' })
    expect(result.graph.edges[0]).toMatchObject({ source: 'a', target: 'b', label: 'wikilink' })
  })
})
