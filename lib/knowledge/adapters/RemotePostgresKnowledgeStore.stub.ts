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

export class RemotePostgresKnowledgeStore implements KnowledgeStore {
  constructor() {
    // Wire a future Supabase/Postgres client here. The rest of KnowledgeOS should
    // keep depending only on KnowledgeStore so local and remote backends can swap.
  }

  async init(): Promise<void> { throw notImplemented() }
  async close(): Promise<void> { throw notImplemented() }
  async createWorkspace(_input: WorkspaceInput): Promise<Workspace> { throw notImplemented() }
  async getWorkspace(_id: string): Promise<Workspace | null> { throw notImplemented() }
  async upsertDocument(_input: DocumentInput): Promise<DocumentRecord> { throw notImplemented() }
  async getDocumentByPath(_workspaceId: string, _path: string): Promise<DocumentRecord | null> { throw notImplemented() }
  async listDocuments(_workspaceId: string): Promise<DocumentRecord[]> { throw notImplemented() }
  async replaceChunks(_documentId: string, _chunks: ChunkInput[]): Promise<ChunkRecord[]> { throw notImplemented() }
  async searchChunks(_workspaceId: string, _query: string): Promise<ChunkSearchResult[]> { throw notImplemented() }
  async upsertGraphNode(_input: GraphNodeInput): Promise<GraphNode> { throw notImplemented() }
  async upsertGraphEdge(_input: GraphEdgeInput): Promise<GraphEdge> { throw notImplemented() }
  async appendSyncEvent(_input: SyncEventInput): Promise<SyncEvent> { throw notImplemented() }
  async listUnsyncedEvents(_workspaceId: string): Promise<SyncEvent[]> { throw notImplemented() }
}

function notImplemented(): Error {
  return new Error('Not implemented yet')
}

