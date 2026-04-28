export interface Workspace {
  id: string
  name: string
  rootPath: string
  createdAt: string
  updatedAt: string
}

export interface DocumentRecord {
  id: string
  workspaceId: string
  path: string
  title: string | null
  sourceType: string
  contentHash: string
  sizeBytes: number | null
  createdAt: string
  updatedAt: string
}

export interface ChunkRecord {
  id: string
  workspaceId: string
  documentId: string
  chunkIndex: number
  headingPath: string[] | null
  content: string
  tokenEstimate: number | null
  contentHash: string
  createdAt: string
}

export interface GraphNode {
  id: string
  workspaceId: string
  externalId: string | null
  label: string
  type: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface GraphEdge {
  id: string
  workspaceId: string
  sourceNodeId: string
  targetNodeId: string
  type: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface SyncEvent {
  id: string
  workspaceId: string
  entityType: string
  entityId: string
  operation: string
  payload: Record<string, unknown>
  createdAt: string
  syncedAt: string | null
}

export interface VaultConfig {
  version: 1
  vaultId: string
  vaultName: string
  database: {
    mode: 'pglite'
    path: '.knowx/db'
  }
}

export type WorkspaceInput = {
  id?: string
  name: string
  rootPath: string
}

export type DocumentInput = {
  id?: string
  workspaceId: string
  path: string
  title?: string | null
  sourceType: string
  contentHash: string
  sizeBytes?: number | null
}

export type ChunkInput = {
  id?: string
  workspaceId: string
  chunkIndex: number
  headingPath?: string[] | null
  content: string
  tokenEstimate?: number | null
  contentHash: string
}

export type GraphNodeInput = {
  id?: string
  workspaceId: string
  externalId?: string | null
  label: string
  type?: string | null
  metadata?: Record<string, unknown> | null
}

export type GraphEdgeInput = {
  id?: string
  workspaceId: string
  sourceNodeId: string
  targetNodeId: string
  type: string
  metadata?: Record<string, unknown> | null
}

export type SyncEventInput = {
  id?: string
  workspaceId: string
  entityType: string
  entityId: string
  operation: string
  payload: Record<string, unknown>
}

export type ChunkSearchResult = {
  chunk: ChunkRecord
  documentPath: string
  score: number
  snippet: string
}

