import fs from 'fs/promises'
import path from 'path'

export type EmbeddingStore = Record<string, number[]>

export interface EmbeddingsMeta {
  provider: string
  model: string
  updatedAt: string
}

const STORE_FILE = '.embeddings.json'
const META_FILE  = '.embeddings-meta.json'

export async function readStore(vaultPath: string): Promise<EmbeddingStore> {
  try {
    const raw = await fs.readFile(path.join(vaultPath, STORE_FILE), 'utf-8')
    return JSON.parse(raw) as EmbeddingStore
  } catch {
    return {}
  }
}

export async function writeStore(vaultPath: string, store: EmbeddingStore): Promise<void> {
  await fs.writeFile(path.join(vaultPath, STORE_FILE), JSON.stringify(store), 'utf-8')
}

export async function upsertEmbedding(
  vaultPath: string,
  slug: string,
  embedding: number[]
): Promise<void> {
  const store = await readStore(vaultPath)
  store[slug] = embedding
  await writeStore(vaultPath, store)
}

export async function readMeta(vaultPath: string): Promise<EmbeddingsMeta | null> {
  try {
    const raw = await fs.readFile(path.join(vaultPath, META_FILE), 'utf-8')
    return JSON.parse(raw) as EmbeddingsMeta
  } catch {
    return null
  }
}

export async function writeMeta(vaultPath: string, meta: EmbeddingsMeta): Promise<void> {
  await fs.writeFile(path.join(vaultPath, META_FILE), JSON.stringify(meta, null, 2), 'utf-8')
}
