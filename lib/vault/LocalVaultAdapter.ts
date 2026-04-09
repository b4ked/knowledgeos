import fs from 'fs/promises'
import path from 'path'
import type { NoteFolder, NoteMetadata, VaultAdapter } from './VaultAdapter'

const NOTE_FOLDERS: NoteFolder[] = ['raw', 'wiki']

export class LocalVaultAdapter implements VaultAdapter {
  constructor(
    private readonly vaultPath: string,
    private readonly rawPath?: string,
    private readonly wikiPath?: string,
  ) {}

  private getFolderRoot(folder: NoteFolder): string {
    if (folder === 'raw' && this.rawPath) return this.rawPath
    if (folder === 'wiki' && this.wikiPath) return this.wikiPath
    return path.join(this.vaultPath, folder)
  }

  async ensureDirectories(): Promise<void> {
    await Promise.all(
      NOTE_FOLDERS.map((folder) =>
        fs.mkdir(this.getFolderRoot(folder), { recursive: true })
      )
    )
  }

  async listNotes(folder: NoteFolder): Promise<NoteMetadata[]> {
    const folderRoot = this.getFolderRoot(folder)
    await fs.mkdir(folderRoot, { recursive: true })

    const notes: NoteMetadata[] = []
    await this.collectNotes(folderRoot, folderRoot, folder, notes)
    return notes.sort((a, b) => a.path.localeCompare(b.path))
  }

  private async collectNotes(
    rootPath: string,
    currentPath: string,
    folder: NoteFolder,
    results: NoteMetadata[],
  ): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name)
      if (entry.isDirectory()) {
        await this.collectNotes(rootPath, fullPath, folder, results)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const stats = await fs.stat(fullPath)
        const relativeToRoot = path.relative(rootPath, fullPath).replace(/\\/g, '/')
        const slug = relativeToRoot.replace(/\.md$/, '')

        results.push({
          slug,
          filename: entry.name,
          folder,
          path: `${folder}/${relativeToRoot}` as `${NoteFolder}/${string}`,
          createdAt: stats.birthtime,
          updatedAt: stats.mtime,
        })
      }
    }
  }

  async readNote(notePath: string): Promise<string> {
    return fs.readFile(this.resolveNotePath(notePath), 'utf-8')
  }

  async writeNote(notePath: string, content: string): Promise<void> {
    const absolutePath = this.resolveNotePath(notePath)
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, content, 'utf-8')
  }

  async deleteNote(notePath: string): Promise<void> {
    await fs.unlink(this.resolveNotePath(notePath))
  }

  private resolveNotePath(notePath: string): string {
    const normalized = notePath.replace(/\\/g, '/').replace(/^\//, '')

    // Extract folder prefix (e.g. 'raw' from 'raw/subdir/note.md')
    const slashIdx = normalized.indexOf('/')
    if (slashIdx === -1) throw new Error(`Invalid note path: ${notePath}`)

    const folder = normalized.substring(0, slashIdx) as NoteFolder
    const rest = normalized.substring(slashIdx + 1)

    const relative = path.posix.normalize(rest)
    if (relative.startsWith('../') || relative === '..' || path.isAbsolute(relative)) {
      throw new Error(`Invalid note path: ${notePath}`)
    }

    const folderRoot = this.getFolderRoot(folder)
    return path.join(folderRoot, relative)
  }
}
