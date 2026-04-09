import type { NoteFolder, NoteMetadata, VaultAdapter } from './VaultAdapter'

/**
 * Client-side vault adapter using the File System Access API.
 * Works in Chrome/Edge only. Reads/writes .md files directly from a
 * user-selected local folder — no server involved for file I/O.
 *
 * LLM features (compile, query) still call the Vercel API routes,
 * which use the server-side API key.
 */
export class BrowserVaultAdapter implements VaultAdapter {
  constructor(private readonly dirHandle: FileSystemDirectoryHandle) {}

  async ensureDirectories(): Promise<void> {
    await this.dirHandle.getDirectoryHandle('raw', { create: true })
    await this.dirHandle.getDirectoryHandle('wiki', { create: true })
  }

  async listNotes(folder: NoteFolder): Promise<NoteMetadata[]> {
    let folderHandle: FileSystemDirectoryHandle
    try {
      folderHandle = await this.dirHandle.getDirectoryHandle(folder, { create: false })
    } catch {
      return []
    }
    const notes: NoteMetadata[] = []
    await this.collectNotes(folderHandle, '', folder, notes)
    return notes.sort((a, b) => a.path.localeCompare(b.path))
  }

  private async collectNotes(
    dirHandle: FileSystemDirectoryHandle,
    prefix: string,
    folder: NoteFolder,
    results: NoteMetadata[],
  ): Promise<void> {
    const iter = (dirHandle as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()
    for await (const [name, handle] of iter) {
      if (handle.kind === 'directory') {
        const sub = handle as FileSystemDirectoryHandle
        await this.collectNotes(sub, prefix ? `${prefix}/${name}` : name, folder, results)
      } else if (handle.kind === 'file' && name.endsWith('.md')) {
        const fileHandle = handle as FileSystemFileHandle
        const file = await fileHandle.getFile()
        const relPath = prefix ? `${prefix}/${name}` : name
        const slug = relPath.replace(/\.md$/, '')
        results.push({
          slug,
          filename: name,
          folder,
          path: `${folder}/${relPath}` as `${NoteFolder}/${string}`,
          createdAt: new Date(file.lastModified),
          updatedAt: new Date(file.lastModified),
        })
      }
    }
  }

  async readNote(notePath: string): Promise<string> {
    const [folder, ...rest] = notePath.split('/')
    const filename = rest.join('/')
    const folderHandle = await this.dirHandle.getDirectoryHandle(folder, { create: false })
    const parts = filename.split('/')
    let currentDir = folderHandle
    for (let i = 0; i < parts.length - 1; i++) {
      currentDir = await currentDir.getDirectoryHandle(parts[i], { create: false })
    }
    const fileHandle = await currentDir.getFileHandle(parts[parts.length - 1], { create: false })
    const file = await fileHandle.getFile()
    return file.text()
  }

  async writeNote(notePath: string, content: string): Promise<void> {
    const [folder, ...rest] = notePath.split('/')
    const filename = rest.join('/')
    const folderHandle = await this.dirHandle.getDirectoryHandle(folder, { create: true })
    const parts = filename.split('/')
    let currentDir = folderHandle
    for (let i = 0; i < parts.length - 1; i++) {
      currentDir = await currentDir.getDirectoryHandle(parts[i], { create: true })
    }
    const fileHandle = await currentDir.getFileHandle(parts[parts.length - 1], { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(content)
    await writable.close()
  }

  async deleteNote(notePath: string): Promise<void> {
    const [folder, ...rest] = notePath.split('/')
    const filename = rest.join('/')
    const folderHandle = await this.dirHandle.getDirectoryHandle(folder, { create: false })
    const parts = filename.split('/')
    let currentDir = folderHandle
    for (let i = 0; i < parts.length - 1; i++) {
      currentDir = await currentDir.getDirectoryHandle(parts[i], { create: false })
    }
    await currentDir.removeEntry(parts[parts.length - 1])
  }
}

/** Check if the browser supports the File System Access API */
export function isFSAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

/** Prompt the user to pick a local vault folder */
export async function pickVaultFolder(): Promise<FileSystemDirectoryHandle> {
  if (!isFSAccessSupported()) {
    throw new Error('File System Access API is not supported in this browser')
  }
  return (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker()
}
