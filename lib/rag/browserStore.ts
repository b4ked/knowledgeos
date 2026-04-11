import type { BrowserVaultAdapter } from '@/lib/vault/BrowserVaultAdapter'
import { cosineSimilarity } from '@/lib/embeddings/cosine'

const RAG_INDEX_PATH = 'wiki/.rag-index.json'

export interface LocalRagEntry {
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

interface RagIndex {
  meta?: LocalRagMeta
  entries: Record<string, { contentHash: string; embedding: number[]; updatedAt: string }>
}

async function readRagIndex(adapter: BrowserVaultAdapter): Promise<RagIndex> {
  try {
    const raw = await adapter.readNote(RAG_INDEX_PATH)
    return JSON.parse(raw) as RagIndex
  } catch {
    return { entries: {} }
  }
}

async function writeRagIndex(adapter: BrowserVaultAdapter, index: RagIndex): Promise<void> {
  await adapter.writeNote(RAG_INDEX_PATH, JSON.stringify(index))
}

export async function hashContentInBrowser(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function listLocalRagEntries(adapter: BrowserVaultAdapter): Promise<LocalRagEntry[]> {
  const index = await readRagIndex(adapter)
  return Object.entries(index.entries).map(([slug, e]) => ({ slug, ...e }))
}

export async function readLocalRagMeta(adapter: BrowserVaultAdapter): Promise<LocalRagMeta | null> {
  const index = await readRagIndex(adapter)
  return index.meta ?? null
}

export async function writeLocalRagEntries(
  adapter: BrowserVaultAdapter,
  entries: LocalRagEntry[],
): Promise<void> {
  const index = await readRagIndex(adapter)
  for (const entry of entries) {
    index.entries[entry.slug] = {
      contentHash: entry.contentHash,
      embedding: entry.embedding,
      updatedAt: entry.updatedAt,
    }
  }
  await writeRagIndex(adapter, index)
}

export async function writeLocalRagMeta(adapter: BrowserVaultAdapter, meta: LocalRagMeta): Promise<void> {
  const index = await readRagIndex(adapter)
  index.meta = meta
  await writeRagIndex(adapter, index)
}

export async function upsertLocalRagEntry(
  adapter: BrowserVaultAdapter,
  entry: LocalRagEntry,
): Promise<void> {
  await writeLocalRagEntries(adapter, [entry])
}

export async function clearLocalRagEntries(adapter: BrowserVaultAdapter): Promise<void> {
  await writeRagIndex(adapter, { entries: {} })
}

export async function retrieveLocalRagSlugs(
  adapter: BrowserVaultAdapter,
  questionEmbedding: number[],
  options: { topK?: number; minScore?: number } = {},
): Promise<string[]> {
  const { topK = 5, minScore = 0.1 } = options
  const entries = await listLocalRagEntries(adapter)
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
