import fs from 'fs/promises'
import path from 'path'
import { LocalVaultAdapter } from '@/lib/vault/LocalVaultAdapter'
import { getLLMProvider } from '@/lib/llm/getLLMProvider'
import { DEFAULT_CONVENTIONS } from '@/lib/conventions/defaults'
import { upsertEmbedding, writeMeta } from '@/lib/embeddings/store'
import type { Conventions } from '@/lib/conventions/types'
import { parseNoteFrontmatter, stringifyWithFrontmatter } from '@/lib/vault/frontmatter'

export interface CompileResult {
  outputPath: string   // e.g. 'wiki/my-note-compiled.md'
  slug: string         // e.g. 'my-note-compiled'
  wikilinks: string[]  // unique [[wikilinks]] extracted from output
}

export async function compile(
  notePaths: string[],
  outputFilename: string | undefined,
  vaultPath: string,
  conventions: Partial<Conventions> = {},
  rawPath?: string,
  wikiPath?: string,
  llmRuntime?: { compileMaxTokens?: number; queryMaxTokens?: number },
): Promise<CompileResult> {
  // merged is used for buildSystemPrompt — defaults fill missing fields
  // getLLMProvider receives only user-supplied conventions so the LLM_PROVIDER
  // env var is not silently shadowed by DEFAULT_CONVENTIONS.provider
  const merged = { ...DEFAULT_CONVENTIONS, ...conventions }
  const adapter = new LocalVaultAdapter(vaultPath, rawPath, wikiPath)

  // Load source notes
  const sources = await Promise.all(notePaths.map((p) => adapter.readNote(p)))

  // Compile via LLM
  const llm = getLLMProvider(conventions, llmRuntime)
  const output = await llm.compile(sources, merged)
  const compiled = applyCompiledFrontmatter(output, merged)

  // Extract wikilinks from output
  const wikilinks = extractWikilinks(compiled)

  // Determine output slug/path
  const slug = outputFilename
    ? outputFilename.replace(/\.md$/, '')
    : generateSlug(notePaths, output)
  const outputPath = `wiki/${slug}.md`

  // Write compiled note
  await adapter.writeNote(outputPath, compiled)

  // Update vault/index.md
  await updateIndex(vaultPath, wikilinks)

  // Generate and store embedding (non-fatal — compile succeeds even if embed fails)
  try {
    const embedding = await llm.embed(compiled)
    await upsertEmbedding(vaultPath, slug, embedding)
    const provider = conventions.provider ?? process.env.LLM_PROVIDER ?? 'anthropic'
    const model = provider === 'openai' ? 'text-embedding-3-small' : 'voyage-3-lite'
    await writeMeta(vaultPath, { provider, model, updatedAt: new Date().toISOString() })
  } catch (err) {
    console.warn('[compile] Embedding skipped:', (err as Error).message)
  }

  return { outputPath, slug, wikilinks }
}

function applyCompiledFrontmatter(output: string, conventions: Partial<Conventions>): string {
  const parsed = parseNoteFrontmatter(output)
  const tags = [...parsed.frontmatter.tags, ...(conventions.tags ?? [])]
  return stringifyWithFrontmatter(
    {
      ...parsed.frontmatter,
      tags,
      date: parsed.frontmatter.date ?? new Date().toISOString().split('T')[0],
    },
    parsed.content,
  )
}

export function extractWikilinks(markdown: string): string[] {
  const matches = markdown.match(/\[\[([^\]]+)\]\]/g) ?? []
  return [...new Set(matches.map((m) => m.slice(2, -2)))]
}

function generateSlug(notePaths: string[], output?: string): string {
  const genericTitles = new Set([
    'overview',
    'executive_summary',
    'executive summary',
    'summary',
    'notes',
    'note',
    'document',
    'untitled',
    'introduction',
    'key_concepts',
    'key concepts',
    'connections',
    'socratic_review_questions',
    'socratic review questions',
  ])
  // Prefer deriving slug from the first heading in the compiled output
  if (output) {
    const headingMatches = output.matchAll(/^#{1,3}\s+(.+)$/gm)
    for (const headingMatch of headingMatches) {
      const slug = headingMatch[1]
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80)
      const wordCount = slug.split('_').filter(Boolean).length
      if (/^source_\d+/.test(slug) || wordCount > 8) continue
      if (slug && !genericTitles.has(slug)) return slug
    }
  }
  // Fall back to source filename
  const base = path.basename(notePaths[0], '.md')
    .replace(/[_-]?temp[_-]\d+/i, '')
    .replace(/(?:[_-]?raw)$/i, '')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '') || 'note'
  if (notePaths.length === 1) return base
  const second = path.basename(notePaths[1], '.md')
    .replace(/(?:[_-]?raw)$/i, '')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
  return `${base}_${second}`
}

async function updateIndex(vaultPath: string, wikilinks: string[]): Promise<void> {
  if (wikilinks.length === 0) return

  const indexPath = path.join(vaultPath, 'index.md')
  let existing = ''
  try {
    existing = await fs.readFile(indexPath, 'utf-8')
  } catch {
    existing = '# Knowledge Index\n\n'
  }

  const existingLinks = new Set(
    (existing.match(/\[\[([^\]]+)\]\]/g) ?? []).map((m) => m.slice(2, -2))
  )

  const newLinks = wikilinks.filter((l) => !existingLinks.has(l))
  if (newLinks.length === 0) return

  const addition = newLinks.map((l) => `- [[${l}]]`).join('\n')
  await fs.writeFile(indexPath, `${existing.trimEnd()}\n${addition}\n`, 'utf-8')
}
