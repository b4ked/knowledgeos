@AGENTS.md

# KnowledgeOS — Agent Context

## What This Project Is

KnowledgeOS is an AI-native personal knowledge base web application. It turns raw source material (articles, documents, notes) into a structured, queryable wiki using LLM compilation, a D3-force knowledge graph, and RAG-powered chat — all built on Next.js with a local-first architecture.

**Repo:** `https://github.com/b4ked/knowledgeos`
**Local clone:** `~/knowledgeos/`
**Deployed:** Vercel (frontend) + parrytech-vps (backend/demo vault)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Graph Viz | D3-force v7 |
| LLM | Anthropic (Claude) or OpenAI (GPT-4o) — user configurable |
| Embeddings | voyage-3-lite / text-embedding-3-small |
| Vector search | In-memory cosine similarity (JSON store) |
| Testing | Vitest (unit) + Playwright (e2e) |
| Backend | Express.js (`backend/server.ts`) |
| Deployment | Vercel + parrytech-vps |

---

## Repository Structure

```
knowledgeos/
├── app/                        # Next.js App Router
│   ├── api/
│   │   ├── compile/route.ts    # POST: AI compilation
│   │   ├── conventions/        # GET/PUT: compilation conventions
│   │   ├── debug/              # Debug endpoint
│   │   ├── embeddings/         # Embeddings management
│   │   ├── graph/route.ts      # GET: graph data
│   │   ├── notes/              # GET/POST/DELETE: note CRUD
│   │   ├── presets/            # GET/PUT: custom presets
│   │   ├── query/route.ts      # POST: RAG chat query
│   │   └── settings/           # GET/PUT: settings
│   ├── page.tsx                # Main app shell (all state lives here)
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ChatPanel.tsx           # RAG chat + streaming
│   ├── ConventionsEditor.tsx   # Preset editor modal
│   ├── FolderTree.tsx          # Sidebar note list
│   ├── GraphView.tsx           # D3 force graph
│   ├── NewNotePanel.tsx        # Create + compile note
│   ├── NoteViewer.tsx          # Markdown renderer + wikilink nav
│   ├── RAGPanel.tsx            # RAG index management
│   ├── SettingsModal.tsx       # Settings + vault mode switcher
│   ├── ToastStack.tsx          # Toast notifications
│   └── VaultModeBanner.tsx     # Remote/local mode indicator
├── lib/
│   ├── compiler/compile.ts     # Core compilation logic
│   ├── conventions/defaults.ts # Built-in preset definitions
│   ├── embeddings/             # cosine.ts, retrieve.ts, store.ts
│   ├── graph/parseLinks.ts     # Wikilink parser → graph data
│   ├── llm/                    # LLMProvider interface + implementations
│   ├── toast/useToast.ts
│   └── vault/                  # VaultAdapter interface + 3 implementations
├── backend/
│   ├── server.ts               # Express server (runs on VPS)
│   ├── middleware/             # Auth middleware
│   └── vault/                  # Demo vault content
├── landing/                    # Standalone landing page (Vercel separate deploy)
├── vault/                      # Local vault (gitignored)
├── tests/                      # Vitest + Playwright tests
├── CLAUDE.md                   # This file
└── AGENTS.md                   # Next.js version rules
```

---

## Core Architecture Patterns

### VaultAdapter Pattern
All vault I/O goes through `VaultAdapter` interface (`lib/vault/VaultAdapter.ts`).
Three implementations:
- `LocalVaultAdapter` — Node.js `fs` (local development, `VAULT_MODE=local`)
- `RemoteVaultAdapter` — HTTP proxies to VPS backend (`VAULT_MODE=remote`, Vercel production)
- `BrowserVaultAdapter` — File System Access API (client-side, user switches in Settings)

`getAdapter()` factory in `lib/vault/getAdapter.ts` selects based on `VAULT_MODE` env var.

### LLMProvider Pattern
All LLM calls go through `LLMProvider` interface (`lib/llm/LLMProvider.ts`).
Two implementations: `AnthropicProvider`, `OpenAIProvider`.
`getLLMProvider()` factory reads `LLM_PROVIDER` from env.

### Vault Modes
- **Remote** (default on Vercel): all vault I/O proxied to VPS backend
- **Local**: client switches via Settings → `showDirectoryPicker()` → `BrowserVaultAdapter`

---

## Features Implemented

1. **Note CRUD** — raw + wiki notes, folder tabs, delete with confirmation
2. **AI Compilation** — select raw notes → LLM → structured wiki with wikilinks
3. **Knowledge Graph** — D3-force graph, click to open note, highlighted slugs from chat
4. **RAG Chat** — embed question → cosine similarity → top-K context → streaming LLM response with citations
5. **Presets/Conventions** — built-in presets (default, academic, legal, investing, technical, general) + custom saved presets
6. **RAG Index Panel** — per-folder tokenise, clear database
7. **Dual Vault Modes** — remote VPS demo vault or local browser vault
8. **Settings Modal** — API keys, provider, vault mode switcher
9. **Resizable panels** — sidebar + chat panel drag handles
10. **Keyboard shortcuts** — ⌘N, ⌘G, ⌘/, ⌘,
11. **Toast notifications** — success/error/info
12. **Onboarding state** — shown when vault is empty

---

## Current State

The MVP is fully implemented across all 6 milestones from the original implementation plan. The app is deployed on Vercel with a VPS backend serving the demo vault. Users can:
- Use the demo vault without any setup (remote mode)
- Switch to their own local vault via browser File System API (Chrome/Edge only)

**Planned next work:**
- User accounts (sign up / email verification)
- Stripe-integrated subscription tiers (Free / Starter / Pro / Team)
- Personal cloud vault hosting for paid users
- Billing and usage pages

---

## Environment Variables

```
# .env.local (never commit)
LLM_PROVIDER=openai           # or: anthropic
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
VAULT_PATH=./vault
VAULT_MODE=local              # local | remote
VPS_BASE_URL=http://...       # for remote mode
VPS_API_TOKEN=...             # for remote mode
```

---

## Running Locally

```bash
npm install
npm run dev          # http://localhost:3000
npm run backend      # VPS backend at http://localhost:4000
npm test             # Vitest unit tests
npm run test:e2e     # Playwright e2e tests
```

---

## Landing Page

The `landing/` subfolder is a standalone Next.js app deployed separately on Vercel. It is the public marketing site for KnowledgeOS. Do not confuse it with the main application. It has its own `package.json`, `next.config.ts`, and deployment config.

---

## Key Constraints

- **Never commit secrets** — `.env.local`, `vault/`, `CONVENTIONS.json` are gitignored
- **VaultAdapter abstraction** — all file I/O must go through the adapter, not raw `fs` calls
- **LLMProvider abstraction** — all LLM calls must go through the provider interface
- **Obsidian compatibility** — compiled output must be valid Obsidian markdown with `[[wikilinks]]`
- **TypeScript strict** — no implicit `any`, no untyped API responses
