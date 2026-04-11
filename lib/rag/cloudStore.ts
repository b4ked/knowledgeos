import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { vaultEmbeddings } from '@/lib/db/schema'
import type { NoteFolder } from '@/lib/vault/VaultAdapter'

export interface CloudEmbeddingRecord {
  folder: NoteFolder
  slug: string
  contentHash: string
  embedding: number[]
  provider: string
  model: string
  updatedAt: Date
}

export interface CloudEmbeddingMeta {
  provider: string
  model: string
  updatedAt: string
}

export async function listUserEmbeddings(userId: string, folder?: NoteFolder): Promise<CloudEmbeddingRecord[]> {
  const rows = await db
    .select()
    .from(vaultEmbeddings)
    .where(
      folder
        ? and(eq(vaultEmbeddings.userId, userId), eq(vaultEmbeddings.folder, folder))
        : eq(vaultEmbeddings.userId, userId)
    )

  return rows.map((row) => ({
    folder: row.folder as NoteFolder,
    slug: row.slug,
    contentHash: row.contentHash,
    embedding: row.embedding,
    provider: row.provider,
    model: row.model,
    updatedAt: row.updatedAt,
  }))
}

export async function readUserEmbeddingMeta(userId: string, folder?: NoteFolder): Promise<CloudEmbeddingMeta | null> {
  const rows = await db
    .select({
      provider: vaultEmbeddings.provider,
      model: vaultEmbeddings.model,
      updatedAt: vaultEmbeddings.updatedAt,
    })
    .from(vaultEmbeddings)
    .where(
      folder
        ? and(eq(vaultEmbeddings.userId, userId), eq(vaultEmbeddings.folder, folder))
        : eq(vaultEmbeddings.userId, userId)
    )
    .orderBy(desc(vaultEmbeddings.updatedAt))
    .limit(1)

  if (rows.length === 0) return null

  return {
    provider: rows[0].provider,
    model: rows[0].model,
    updatedAt: rows[0].updatedAt.toISOString(),
  }
}

export async function upsertUserEmbedding(args: {
  userId: string
  folder: NoteFolder
  slug: string
  contentHash: string
  embedding: number[]
  provider: string
  model: string
}): Promise<void> {
  await db
    .insert(vaultEmbeddings)
    .values({
      userId: args.userId,
      folder: args.folder,
      slug: args.slug,
      contentHash: args.contentHash,
      embedding: args.embedding,
      provider: args.provider,
      model: args.model,
    })
    .onConflictDoUpdate({
      target: [vaultEmbeddings.userId, vaultEmbeddings.folder, vaultEmbeddings.slug],
      set: {
        contentHash: args.contentHash,
        embedding: args.embedding,
        provider: args.provider,
        model: args.model,
        updatedAt: new Date(),
      },
    })
}

export async function deleteUserEmbeddings(
  userId: string,
  options: { folder?: NoteFolder; slug?: string } = {},
): Promise<void> {
  const predicates = [eq(vaultEmbeddings.userId, userId)]
  if (options.folder) predicates.push(eq(vaultEmbeddings.folder, options.folder))
  if (options.slug) predicates.push(eq(vaultEmbeddings.slug, options.slug))
  await db.delete(vaultEmbeddings).where(and(...predicates))
}
