# KnowledgeOS

KnowledgeOS is a Next.js frontend with a filesystem-backed backend for compiling, indexing, graphing, and querying a markdown knowledge vault.

This branch refactors the app for an online split deployment:

- `knos.parrytech.co` runs on Vercel
- the frontend keeps calling `/api/*`
- Vercel route handlers proxy those requests to a backend service in [`backend/`](./backend)
- the backend runs on `parrytech-vps` against a persistent vault directory on disk

## Repository layout

```text
.
├── app/                 # Next.js frontend + thin proxy route handlers
├── backend/             # VPS backend service
├── components/          # Client UI
├── lib/server/          # Shared server logic used by both frontend and backend
└── vault/               # Local dev vault only
```

## Local development

### Local-only mode

This preserves the original local-first behavior. Leave `KNOWLEDGEOS_BACKEND_URL` unset in `.env.local`.

```bash
npm install
npm run dev
```

### Split-stack mode

Run the backend and frontend separately so the frontend exercises the online proxy path:

```bash
# terminal 1
cd backend
npm install
cp .env.example .env
npm run dev

# terminal 2
cp .env.example .env.local
npm install
npm run dev
```

Set these values for split-stack mode:

Frontend `.env.local`:

```bash
KNOWLEDGEOS_BACKEND_URL=http://127.0.0.1:8787
KNOWLEDGEOS_BACKEND_SHARED_SECRET=replace-me
```

Backend `.env`:

```bash
PORT=8787
VAULT_PATH=../vault
LLM_PROVIDER=openai
OPENAI_API_KEY=...
KNOWLEDGEOS_PROXY_SECRET=replace-me
```

The two secret values must match.

## Online deployment

### 1. DNS

Create these records:

- `knos.parrytech.co` -> Vercel project
- `knos-api.parrytech.co` -> A record to the VPS IP

### 2. Vercel

Deploy the repo root as a Next.js project.

Add these environment variables in Vercel:

```bash
KNOWLEDGEOS_BACKEND_URL=https://knos-api.parrytech.co
KNOWLEDGEOS_BACKEND_SHARED_SECRET=<long-random-shared-secret>
```

Only the route handlers use these values. They are not exposed to the browser.

### 3. Backend on the VPS

Clone or sync this repo to:

```bash
/home/parryh/apps/knowledgeos
```

Use a persistent vault path outside the repo so deploys do not touch data:

```bash
/home/parryh/apps/knowledgeos-data/vault
```

Create `backend/.env` on the VPS:

```bash
PORT=8787
VAULT_PATH=/home/parryh/apps/knowledgeos-data/vault
LLM_PROVIDER=openai
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=
VOYAGE_API_KEY=
KNOWLEDGEOS_PROXY_SECRET=<same-secret-as-vercel>
```

Build and run:

```bash
cd /home/parryh/apps/knowledgeos/backend
npm install
npm run build
node dist/backend/src/index.js
```

Production service files are included here:

- `backend/deploy/knowledgeos-backend.service`
- `backend/deploy/nginx-knos-api.conf`

### 4. Secrets

Vercel:

- `KNOWLEDGEOS_BACKEND_URL`
- `KNOWLEDGEOS_BACKEND_SHARED_SECRET`

Backend VPS:

- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
- `VOYAGE_API_KEY` if using `LLM_PROVIDER=anthropic`
- `KNOWLEDGEOS_PROXY_SECRET`
- `VAULT_PATH`

## Verification

The branch has been verified with:

- `npm test` at the repo root
- `cd backend && npm run build`
- `KNOWLEDGEOS_BACKEND_URL=... KNOWLEDGEOS_BACKEND_SHARED_SECRET=... npm run build`
- split-stack live tests:
  - proxied note listing
  - proxied graph fetch
  - proxied compile
  - proxied embeddings reindex
  - proxied query
  - direct backend auth rejection without the shared secret
