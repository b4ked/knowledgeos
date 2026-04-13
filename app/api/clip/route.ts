import { auth } from '@/auth'
import { getAdapter, getServerVaultMode } from '@/lib/vault/getAdapter'
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import TurndownService from 'turndown'
import type { NoteMetadata } from '@/lib/vault/VaultAdapter'

interface ClipRequestBody {
  url?: string
  html?: string
  text?: string
  filename?: string
  save?: boolean
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

function filenameFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.replace(/\/$/, '').split('/').filter(Boolean)
    const last = parts[parts.length - 1] ?? parsed.hostname
    return slugify(last) || slugify(parsed.hostname)
  } catch {
    return 'clipped-page'
  }
}

export async function POST(request: Request) {
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id
  const vaultMode = await getServerVaultMode(userId)

  let body: ClipRequestBody
  try {
    body = await request.json() as ClipRequestBody
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { url, html: rawHtml, text, filename: customFilename, save = true } = body

  if (!url && !rawHtml && !text) {
    return Response.json({ error: 'Provide url, html, or text' }, { status: 400 })
  }

  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })

  let markdown = ''
  let title = ''
  let htmlSource = rawHtml

  // If URL provided, fetch the HTML
  if (url) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeOS/1.0)' },
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) {
        return Response.json(
          { error: `Failed to fetch URL: ${res.status} ${res.statusText}` },
          { status: 400 }
        )
      }
      htmlSource = await res.text()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown fetch error'
      return Response.json({ error: `URL fetch failed: ${msg}` }, { status: 400 })
    }
  }

  // Parse HTML with Readability if we have HTML
  if (htmlSource) {
    let dom: JSDOM
    try {
      dom = new JSDOM(htmlSource, { url: url ?? 'http://localhost' })
    } catch {
      return Response.json({ error: 'Failed to parse HTML' }, { status: 400 })
    }

    const article = new Readability(dom.window.document).parse()

    if (article?.content) {
      title = article.title ?? ''
      markdown = td.turndown(article.content)
    } else {
      // Fallback: convert full HTML
      try {
        markdown = td.turndown(htmlSource)
      } catch {
        markdown = htmlSource
      }
    }
  } else if (text) {
    // Plain text — use as-is
    markdown = text
  }

  // Build final content with frontmatter header
  const header = title
    ? `# ${title}\n\n${url ? `> Source: ${url}\n\n` : ''}`
    : url
    ? `> Source: ${url}\n\n`
    : ''

  const content = `${header}${markdown}`

  // Determine filename
  let slug: string
  if (customFilename) {
    slug = slugify(customFilename.replace(/\.md$/, '')) || 'clipped'
  } else if (title) {
    slug = slugify(title) || (url ? filenameFromUrl(url) : 'clipped')
  } else if (url) {
    slug = filenameFromUrl(url)
  } else {
    slug = `clip-${Date.now()}`
  }

  const filename = `${slug}-raw.md`
  const notePath = `raw/${filename}`

  if (!save) {
    return Response.json({
      slug,
      filename,
      path: notePath,
      content,
    }, { status: 200 })
  }

  try {
    const adapter = await getAdapter(vaultMode === 'cloud' ? userId : undefined)
    await adapter.ensureDirectories()
    await adapter.writeNote(notePath, content)

    const notes = await adapter.listNotes('raw')
    const created = notes.find((n: NoteMetadata) => n.filename === filename)

    if (!created) {
      // Build a synthetic metadata object since the note was written
      const syntheticMeta: NoteMetadata = {
        slug,
        filename,
        folder: 'raw',
        path: `raw/${filename}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      return Response.json(syntheticMeta, { status: 201 })
    }

    return Response.json(created, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: `Failed to save note: ${msg}` }, { status: 500 })
  }
}
