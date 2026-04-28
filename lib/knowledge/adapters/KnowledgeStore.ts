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

export interface KnowledgeStore {
  init(): Promise<void>
  close(): Promise<void>

  createWorkspace(input: WorkspaceInput): Promise<Workspace>
  getWorkspace(id: string): Promise<Workspace | null>

  upsertDocument(input: DocumentInput): Promise<DocumentRecord>
  getDocumentByPath(workspaceId: string, path: string): Promise<DocumentRecord | null>
  listDocuments(workspaceId: string): Promise<DocumentRecord[]>

  replaceChunks(documentId: string, chunks: ChunkInput[]): Promise<ChunkRecord[]>
  searchChunks(workspaceId: string, query: string): Promise<ChunkSearchResult[]>

  upsertGraphNode(input: GraphNodeInput): Promise<GraphNode>
  upsertGraphEdge(input: GraphEdgeInput): Promise<GraphEdge>

  appendSyncEvent(input: SyncEventInput): Promise<SyncEvent>
  listUnsyncedEvents(workspaceId: string): Promise<SyncEvent[]>
}

