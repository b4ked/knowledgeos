import path from 'path'
import { auth } from '@/auth'
import { compile } from '@/lib/compiler/compile'
import { readSettings } from '@/lib/vault/settings'
import { getAdapter, getServerVaultMode } from '@/lib/vault/getAdapter'
import type { Conventions } from '@/lib/conventions/types'
import { getVpsConfig, proxyToVps } from '@/lib/vpsProxy'
import { getLLMProvider } from '@/lib/llm/getLLMProvider'
import { DEFAULT_CONVENTIONS } from '@/lib/conventions/defaults'
import { extractWikilinks } from '@/lib/compiler/compile'
import { upsertUserEmbedding } from '@/lib/rag/cloudStore'
import { hashContent } from '@/lib/rag/hash'
import { checkAndIncrementUsage } from '@/lib/usage'
import { parseNoteFrontmatter, stringifyWithFrontmatter } from '@/lib/vault/frontmatter'
import { normalizeRuntimeAdminSettings } from '@/lib/admin/runtimeSettings'

export async function POST(request: Request) {
  const body = await request.json() as {
    notePaths?: string[]
    sources?: string[]
    outputFilename?: string
    conventions?: Partial<Conventions>
  }

  const { notePaths, sources: providedSources, outputFilename, conventions } = body

  if ((!Array.isArray(notePaths) || notePaths.length === 0) && (!Array.isArray(providedSources) || providedSources.length === 0)) {
    return Response.json({ error: 'notePaths or sources must be a non-empty array' }, { status: 400 })
  }

  const session = await auth()
  const userId = session?.user?.id ?? undefined
  const vaultMode = await getServerVaultMode(userId)
  const merged = { ...DEFAULT_CONVENTIONS, ...(conventions ?? {}) }
  const settings = await readSettings()
  const admin = normalizeRuntimeAdminSettings(settings)
  const llm = getLLMProvider(conventions ?? {}, {
    compileMaxTokens: admin.compileMaxOutputTokens,
    queryMaxTokens: admin.queryMaxOutputTokens,
  })

  if (Array.isArray(providedSources) && providedSources.length > 0) {
    if (userId) {
      try {
        const usage = await checkAndIncrementUsage(userId, 'compile')
        if (!usage.allowed) {
          return Response.json(
            { error: `Daily limit reached (${usage.used}/${usage.limit}). Upgrade your plan for unlimited access.` },
            { status: 429 }
          )
        }
      } catch (usageErr) {
        console.error('compile: usage check failed (non-fatal):', usageErr)
      }
    }
    try {
      const output = withCompiledFrontmatter(await llm.compile(providedSources, merged), merged)
      const wikilinks = extractWikilinks(output)
      const slug = outputFilename
        ? outputFilename.replace(/\.md$/, '')
        : generateSlugFromOutput(notePaths ?? ['raw/note.md'], output)
      const outputPath = `wiki/${slug}.md`
      return Response.json({ outputPath, slug, wikilinks, output }, { status: 200 })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Compilation failed'
      return Response.json({ error: message }, { status: 500 })
    }
  }

  // Cloud mode: use the database-backed adapter for authenticated users
  if (vaultMode === 'cloud' && userId) {
    try {
      const usage = await checkAndIncrementUsage(userId, 'compile')
      if (!usage.allowed) {
        return Response.json(
          { error: `Daily limit reached (${usage.used}/${usage.limit}). Upgrade your plan for unlimited access.` },
          { status: 429 }
        )
      }
    } catch (usageErr) {
      console.error('compile: usage check failed (non-fatal):', usageErr)
    }
    try {
      const adapter = await getAdapter(userId)

      // Read source notes from cloud adapter
      const sources = await Promise.all(notePaths!.map((p) => adapter.readNote(p)))
      const output = withCompiledFrontmatter(await llm.compile(sources, merged), merged)

      // Extract wikilinks from output
      const wikilinks = extractWikilinks(output)

      // Determine output slug/path
      const slug = outputFilename
        ? outputFilename.replace(/\.md$/, '')
        : generateSlugFromOutput(notePaths!, output)
      const outputPath = `wiki/${slug}.md`

      // Write compiled note back to cloud adapter
      await adapter.writeNote(outputPath, output)
      const provider = process.env.LLM_PROVIDER ?? 'anthropic'
      const model = provider === 'openai' ? 'text-embedding-3-small' : 'voyage-3-lite'
      try {
        await upsertUserEmbedding({
          userId,
          folder: 'wiki',
          slug,
          contentHash: hashContent(output),
          embedding: await llm.embed(output),
          provider,
          model,
        })
      } catch (embedErr) {
        console.error('compile: embedding upsert failed (non-fatal):', embedErr)
      }

      return Response.json({ outputPath, slug, wikilinks, output }, { status: 200 })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Compilation failed'
      return Response.json({ error: message }, { status: 500 })
    }
  }

  if (vaultMode === 'remote' && getVpsConfig()) return proxyToVps('/api/compile', 'POST', body)

  // Local/remote mode: use filesystem-based compile
  const vaultPath = process.env.VAULT_PATH
    ? path.resolve(process.env.VAULT_PATH)
    : path.resolve('./vault')

  const rawPath = settings.rawPath ? path.resolve(settings.rawPath) : undefined
  const wikiPath = settings.wikiPath ? path.resolve(settings.wikiPath) : undefined

  try {
    const result = await compile(
      notePaths!,
      outputFilename,
      vaultPath,
      conventions ?? {},
      rawPath,
      wikiPath,
      {
        compileMaxTokens: admin.compileMaxOutputTokens,
        queryMaxTokens: admin.queryMaxOutputTokens,
      },
    )
    return Response.json(result, { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Compilation failed'
    return Response.json({ error: message }, { status: 500 })
  }
}

function generateSlugFromOutput(notePaths: string[], output?: string): string {
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

function withCompiledFrontmatter(output: string, conventions: Partial<Conventions>): string {
  const parsed = parseNoteFrontmatter(output)
  return stringifyWithFrontmatter(
    {
      ...parsed.frontmatter,
      tags: [...parsed.frontmatter.tags, ...(conventions.tags ?? [])],
      date: parsed.frontmatter.date ?? new Date().toISOString().split('T')[0],
    },
    parsed.content,
  )
}
