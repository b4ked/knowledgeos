import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

// Mock getLLMProvider — must be declared before imports
const mockLLMCompile = vi.fn()
vi.mock('@/lib/llm/getLLMProvider', () => ({
  getLLMProvider: vi.fn(() => ({
    compile: mockLLMCompile,
    query: vi.fn(),
    embed: vi.fn(),
  })),
}))

import { compile, extractWikilinks } from '@/lib/compiler/compile'

describe('extractWikilinks', () => {
  it('correctly extracts [[wikilinks]] from markdown', () => {
    const md = '## Overview\n\n[[Strategy]] and [[Execution]] drive [[Outcome]].'
    expect(extractWikilinks(md).sort()).toEqual(['Execution', 'Outcome', 'Strategy'])
  })

  it('deduplicates repeated wikilinks', () => {
    const md = '[[Concept]] is related to [[Concept]] and [[Other]].'
    expect(extractWikilinks(md)).toHaveLength(2)
  })

  it('returns empty array for markdown with no wikilinks', () => {
    expect(extractWikilinks('# Just a heading\n\nPlain text.')).toEqual([])
  })
})

describe('compile()', () => {
  let vaultPath: string

  beforeEach(async () => {
    vaultPath = path.join(os.tmpdir(), crypto.randomUUID())
    await fs.mkdir(path.join(vaultPath, 'raw'), { recursive: true })
    await fs.mkdir(path.join(vaultPath, 'wiki'), { recursive: true })
    mockLLMCompile.mockReset()
  })

  afterEach(async () => {
    await fs.rm(vaultPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('builds correct prompt from sources + conventions and writes compiled note', async () => {
    await fs.writeFile(
      path.join(vaultPath, 'raw', 'topic-a.md'),
      '# Topic A\n\nSome source content.',
      'utf-8'
    )
    mockLLMCompile.mockResolvedValueOnce(
      '## Overview\n\n[[Strategy]] meets [[Execution]].\n\n## Key Concepts\n\n- [[Strategy]]\n- [[Execution]]'
    )

    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')
    vi.stubEnv('LLM_PROVIDER', 'anthropic')

    const result = await compile(['raw/topic-a.md'], undefined, vaultPath, {})

    // LLM was called with the source content
    expect(mockLLMCompile).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('Some source content')]),
      expect.any(Object)
    )

    // Output file written to wiki/
    const onDisk = await fs.readFile(path.join(vaultPath, 'wiki', `${result.slug}.md`), 'utf-8')
    expect(onDisk).toContain('## Overview')
  })

  it('parses [[wikilinks]] from LLM output correctly', async () => {
    await fs.writeFile(path.join(vaultPath, 'raw', 'note.md'), 'content', 'utf-8')
    mockLLMCompile.mockResolvedValueOnce('[[Alpha]] and [[Beta]] and [[Alpha]] again.')

    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')

    const result = await compile(['raw/note.md'], undefined, vaultPath, {})

    expect(result.wikilinks.sort()).toEqual(['Alpha', 'Beta'])
  })

  it('writes compiled note to wiki/ folder', async () => {
    await fs.writeFile(path.join(vaultPath, 'raw', 'source.md'), 'source', 'utf-8')
    mockLLMCompile.mockResolvedValueOnce('# Compiled\n\n[[Link]]')

    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')

    const result = await compile(['raw/source.md'], 'my-output', vaultPath, {})

    expect(result.slug).toBe('my-output')
    const exists = await fs
      .stat(path.join(vaultPath, 'wiki', 'my-output.md'))
      .then(() => true)
      .catch(() => false)
    expect(exists).toBe(true)
  })

  it('updates index.md with new concepts (no duplicates)', async () => {
    await fs.writeFile(path.join(vaultPath, 'raw', 'n.md'), 'n', 'utf-8')
    // Pre-seed index with one concept
    await fs.writeFile(
      path.join(vaultPath, 'index.md'),
      '# Knowledge Index\n\n- [[Existing]]\n',
      'utf-8'
    )
    mockLLMCompile.mockResolvedValueOnce('[[Existing]] [[NewConcept]]')

    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')

    await compile(['raw/n.md'], undefined, vaultPath, {})

    const index = await fs.readFile(path.join(vaultPath, 'index.md'), 'utf-8')
    // [[Existing]] should not be duplicated
    const matches = index.match(/\[\[Existing\]\]/g) ?? []
    expect(matches).toHaveLength(1)
    // [[NewConcept]] should be added
    expect(index).toContain('[[NewConcept]]')
  })

  it('handles LLM API error gracefully', async () => {
    await fs.writeFile(path.join(vaultPath, 'raw', 'err.md'), 'content', 'utf-8')
    mockLLMCompile.mockRejectedValueOnce(new Error('API error'))

    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')

    await expect(compile(['raw/err.md'], undefined, vaultPath, {})).rejects.toThrow('API error')
  })
})
