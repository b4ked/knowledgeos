import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import TurndownService from 'turndown'
import { getAdapter, getServerVaultMode } from '@/lib/vault/getAdapter'
import { auth } from '@/auth'

type ClipBody = {
  url?: string
  html?: string
  text?: string
  filename?: string
  save?: boolean
}

export const maxDuration = 60

export async function POST(request: Request) {
  const body = await request.json() as ClipBody
  const save = body.save !== false

  try {
    const clipped = await buildClip(body)
    if (!clipped.content.trim()) {
      return Response.json({ error: 'No content found to clip' }, { status: 400 })
    }

    const slug = slugify(body.filename || clipped.title || 'clipped-note')
    const filename = `${slug}.md`
    const notePath = `raw/${filename}` as const

    if (!save) {
      return Response.json({
        slug,
        filename,
        path: notePath,
        content: clipped.content,
      })
    }

    const session = await auth()
    const vaultMode = await getServerVaultMode(session?.user?.id)
    const adapter = await getAdapter(vaultMode === 'cloud' ? session?.user?.id : undefined)
    await adapter.ensureDirectories()
    await adapter.writeNote(notePath, clipped.content)
    const notes = await adapter.listNotes('raw')
    const created = notes.find((note) => note.slug === slug)

    if (!created) {
      return Response.json({ error: 'Clip saved but metadata was not found' }, { status: 500 })
    }

    return Response.json(created, { status: 201 })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Clip failed' }, { status: 500 })
  }
}

async function buildClip(body: ClipBody): Promise<{ title: string; content: string }> {
  if (body.url) {
    const response = await fetch(body.url, {
      headers: {
        'User-Agent': 'KnowledgeOS clipper',
        Accept: 'text/html, text/plain;q=0.9, */*;q=0.8',
      },
    })
    if (!response.ok) throw new Error(`Could not fetch URL (${response.status})`)
    const html = await response.text()
    return htmlToMarkdown(html, body.url)
  }

  if (body.html) return htmlToMarkdown(body.html)
  if (body.text) {
    const title = body.filename || firstLine(body.text) || 'Pasted content'
    return { title, content: `# ${title}\n\n${body.text.trim()}\n` }
  }

  throw new Error('Provide url, html, or text')
}

function htmlToMarkdown(html: string, sourceUrl?: string): { title: string; content: string } {
  const dom = new JSDOM(html, sourceUrl ? { url: sourceUrl } : undefined)
  const readable = new Readability(dom.window.document).parse()
  const title = readable?.title || dom.window.document.title || 'Clipped page'
  const sourceHtml = readable?.content || dom.window.document.body?.innerHTML || html
  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
  const markdown = turndown.turndown(sourceHtml).trim()
  const sourceLine = sourceUrl ? `\n\nSource: ${sourceUrl}` : ''
  return { title, content: `# ${title}${sourceLine}\n\n${markdown}\n` }
}

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/\.md$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'clipped-note'
}

function firstLine(text: string): string | null {
  return text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null
}

