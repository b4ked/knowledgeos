import { eq, and } from 'drizzle-orm'
import { vaultNotes } from '@/lib/db/schema'
import type { NoteFolder, NoteMetadata, VaultAdapter } from './VaultAdapter'

type DrizzleClient = typeof import('@/lib/db').db

/**
 * Parse a notePath like "wiki/projects/my-note.md" into { folder, slug, filename }.
 * folder = first path segment ('raw' | 'wiki')
 * slug   = rest without the .md extension (e.g. 'projects/my-note')
 * filename = last segment with .md (e.g. 'my-note.md')
 */
function parsePath(notePath: string): { folder: NoteFolder; slug: string; filename: string } {
  const normalized = notePath.replace(/\\/g, '/').replace(/^\//, '')
  const slashIdx = normalized.indexOf('/')
  if (slashIdx === -1) throw new Error(`Invalid note path: ${notePath}`)

  const folder = normalized.substring(0, slashIdx) as NoteFolder
  const rest = normalized.substring(slashIdx + 1)
  const slug = rest.replace(/\.md$/, '')
  const parts = slug.split('/')
  const filename = `${parts[parts.length - 1]}.md`

  return { folder, slug, filename }
}

export class CloudVaultAdapter implements VaultAdapter {
  constructor(
    private readonly db: DrizzleClient,
    private readonly userId: string,
  ) {}

  async ensureDirectories(): Promise<void> {
    // No-op: database does not need directory setup
  }

  async listNotes(folder: NoteFolder): Promise<NoteMetadata[]> {
    const rows = await this.db
      .select()
      .from(vaultNotes)
      .where(and(eq(vaultNotes.userId, this.userId), eq(vaultNotes.folder, folder)))

    return rows
      .map((row): NoteMetadata => ({
        slug: row.slug,
        filename: row.filename,
        folder: row.folder as NoteFolder,
        path: `${row.folder}/${row.slug}.md` as `${NoteFolder}/${string}`,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }))
      .sort((a, b) => a.path.localeCompare(b.path))
  }

  async readNote(notePath: string): Promise<string> {
    const { folder, slug } = parsePath(notePath)

    const rows = await this.db
      .select()
      .from(vaultNotes)
      .where(
        and(
          eq(vaultNotes.userId, this.userId),
          eq(vaultNotes.folder, folder),
          eq(vaultNotes.slug, slug),
        ),
      )
      .limit(1)

    if (rows.length === 0) {
      throw new Error(`Note not found: ${notePath}`)
    }

    return rows[0].content
  }

  async writeNote(notePath: string, content: string): Promise<void> {
    const { folder, slug, filename } = parsePath(notePath)

    await this.db
      .insert(vaultNotes)
      .values({
        userId: this.userId,
        folder,
        slug,
        filename,
        content,
      })
      .onConflictDoUpdate({
        target: [vaultNotes.userId, vaultNotes.folder, vaultNotes.slug],
        set: {
          content,
          filename,
          updatedAt: new Date(),
        },
      })
  }

  async deleteNote(notePath: string): Promise<void> {
    const { folder, slug } = parsePath(notePath)

    const result = await this.db
      .delete(vaultNotes)
      .where(
        and(
          eq(vaultNotes.userId, this.userId),
          eq(vaultNotes.folder, folder),
          eq(vaultNotes.slug, slug),
        ),
      )
      .returning({ id: vaultNotes.id })

    if (result.length === 0) {
      throw new Error(`Note not found: ${notePath}`)
    }
  }
}
