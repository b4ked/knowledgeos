import { cosineSimilarity } from '@/lib/embeddings/cosine'
import type { NoteFolder } from '@/lib/vault/VaultAdapter'

const DB_NAME = 'knowledgeos-local-rag'
const ENTRIES_STORE = 'entries'
const META_STORE = 'meta'

export interface LocalRagEntry {
  key: string
  folder: NoteFolder
  slug: string
  contentHash: string
  embedding: number[]
  updatedAt: string
}

export interface LocalRagMeta {
  provider: string
  model: string
  updatedAt: string
}

function metaKey(folder: NoteFolder): string {
  return `meta:${folder}`
}

function entryKey(folder: NoteFolder, slug: string): string {
  return `${folder}:${slug}`
}

function openRagDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(ENTRIES_STORE)) {
        db.createObjectStore(ENTRIES_STORE, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open local RAG database'))
  })
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openRagDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode)
      const store = tx.objectStore(storeName)
      Promise.resolve(run(store)).then(resolve, reject)
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    })
  } finally {
    db.close()
  }
}

export async function hashContentInBrowser(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function listLocalRagEntries(folder?: NoteFolder): Promise<LocalRagEntry[]> {
  const all = await withStore(ENTRIES_STORE, 'readonly', (store) => {
    return new Promise<LocalRagEntry[]>((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => resolve((req.result as LocalRagEntry[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('Could not read local RAG entries'))
    })
  })

  return folder ? all.filter((entry) => entry.folder === folder) : all
}

export async function readLocalRagMeta(folder: NoteFolder): Promise<LocalRagMeta | null> {
  return withStore(META_STORE, 'readonly', (store) => {
    return new Promise<LocalRagMeta | null>((resolve, reject) => {
      const req = store.get(metaKey(folder))
      req.onsuccess = () => resolve((req.result as LocalRagMeta | undefined) ?? null)
      req.onerror = () => reject(req.error ?? new Error('Could not read local RAG metadata'))
    })
  })
}

export async function writeLocalRagEntries(folder: NoteFolder, entries: Omit<LocalRagEntry, 'key' | 'folder'>[]): Promise<void> {
  await withStore(ENTRIES_STORE, 'readwrite', async (store) => {
    for (const entry of entries) {
      store.put({
        key: entryKey(folder, entry.slug),
        folder,
        ...entry,
      } satisfies LocalRagEntry)
    }
  })
}

export async function writeLocalRagMeta(folder: NoteFolder, meta: LocalRagMeta): Promise<void> {
  await withStore(META_STORE, 'readwrite', (store) => {
    store.put(meta, metaKey(folder))
  })
}

export async function upsertLocalRagEntry(folder: NoteFolder, entry: Omit<LocalRagEntry, 'key' | 'folder'>): Promise<void> {
  await writeLocalRagEntries(folder, [entry])
}

export async function clearLocalRagEntries(folder?: NoteFolder): Promise<void> {
  if (!folder) {
    await Promise.all([
      withStore(ENTRIES_STORE, 'readwrite', (store) => {
        store.clear()
      }),
      withStore(META_STORE, 'readwrite', (store) => {
        store.clear()
      }),
    ])
    return
  }

  const entries = await listLocalRagEntries()
  await withStore(ENTRIES_STORE, 'readwrite', (store) => {
    for (const entry of entries) {
      if (entry.folder === folder) {
        store.delete(entry.key)
      }
    }
  })
  await withStore(META_STORE, 'readwrite', (store) => {
    store.delete(metaKey(folder))
  })
}

export async function retrieveLocalRagSlugs(
  folder: NoteFolder,
  questionEmbedding: number[],
  options: { topK?: number; minScore?: number } = {},
): Promise<string[]> {
  const { topK = 5, minScore = 0.1 } = options
  const entries = await listLocalRagEntries(folder)
  return entries
    .map((entry) => ({
      slug: entry.slug,
      score: cosineSimilarity(questionEmbedding, entry.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((entry) => entry.score >= minScore)
    .map((entry) => entry.slug)
}
