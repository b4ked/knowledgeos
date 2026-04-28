import { describe, it, expect } from 'vitest'
import { parseLinks, extractLinks, wikilinkToSlug } from '@/lib/graph/parseLinks'
import type { NoteInput } from '@/lib/graph/parseLinks'

describe('wikilinkToSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(wikilinkToSlug('Knowledge Graph')).toBe('knowledge-graph')
  })

  it('strips special characters', () => {
    expect(wikilinkToSlug('Zettelkasten (Method)')).toBe('zettelkasten-method')
  })

  it('collapses whitespace', () => {
    expect(wikilinkToSlug('  spaced  out  ')).toBe('spaced-out')
  })
})

describe('extractLinks', () => {
  it('returns all wikilink targets from markdown', () => {
    const md = 'See [[Strategy]] and [[Execution]] for details.'
    expect(extractLinks(md).sort()).toEqual(['Execution', 'Strategy'])
  })

  it('deduplicates repeated links', () => {
    const md = '[[Alpha]] then [[Alpha]] again.'
    expect(extractLinks(md)).toHaveLength(1)
  })

  it('returns empty array for markdown with no wikilinks', () => {
    expect(extractLinks('# Just text\n\nNo links here.')).toEqual([])
  })
})

describe('parseLinks', () => {
  it('returns correct node/edge structure', () => {
    const notes: NoteInput[] = [
      { slug: 'strategy', content: '# Strategy\n\n[[Execution]] drives results.', type: 'wiki' },
      { slug: 'execution', content: '# Execution\n\nSee [[Strategy]] for context.', type: 'wiki' },
    ]

    const { nodes, edges } = parseLinks(notes)

    const nodeIds = nodes.map((n) => n.id).sort()
    expect(nodeIds).toEqual(['execution', 'strategy'])

    expect(edges).toHaveLength(2)
    expect(edges).toContainEqual({ source: 'strategy', target: 'execution', label: 'Execution' })
    expect(edges).toContainEqual({ source: 'execution', target: 'strategy', label: 'Strategy' })
  })

  it('identifies stub nodes (linked but no matching file)', () => {
    // [[existing-note]] normalizes to 'existing-note' → matches the note slug
    // [[unknown-concept]] normalizes to 'unknown-concept' → no match → stub
    const notes: NoteInput[] = [
      { slug: 'note-a', content: '[[existing-note]] and [[unknown-concept]]', type: 'wiki' },
      { slug: 'existing-note', content: 'I exist.', type: 'wiki' },
    ]

    const { nodes } = parseLinks(notes)

    const stubs = nodes.filter((n) => n.type === 'stub')
    expect(stubs).toHaveLength(1)
    expect(stubs[0].id).toBe('unknown-concept')
  })

  it('handles notes with no wikilinks', () => {
    const notes: NoteInput[] = [
      { slug: 'isolated', content: '# Isolated\n\nNo links here.', type: 'wiki' },
    ]

    const { nodes, edges } = parseLinks(notes)

    expect(nodes).toHaveLength(1)
    expect(edges).toHaveLength(0)
  })

  it('handles circular links without infinite loop', () => {
    const notes: NoteInput[] = [
      { slug: 'a', content: '[[B]]', type: 'wiki' },
      { slug: 'b', content: '[[A]]', type: 'wiki' },
    ]

    // Should not throw or loop
    const { edges } = parseLinks(notes)
    expect(edges).toHaveLength(2)
  })

  it('deduplicates edges (same link used multiple times in one note)', () => {
    const notes: NoteInput[] = [
      { slug: 'note', content: '[[Target]] and again [[Target]].', type: 'wiki' },
      { slug: 'target', content: 'target content', type: 'wiki' },
    ]

    const { edges } = parseLinks(notes)
    expect(edges).toHaveLength(1)
  })

  it('marks raw notes with type raw', () => {
    const notes: NoteInput[] = [
      { slug: 'source', content: '[[Concept]]', type: 'raw' },
    ]

    const { nodes } = parseLinks(notes)
    expect(nodes.find((n) => n.id === 'source')?.type).toBe('raw')
  })
})
