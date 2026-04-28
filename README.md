# KnowledgeOS

## Local-first PGlite vault backend

The local vault backend stores system state in a `.knowx/` folder inside the selected vault and keeps all database access behind `KnowledgeStore`.

Run the app:

```bash
npm run dev
```

Run the local vault CLI:

```bash
npm run dev init ./demo-vault
npm run dev scan ./demo-vault
npm run dev search ./demo-vault refund
```

Equivalent explicit CLI script:

```bash
npm run knowx -- init ./demo-vault
npm run knowx -- scan ./demo-vault
npm run knowx -- search ./demo-vault refund
```

Run the Express backend with vault routes:

```bash
npm run backend
```

Routes:

- `POST /vault/open` with `{ "path": "/absolute/path/to/vault" }`
- `POST /vault/scan` with `{ "path": "/absolute/path/to/vault" }`
- `GET /documents?path=/absolute/path/to/vault&workspaceId=...`
- `GET /search?path=/absolute/path/to/vault&workspaceId=...&q=refund`
- `GET /health`

The Next frontend also includes a `Vault DB` panel that calls `/api/local-vault/*` routes for opening, scanning, listing, and searching a local filesystem vault by path.

Current limits:

- Search is simple case-insensitive chunk text matching.
- `pgvector` and embeddings are left as a TODO.
- `RemotePostgresKnowledgeStore` is a stub for a future Supabase/Postgres adapter.
- Sync is represented by `sync_events`; no remote sync worker is implemented yet.

