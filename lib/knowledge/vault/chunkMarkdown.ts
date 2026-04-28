import { hashContent } from './hashContent'
import type { ChunkInput } from '../types/models'

type Section = {
  headingPath: string[]
  lines: string[]
}

const MAX_CHARS = 2400

export function chunkMarkdown(markdown: string, workspaceId: string): ChunkInput[] {
  const sections: Section[] = []
  const headingPath: string[] = []
  let current: Section = { headingPath: [], lines: [] }

  for (const line of markdown.split(/\r?\n/)) {
    const match = /^(#{1,3})\s+(.+?)\s*$/.exec(line)
    if (match) {
      if (current.lines.join('\n').trim()) sections.push(current)
      const level = match[1].length
      headingPath.splice(level - 1)
      headingPath[level - 1] = match[2].trim()
      current = { headingPath: headingPath.filter(Boolean), lines: [line] }
    } else {
      current.lines.push(line)
    }
  }

  if (current.lines.join('\n').trim()) sections.push(current)

  let chunkIndex = 0
  return sections.flatMap((section) =>
    splitSection(section).map((content) => ({
      workspaceId,
      chunkIndex: chunkIndex++,
      headingPath: section.headingPath.length ? section.headingPath : null,
      content,
      tokenEstimate: Math.ceil(content.length / 4),
      contentHash: hashContent(content),
    })),
  )
}

function splitSection(section: Section): string[] {
  const content = section.lines.join('\n').trim()
  if (content.length <= MAX_CHARS) return [content]

  const chunks: string[] = []
  let current = ''
  for (const paragraph of content.split(/\n{2,}/)) {
    if (current && current.length + paragraph.length + 2 > MAX_CHARS) {
      chunks.push(current.trim())
      current = ''
    }
    if (paragraph.length > MAX_CHARS) {
      for (let i = 0; i < paragraph.length; i += MAX_CHARS) {
        chunks.push(paragraph.slice(i, i + MAX_CHARS).trim())
      }
    } else {
      current += `${current ? '\n\n' : ''}${paragraph}`
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}
