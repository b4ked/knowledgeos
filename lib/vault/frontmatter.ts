import matter from 'gray-matter'

export interface NoteFrontmatter {
  tags: string[]
  date?: string
  aliases?: string[]
  [key: string]: unknown
}

export interface ParsedNote {
  frontmatter: NoteFrontmatter
  content: string
}

/**
 * Parse YAML frontmatter AND extract inline #hashtags from body text.
 * Skips hashtags inside code blocks.
 */
export function parseNoteFrontmatter(raw: string): ParsedNote {
  const { data, content } = matter(raw)

  const fmTags: string[] = Array.isArray(data.tags)
    ? data.tags.map(String)
    : typeof data.tags === 'string'
      ? [data.tags]
      : []

  const inlineTags: string[] = []
  const stripped = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '')
  const tagMatches = stripped.matchAll(/#([\w/-]+)/g)
  for (const m of tagMatches) {
    inlineTags.push(m[1])
  }

  const allTags = [...new Set([...fmTags, ...inlineTags])]

  return {
    frontmatter: {
      ...data,
      tags: allTags,
      date: typeof data.date === 'string' ? data.date : data.date instanceof Date ? data.date.toISOString().split('T')[0] : undefined,
      aliases: Array.isArray(data.aliases) ? data.aliases.map(String) : undefined,
    },
    content,
  }
}

/**
 * Stringify note content with updated frontmatter prepended.
 */
export function stringifyWithFrontmatter(frontmatter: NoteFrontmatter, content: string): string {
  const data: Record<string, unknown> = { ...frontmatter }
  if (data.tags && Array.isArray(data.tags) && (data.tags as string[]).length === 0) delete data.tags
  if (!data.date) delete data.date
  if (!data.aliases || (Array.isArray(data.aliases) && (data.aliases as string[]).length === 0)) delete data.aliases
  for (const k of Object.keys(data)) {
    if (data[k] === undefined) delete data[k]
  }
  if (Object.keys(data).length === 0) return content
  return matter.stringify(content, data)
}
