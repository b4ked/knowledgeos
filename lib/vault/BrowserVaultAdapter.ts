import type { NoteFolder, NoteMetadata, VaultAdapter } from './VaultAdapter'

const DB_NAME = 'knowledgeos-local-vault'
const STORE_NAME = 'handles'
const HANDLE_KEY = 'selected-vault'

type PermissionMode = 'read' | 'readwrite'
type PermissionStateLike = 'granted' | 'denied' | 'prompt'
type PermissionCapableHandle = FileSystemHandle & {
  queryPermission?: (descriptor?: { mode?: PermissionMode }) => Promise<PermissionStateLike>
  requestPermission?: (descriptor?: { mode?: PermissionMode }) => Promise<PermissionStateLike>
}

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

  getHandle(): FileSystemDirectoryHandle {
    return this.dirHandle
  }

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

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'))
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openVaultDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode)
      const store = tx.objectStore(STORE_NAME)
      Promise.resolve(run(store)).then(resolve, reject)
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    })
  } finally {
    db.close()
  }
}

export async function saveVaultFolderHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await withStore('readwrite', (store) => {
    store.put(handle, HANDLE_KEY)
  })
}

export async function clearSavedVaultFolderHandle(): Promise<void> {
  await withStore('readwrite', (store) => {
    store.delete(HANDLE_KEY)
  })
}

export async function loadSavedVaultFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  return withStore('readonly', (store) => {
    return new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const req = store.get(HANDLE_KEY)
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle | undefined) ?? null)
      req.onerror = () => reject(req.error ?? new Error('Could not read saved vault handle'))
    })
  })
}

export async function getHandlePermissionState(
  handle: FileSystemDirectoryHandle,
  mode: PermissionMode = 'readwrite',
): Promise<PermissionStateLike> {
  const permissionHandle = handle as PermissionCapableHandle
  if (!permissionHandle.queryPermission) return 'prompt'
  return permissionHandle.queryPermission({ mode })
}

export async function restoreSavedVaultFolder(
  options: { requestPermission?: boolean } = {},
): Promise<FileSystemDirectoryHandle | null> {
  const handle = await loadSavedVaultFolderHandle()
  if (!handle) return null

  const permissionHandle = handle as PermissionCapableHandle
  const state = await getHandlePermissionState(handle, 'readwrite').catch(() => 'prompt' as PermissionStateLike)
  if (state === 'granted') return handle

  if (options.requestPermission && permissionHandle.requestPermission) {
    const next = await permissionHandle.requestPermission({ mode: 'readwrite' }).catch(() => 'denied' as PermissionStateLike)
    if (next === 'granted') return handle
  }

  return null
}
