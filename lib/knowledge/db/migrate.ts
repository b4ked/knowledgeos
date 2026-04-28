import type { PGlite } from '@electric-sql/pglite'

export async function migrate(db: PGlite): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      root_path text NOT NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS documents (
      id uuid PRIMARY KEY,
      workspace_id uuid NOT NULL,
      path text NOT NULL,
      title text,
      source_type text NOT NULL,
      content_hash text NOT NULL,
      size_bytes integer,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      UNIQUE(workspace_id, path)
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id uuid PRIMARY KEY,
      workspace_id uuid NOT NULL,
      document_id uuid NOT NULL,
      chunk_index integer NOT NULL,
      heading_path jsonb,
      content text NOT NULL,
      token_estimate integer,
      content_hash text NOT NULL,
      created_at timestamptz DEFAULT now(),
      UNIQUE(document_id, chunk_index)
    );

    CREATE TABLE IF NOT EXISTS entities (
      id uuid PRIMARY KEY,
      workspace_id uuid NOT NULL,
      name text NOT NULL,
      type text,
      description text,
      confidence real,
      source_chunk_id uuid,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS relationships (
      id uuid PRIMARY KEY,
      workspace_id uuid NOT NULL,
      source_entity_id uuid,
      target_entity_id uuid,
      relationship_type text NOT NULL,
      description text,
      confidence real,
      source_chunk_id uuid,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS graph_nodes (
      id uuid PRIMARY KEY,
      workspace_id uuid NOT NULL,
      external_id text,
      label text NOT NULL,
      type text,
      metadata jsonb,
      created_at timestamptz DEFAULT now(),
      UNIQUE(workspace_id, external_id)
    );

    CREATE TABLE IF NOT EXISTS graph_edges (
      id uuid PRIMARY KEY,
      workspace_id uuid NOT NULL,
      source_node_id uuid NOT NULL,
      target_node_id uuid NOT NULL,
      type text NOT NULL,
      metadata jsonb,
      created_at timestamptz DEFAULT now(),
      UNIQUE(workspace_id, source_node_id, target_node_id, type)
    );

    CREATE TABLE IF NOT EXISTS sync_events (
      id uuid PRIMARY KEY,
      workspace_id uuid NOT NULL,
      entity_type text NOT NULL,
      entity_id uuid NOT NULL,
      operation text NOT NULL,
      payload jsonb NOT NULL,
      created_at timestamptz DEFAULT now(),
      synced_at timestamptz
    );

    CREATE INDEX IF NOT EXISTS documents_workspace_idx ON documents(workspace_id);
    CREATE INDEX IF NOT EXISTS chunks_workspace_idx ON chunks(workspace_id);
    CREATE INDEX IF NOT EXISTS chunks_document_idx ON chunks(document_id);
    CREATE INDEX IF NOT EXISTS sync_events_unsynced_idx ON sync_events(workspace_id, synced_at);
  `)
}

