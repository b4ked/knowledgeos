<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# KnowledgeOS Agent Context (Canonical)

Last updated: 2026-04-19 (UTC)

## Purpose
KnowledgeOS is a Next.js 16 web app for building a personal wiki from raw notes using LLM compilation, graph exploration, and RAG chat.

## Repos and Runtime Surfaces
- Main app repo (this repo): `~/knowledgeos`
- Landing site code: `~/knowledgeos/landing` (same repo, separate Vercel project)
- VPS host alias: `parrytech-vps`
- Supabase project ref: `admczvnllexclfuznizc` (`knowledgeos`, West EU/London)

## Deployment Topology
- Vercel project `knowledgeos`
  - Project ID: `prj_YtIWy0m0R4uFqPJXlGMQlkCZ0VvR`
  - Root directory: `.`
  - Production URL: `https://knoswmba.parrytech.co`
- Vercel project `knowledgeos-landing`
  - Project ID: `prj_3wjhVMvK4JDePUhmk1ECPwbZvkKn`
  - Root directory: `landing`
  - Production URL: `https://knowledgeos.parrytech.co`
- VPS API endpoint: `https://knos-api.parrytech.co`
  - Nginx forwards to `127.0.0.1:4000`
  - PM2 process name: `knowledgeos-backend`
  - PM2 cwd: `/home/parryh/knowledgeos`
  - Start command: `npm run backend`

## Architecture (High Level)
- App framework: Next.js 16 App Router (`app/`)
- Main UI shell: `app/page.tsx`
- Auth: NextAuth v5 with credentials + optional GitHub OAuth (`auth.ts`)
- DB access: Drizzle + postgres.js (`lib/db/`)
- Vault abstraction: `lib/vault/VaultAdapter.ts` + adapters
  - Cloud: `CloudVaultAdapter` (Supabase tables)
  - Remote: `RemoteVaultAdapter` (VPS API)
  - Local browser: `BrowserVaultAdapter` (File System Access API)
- AI abstraction: `lib/llm/*`
  - Provider chosen via `LLM_PROVIDER` or conventions override
  - OpenAI embeddings: `text-embedding-3-small`
  - Anthropic path uses Voyage embeddings (`VOYAGE_API_KEY`)
- Graph: `lib/graph/*`
- Cloud RAG storage: `lib/rag/cloudStore.ts`

## Vault Mode Resolution (Critical)
Server mode is determined by auth + user prefs (`lib/vault/getAdapter.ts`):
- No user session => `remote`
- Session user => `cloud` unless `user_preferences.vault_mode = 'remote'`

Client has a local-browser mode for File System Access in `app/page.tsx`, persisted in localStorage.

## API Workflow Summary
Main routes in `app/api/*`:
- Notes: `/api/notes`, `/api/notes/[...slug]`
- Compile: `/api/compile`
- Query: `/api/query`
- Graph: `/api/graph`
- Embeddings: `/api/embeddings/{index,reindex,list,query,clear}`
- Insights: `/api/insights`
- Auth/account: `/api/auth/*`, `/api/account/*`
- Preferences: `/api/preferences`
- Upload/extraction proxy: `/api/upload`

Behavior pattern used repeatedly:
1. Check session / userId
2. Resolve vault mode
3. Cloud path for authenticated users
4. Remote proxy when mode is `remote` and VPS config exists
5. Local filesystem fallback otherwise

## Database Model Snapshot
`lib/db/schema.ts` + `drizzle/*.sql`:
- `users`
- `email_verification_tokens`
- `password_reset_tokens`
- `user_preferences`
- `vault_notes`
- `vault_embeddings`
- `daily_usage` (free-tier daily action limits)

`drizzle/0002_security_hardening.sql` enables RLS and creates owner policies for user-facing tables.

## Usage Limits
`lib/usage.ts`:
- Free users: `FREE_DAILY_LIMIT = 10`
- Combined compile + chat usage per UTC day
- Non-free plans treated as unlimited (`limit = -1`)

## Local Commands
From repo root:
- `npm install`
- `npm run dev`
- `npm run build`
- `npm test`
- `npm run test:e2e`
- `npm run backend` (Express VPS-style backend)
- `npm run db:generate|db:migrate|db:push|db:studio`

Landing-only (still from root):
- `cd landing && npm install && npm run dev`

## Environment Variables (Operational)
Core app/server:
- `DATABASE_URL` (Supabase pooler URL; required)
- `AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `LLM_PROVIDER=openai|anthropic`
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
- `VOYAGE_API_KEY` (needed when Anthropic provider does embeddings)

Remote/VPS routing:
- `VAULT_MODE=remote` (enables VPS proxy path)
- `VPS_BASE_URL`
- `VPS_API_TOKEN`
- Optional on Vercel: `VPS_PUBLIC_BASE_URL`

Email:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`

## Operational Facts Verified 2026-04-19
- Local git: `main` tracking `origin/main`, up to date.
- No `.github/workflows` in this repo.
- Vercel projects for both app and landing exist and are active.
- Supabase CLI links this workspace to `knowledgeos` (`admczvnllexclfuznizc`).
- VPS process `knowledgeos-backend` is online via PM2 behind Nginx.

## Known Risks / Gotchas
- Supabase CLI installed here is old (`v2.6.8`); project tooling may differ from current docs.
- PM2 restart count on VPS is high; error logs show historical path issues (`EACCES: mkdir '/Users'`) from bad path assumptions.
- `app/api/settings` requires auth and may proxy to VPS when VPS config is present.
- Upload flow depends on VPS extraction endpoint (`/api/upload`) and Python script `backend/scripts/markitdown_extract.py`.
- `.vercel/` should remain uncommitted; repo currently contains `.vercel/project.json` locally.

## Fast Verification Checklist
- App + landing projects visible: `vercel project ls`
- App deployments: `vercel ls --yes`
- Landing deployments: `vercel ls knowledgeos-landing --yes`
- Supabase link: `supabase projects list`
- VPS health: `ssh parrytech-vps 'pm2 ls && curl -s http://127.0.0.1:4000/health'`
