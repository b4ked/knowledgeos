import fs from 'fs/promises'
import type { Dirent } from 'fs'
import path from 'path'
import type { NoteMetadata, VaultAdapter } from './VaultAdapter'

export class LocalVaultAdapter implements VaultAdapter {
  private readonly vaultPath: string

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath
  }

  async ensureDirectories(): Promise<void> {
    await fs.mkdir(path.join(this.vaultPath, 'raw'), { recursive: true })
    await fs.mkdir(path.join(this.vaultPath, 'wiki'), { recursive: true })
  }

  async listNotes(folder: 'raw' | 'wiki'): Promise<NoteMetadata[]> {
    const folderPath = path.join(this.vaultPath, folder)
    let entries: Dirent[]

    try {
      entries = await fs.readdir(folderPath, { withFileTypes: true }) as unknown as Dirent[]
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException
      if (nodeErr.code === 'ENOENT') {
        return []
      }
      throw err
    }

    const mdFiles = entries.filter(
      (entry) => entry.isFile() && entry.name.endsWith('.md')
    )

    const metadataList = await Promise.all(
      mdFiles.map(async (entry): Promise<NoteMetadata> => {
        const filePath = path.join(folderPath, entry.name)
        const stat = await fs.stat(filePath)
        const slug = entry.name.slice(0, -3) // strip .md

        return {
          slug,
          filename: entry.name,
          folder,
          path: `${folder}/${entry.name}`,
          createdAt: stat.birthtime,
          updatedAt: stat.mtime,
        }
      })
    )

    return metadataList.sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    )
  }

  async readNote(notePath: string): Promise<string> {
    const fullPath = path.join(this.vaultPath, notePath)

    try {
      return await fs.readFile(fullPath, 'utf-8')
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException
      if (nodeErr.code === 'ENOENT') {
        throw new Error(`Note not found: ${notePath}`)
      }
      throw err
    }
  }

  async writeNote(notePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.vaultPath, notePath)
    const dir = path.dirname(fullPath)

    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(fullPath, content, 'utf-8')
  }

  async deleteNote(notePath: string): Promise<void> {
    const fullPath = path.join(this.vaultPath, notePath)

    try {
      await fs.unlink(fullPath)
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException
      if (nodeErr.code === 'ENOENT') {
        throw new Error(`Note not found: ${notePath}`)
      }
      throw err
    }
  }
}
