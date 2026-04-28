import { PGlite } from '@electric-sql/pglite'
import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { migrate } from '../db/migrate'
import type { KnowledgeStore } from './KnowledgeStore'
import type {
  ChunkInput,
  ChunkRecord,
  ChunkSearchResult,
  DocumentInput,
  DocumentRecord,
  GraphEdge,
  GraphEdgeInput,
  GraphNode,
  GraphNodeInput,
  SyncEvent,
  SyncEventInput,
  Workspace,
  WorkspaceInput,
} from '../types/models'

type Row = Record<string, unknown>

export class PGliteKnowledgeStore implements KnowledgeStore {
  private db: PGlite | null = null

  constructor(private readonly dbPath: string) {}

  async init(): Promise<void> {
    await fs.mkdir(this.dbPath, { recursive: true })
    this.db = new PGlite(this.dbPath)
    await migrate(this.client)
  }

  async close(): Promise<void> {
    await this.db?.close()
    this.db = null
  }

  async createWorkspace(input: WorkspaceInput): Promise<Workspace> {
    const id = input.id ?? randomUUID()
    const result = await this.client.query<Row>(
      `INSERT INTO workspaces (id, name, root_path, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (id) DO UPDATE SET
         name = excluded.name,
         root_path = excluded.root_path,
         updated_at = now()
       RETURNING *`,
      [id, input.name, input.rootPath],
    )
    return mapWorkspace(result.rows[0])
  }

  async getWorkspace(id: string): Promise<Workspace | null> {
    const result = await this.client.query<Row>('SELECT * FROM workspaces WHERE id = $1', [id])
    return result.rows[0] ? mapWorkspace(result.rows[0]) : null
  }

  async upsertDocument(input: DocumentInput): Promise<DocumentRecord> {
    const id = input.id ?? randomUUID()
    const result = await this.client.query<Row>(
      `INSERT INTO documents (id, workspace_id, path, title, source_type, content_hash, size_bytes, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (workspace_id, path) DO UPDATE SET
         title = excluded.title,
         source_type = excluded.source_type,
         content_hash = excluded.content_hash,
         size_bytes = excluded.size_bytes,
         updated_at = now()
       RETURNING *`,
      [
        id,
        input.workspaceId,
        input.path,
        input.title ?? null,
        input.sourceType,
        input.contentHash,
        input.sizeBytes ?? null,
      ],
    )
    return mapDocument(result.rows[0])
  }

  async getDocumentByPath(workspaceId: string, documentPath: string): Promise<DocumentRecord | null> {
    const result = await this.client.query<Row>(
      'SELECT * FROM documents WHERE workspace_id = $1 AND path = $2',
      [workspaceId, documentPath],
    )
    return result.rows[0] ? mapDocument(result.rows[0]) : null
  }

  async listDocuments(workspaceId: string): Promise<DocumentRecord[]> {
    const result = await this.client.query<Row>(
      'SELECT * FROM documents WHERE workspace_id = $1 ORDER BY path ASC',
      [workspaceId],
    )
    return result.rows.map(mapDocument)
  }

  async replaceChunks(documentId: string, chunks: ChunkInput[]): Promise<ChunkRecord[]> {
    await this.client.query('DELETE FROM chunks WHERE document_id = $1', [documentId])
    const inserted: ChunkRecord[] = []
    for (const chunk of chunks) {
      const result = await this.client.query<Row>(
        `INSERT INTO chunks (
          id, workspace_id, document_id, chunk_index, heading_path, content, token_estimate, content_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          chunk.id ?? randomUUID(),
          chunk.workspaceId,
          documentId,
          chunk.chunkIndex,
          chunk.headingPath ? JSON.stringify(chunk.headingPath) : null,
          chunk.content,
          chunk.tokenEstimate ?? null,
          chunk.contentHash,
        ],
      )
      inserted.push(mapChunk(result.rows[0]))
    }
    return inserted
  }

  async searchChunks(workspaceId: string, query: string): Promise<ChunkSearchResult[]> {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    const result = await this.client.query<Row>(
      `SELECT c.*, d.path AS document_path
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE c.workspace_id = $1 AND lower(c.content) LIKE $2
       LIMIT 100`,
      [workspaceId, `%${needle}%`],
    )

    return result.rows
      .map((row) => {
        const chunk = mapChunk(row)
        const lower = chunk.content.toLowerCase()
        const score = lower.split(needle).length - 1
        const index = Math.max(0, lower.indexOf(needle))
        const snippet = chunk.content.slice(Math.max(0, index - 80), index + needle.length + 160).trim()
        return {
          chunk,
          documentPath: String(row.document_path),
          score,
          snippet,
        }
      })
      .sort((a, b) => b.score - a.score || a.documentPath.localeCompare(b.documentPath))
  }

  async upsertGraphNode(input: GraphNodeInput): Promise<GraphNode> {
    const result = await this.client.query<Row>(
      `INSERT INTO graph_nodes (id, workspace_id, external_id, label, type, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (workspace_id, external_id) DO UPDATE SET
         label = excluded.label,
         type = excluded.type,
         metadata = excluded.metadata
       RETURNING *`,
      [
        input.id ?? randomUUID(),
        input.workspaceId,
        input.externalId ?? randomUUID(),
        input.label,
        input.type ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    )
    return mapGraphNode(result.rows[0])
  }

  async upsertGraphEdge(input: GraphEdgeInput): Promise<GraphEdge> {
    const result = await this.client.query<Row>(
      `INSERT INTO graph_edges (id, workspace_id, source_node_id, target_node_id, type, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (workspace_id, source_node_id, target_node_id, type) DO UPDATE SET
         metadata = excluded.metadata
       RETURNING *`,
      [
        input.id ?? randomUUID(),
        input.workspaceId,
        input.sourceNodeId,
        input.targetNodeId,
        input.type,
        JSON.stringify(input.metadata ?? {}),
      ],
    )
    return mapGraphEdge(result.rows[0])
  }

  async appendSyncEvent(input: SyncEventInput): Promise<SyncEvent> {
    const result = await this.client.query<Row>(
      `INSERT INTO sync_events (id, workspace_id, entity_type, entity_id, operation, payload)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.id ?? randomUUID(),
        input.workspaceId,
        input.entityType,
        input.entityId,
        input.operation,
        JSON.stringify(input.payload),
      ],
    )
    return mapSyncEvent(result.rows[0])
  }

  async listUnsyncedEvents(workspaceId: string): Promise<SyncEvent[]> {
    const result = await this.client.query<Row>(
      'SELECT * FROM sync_events WHERE workspace_id = $1 AND synced_at IS NULL ORDER BY created_at ASC',
      [workspaceId],
    )
    return result.rows.map(mapSyncEvent)
  }

  private get client(): PGlite {
    if (!this.db) throw new Error('PGliteKnowledgeStore has not been initialised')
    return this.db
  }
}

function mapWorkspace(row: Row): Workspace {
  return {
    id: String(row.id),
    name: String(row.name),
    rootPath: String(row.root_path),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

function mapDocument(row: Row): DocumentRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    path: String(row.path),
    title: nullableString(row.title),
    sourceType: String(row.source_type),
    contentHash: String(row.content_hash),
    sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

function mapChunk(row: Row): ChunkRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    documentId: String(row.document_id),
    chunkIndex: Number(row.chunk_index),
    headingPath: parseJson(row.heading_path) as string[] | null,
    content: String(row.content),
    tokenEstimate: row.token_estimate == null ? null : Number(row.token_estimate),
    contentHash: String(row.content_hash),
    createdAt: toIso(row.created_at),
  }
}

function mapGraphNode(row: Row): GraphNode {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    externalId: nullableString(row.external_id),
    label: String(row.label),
    type: nullableString(row.type),
    metadata: parseJsonObject(row.metadata),
    createdAt: toIso(row.created_at),
  }
}

function mapGraphEdge(row: Row): GraphEdge {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    sourceNodeId: String(row.source_node_id),
    targetNodeId: String(row.target_node_id),
    type: String(row.type),
    metadata: parseJsonObject(row.metadata),
    createdAt: toIso(row.created_at),
  }
}

function mapSyncEvent(row: Row): SyncEvent {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    operation: String(row.operation),
    payload: parseJsonObject(row.payload) ?? {},
    createdAt: toIso(row.created_at),
    syncedAt: row.synced_at == null ? null : toIso(row.synced_at),
  }
}

function parseJson(value: unknown): Record<string, unknown> | string[] | null {
  if (value == null) return null
  if (typeof value === 'object') return value as Record<string, unknown> | string[]
  if (typeof value === 'string') return JSON.parse(value)
  return null
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  const parsed = parseJson(value)
  return parsed && !Array.isArray(parsed) ? parsed : null
}

function nullableString(value: unknown): string | null {
  return value == null ? null : String(value)
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  return new Date(String(value)).toISOString()
}

export function getPGliteDbPath(vaultPath: string): string {
  return path.join(vaultPath, '.knowx', 'db')
}
