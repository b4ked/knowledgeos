import fs from 'fs/promises'
import path from 'path'
import { LocalVaultAdapter } from '@/lib/vault/LocalVaultAdapter'
import { getLLMProvider } from '@/lib/llm/getLLMProvider'
import { DEFAULT_CONVENTIONS } from '@/lib/conventions/defaults'
import type { Conventions } from '@/lib/conventions/types'

export interface CompileResult {
  outputPath: string   // e.g. 'wiki/my-note-compiled.md'
  slug: string         // e.g. 'my-note-compiled'
  wikilinks: string[]  // unique [[wikilinks]] extracted from output
}

export async function compile(
  notePaths: string[],
  outputFilename: string | undefined,
  vaultPath: string,
  conventions: Partial<Conventions> = {}
): Promise<CompileResult> {
  const merged = { ...DEFAULT_CONVENTIONS, ...conventions }
  const adapter = new LocalVaultAdapter(vaultPath)

  // Load source notes
  const sources = await Promise.all(notePaths.map((p) => adapter.readNote(p)))

  // Compile via LLM
  const llm = getLLMProvider(merged)
  const output = await llm.compile(sources, merged)

  // Extract wikilinks from output
  const wikilinks = extractWikilinks(output)

  // Determine output slug/path
  const slug = outputFilename
    ? outputFilename.replace(/\.md$/, '')
    : generateSlug(notePaths)
  const outputPath = `wiki/${slug}.md`

  // Write compiled note
  await adapter.writeNote(outputPath, output)

  // Update vault/index.md
  await updateIndex(vaultPath, wikilinks)

  return { outputPath, slug, wikilinks }
}

export function extractWikilinks(markdown: string): string[] {
  const matches = markdown.match(/\[\[([^\]]+)\]\]/g) ?? []
  return [...new Set(matches.map((m) => m.slice(2, -2)))]
}

function generateSlug(notePaths: string[]): string {
  const base = path.basename(notePaths[0], '.md').replace(/^(raw|wiki)\//, '')
  if (notePaths.length === 1) {
    return base
  }
  const second = path.basename(notePaths[1], '.md').replace(/^(raw|wiki)\//, '')
  return `${base}+${second}`
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
