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
        nodes: [{ id: 'a', label: 'A', type: 'wiki' }],
        edges: [],
      },
    })

    expect(result.source).toBe('graphify')
    expect(result.nodeCount).toBe(1)
    expect(result.edgeCount).toBe(0)
  })
})

