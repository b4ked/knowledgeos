@AGENTS.md

# KnowledgeOS — Agent Context

## What This Project Is

KnowledgeOS is an AI-native personal knowledge base web application. It turns raw source material into a structured, queryable wiki using LLM compilation, a D3-force knowledge graph, and RAG-powered chat — built on Next.js with hot-swappable local/cloud vault backends.

**Repo:** `https://github.com/b4ked/knowledgeos`
**Local clone:** `~/knowledgeos/`
**Deployed:** Vercel — `knoswmba.parrytech.co`

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Graph Viz | D3-force v7 |
| LLM | Anthropic (Claude) or OpenAI (GPT-4o) — env configurable |
| Embeddings | voyage-3-lite (Anthropic) / text-embedding-3-small (OpenAI) |
| Vector search | In-memory cosine similarity (local) / pgvector (cloud) |
| Auth | NextAuth v5 (email/password + email verification) |
| Database | Supabase/Postgres via Drizzle ORM |
| Testing | Vitest (unit) + Playwright (e2e) |
| Deployment | Vercel |

---

## Repository Structure

```
knowledgeos/
├── app/
│   ├── api/
│   │   ├── compile/route.ts          # POST: AI compilation (cloud + local paths)
│   │   ├── conventions/              # GET/PUT: compilation conventions
│   │   ├── embeddings/
│   │   │   ├── index/route.ts        # POST: tokenise notes → embeddings
│   │   │   ├── query/route.ts        # POST: embed a question (browser uses this for local RAG)
│   │   │   └── clear/route.ts        # DELETE: clear embeddings
│   │   ├── graph/route.ts            # GET: graph data (cloud or local)
│   │   ├── notes/route.ts            # GET/POST: note list + create
│   │   ├── notes/[...slug]/route.ts  # GET/PUT/DELETE: note CRUD
│   │   ├── presets/                  # GET/PUT: custom presets
│   │   ├── query/route.ts            # POST: RAG chat query
│   │   └── settings/                 # GET/PUT: settings
│   ├── (auth)/                       # Login, signup, verify-email, forgot/reset password
│   ├── account/page.tsx              # Account management
│   ├── page.tsx                      # Main app shell (all client state lives here)
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ChatPanel.tsx
│   ├── ConventionsEditor.tsx
│   ├── FolderTree.tsx
│   ├── GraphView.tsx
│   ├── NewNotePanel.tsx
│   ├── NoteViewer.tsx
│   ├── SettingsModal.tsx             # Vault mode switcher + RAG tokenise
│   ├── ToastStack.tsx
│   └── VaultModeBanner.tsx
├── lib/
│   ├── compiler/compile.ts
│   ├── conventions/defaults.ts
│   ├── db/
│   │   ├── index.ts                  # Drizzle client (pooler, prepare:false)
│   │   └── schema.ts                 # vault_notes + vault_embeddings tables
│   ├── embeddings/                   # cosine.ts, retrieve.ts, store.ts (legacy local FS)
│   ├── graph/parseLinks.ts
│   ├── llm/                          # LLMProvider interface + Anthropic/OpenAI impls
│   ├── rag/
│   │   ├── browserStore.ts           # Local RAG: read/write wiki/.rag-index.json via BrowserVaultAdapter
│   │   ├── cloudStore.ts             # Cloud RAG: upsert/query vault_embeddings table
│   │   └── hash.ts                   # SHA-256 content hashing (prevents re-indexing)
│   └── vault/
│       ├── VaultAdapter.ts           # Interface
│       ├── BrowserVaultAdapter.ts    # File System Access API (+ vault handle persistence in IndexedDB)
│       ├── CloudVaultAdapter.ts      # Drizzle/Supabase backed
│       ├── LocalVaultAdapter.ts      # Node.js fs (local dev / VPS)
│       ├── RemoteVaultAdapter.ts     # HTTP proxy to VPS
│       └── getAdapter.ts             # Factory: userId → cloud, else local/remote
├── drizzle/
│   └── 0000_dazzling_risque.sql      # vault_embeddings table (applied manually — drizzle-kit push has introspection bug)
├── vault/                            # Local vault (gitignored)
├── tests/
└── CLAUDE.md
```

---

## Vault Modes

Three modes, hot-swappable at runtime via Settings modal. Active mode persisted in `localStorage` key `knowledgeos.activeVaultMode`.

### Cloud vault (authenticated users)

- All note CRUD via `CloudVaultAdapter` → `vault_notes` Supabase table
- `getAdapter(userId)` returns cloud adapter when session user ID is present
- RAG embeddings stored in `vault_embeddings` Supabase table (pgvector)
- Embeddings auto-upserted (non-fatal try/catch) on: note create (`POST /api/notes`), note update (`PUT /api/notes/[slug]`), compile (`POST /api/compile`)
- Tokenise all: `POST /api/embeddings/index` with `{ folder: 'wiki' }` — server reads notes from cloud adapter, upserts to `vault_embeddings`

### Local vault (browser File System Access API)

- Chrome/Edge only — uses `window.showDirectoryPicker()`
- `BrowserVaultAdapter` reads/writes files directly from the user-selected folder
- Vault folder handle persisted in IndexedDB (`knowledgeos-local-vault`) for reload restore
- LLM calls (compile, embed, query) still hit Vercel API routes
- RAG index stored as **`wiki/.rag-index.json`** inside the vault folder — travels with the vault, immediately available across any browser/device that opens the same folder
- Tokenise: `handleLocalTokenise` in `page.tsx` batches notes (5 per request) to `POST /api/embeddings/index` with `notes: [{ slug, content }]` — server embeds concurrently via `Promise.all`, returns entries, client writes to `.rag-index.json`
- RAG query: browser fetches question embedding from `/api/embeddings/query`, runs cosine similarity against `.rag-index.json` locally

### Remote vault (VPS proxy)

- `VAULT_MODE=remote` → all requests proxied to `VPS_BASE_URL` via `RemoteVaultAdapter`
- Used for demo/unauthenticated users

### VPS proxy guard pattern

Routes that call `getVpsConfig()` must check auth first to prevent cloud requests being proxied to VPS:

```typescript
const session = await auth()
if (!session?.user?.id && getVpsConfig()) return proxyToVps(...)
const adapter = await getAdapter(session?.user?.id ?? undefined)
```

---

## Database

- **Supabase project:** `admczvnllexclfuznizc` (West EU — London)
- **DATABASE_URL:** must use the pooler URL (`aws-1-eu-west-2.pooler.supabase.com:6543`) — direct host does not resolve from dev machine or Vercel
- `prepare: false` required in Drizzle client for PgBouncer pooled connections
- `vault_embeddings` table created manually via psql (drizzle-kit push has introspection bug on existing schema)
- Migration SQL: `drizzle/0000_dazzling_risque.sql`

---

## Auth

- NextAuth v5 (`auth.ts` at root)
- Email/password credentials + email verification flow
- SMTP via PurelyMail (`knowledgeos@parrytech.co`)
- `session.user.id` is the Supabase user UUID used as the `userId` foreign key in all vault tables
- Test account: `e2e-1775867541@example.com` / `TestPass123!`

---

## LLM / Embedding

- Provider selected via `LLM_PROVIDER` env var (`openai` or `anthropic`)
- `getLLMProvider()` throws if the relevant API key is not set — must be configured on Vercel
- Embedding models: `text-embedding-3-small` (OpenAI), `voyage-3-lite` (Anthropic)
- Only wiki notes are indexed for RAG (raw notes RAG removed)

---

## Environment Variables

```bash
# Required on Vercel
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...          # or ANTHROPIC_API_KEY
DATABASE_URL=postgresql://...  # pooler URL
AUTH_SECRET=...
NEXT_PUBLIC_APP_URL=https://knoswmba.parrytech.co
SMTP_HOST=mailserver.purelymail.com
SMTP_PORT=587
SMTP_USER=knowledgeos@parrytech.co
SMTP_PASS=...
FROM_EMAIL=knowledgeos@parrytech.co

# Local dev only (.env.local — never commit)
VAULT_MODE=remote              # or local
VPS_BASE_URL=http://localhost:4000
VPS_API_TOKEN=...
AUTH_TRUST_HOST=true
```

---

## Running Locally

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # Vitest unit tests
```

### e2e test

```bash
NODE_PATH=/Users/parryh/knowledgeos/node_modules node /tmp/knowledgeos-e2e.cjs
```

Requires dev server on port 3000 and working DATABASE_URL.

---

## Key Constraints

- **Never commit secrets** — `.env.local` and `vault/` are gitignored
- **VaultAdapter abstraction** — all file I/O through the adapter interface
- **LLMProvider abstraction** — all LLM calls through the provider interface
- **Cloud-first auth check** — authenticated routes must check `session.user.id` before `getVpsConfig()`
- **Non-fatal embeddings** — all `upsertUserEmbedding` calls must be wrapped in try/catch so compile/save never fails due to embedding errors
- **Obsidian compatibility** — compiled output must be valid Obsidian markdown with `[[wikilinks]]`
- **TypeScript strict** — no implicit `any`
