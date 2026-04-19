# KnowledgeOS Mass Ingestion Pipeline + Admin Token Controls (Implementation Plan)

Date: 2026-04-19

## Goal
Build a production-ready bulk ingestion pipeline so admins/users can quickly import large corpora (PDF, text/markdown, office docs, images) into KnowledgeOS, with:
- high-throughput processing on VPS,
- usage + rate limits,
- robust job visibility and retries,
- OpenAI-assisted image text extraction/description where needed,
- admin-configurable output token limits so compiled notes are longer and more useful.

## Implementation Progress (updated 2026-04-19)
- Completed: runtime admin settings schema + normalization (`lib/admin/runtimeSettings.ts`) with token and ingestion limits.
- Completed: settings persistence and API wiring for token/ingestion controls (`app/api/settings/route.ts`, `backend/server.ts`, `lib/vault/settings.ts`).
- Completed: admin settings UI controls for compile/query/image token budgets + ingestion limits (`components/SettingsModal.tsx`).
- Completed: provider runtime token cap wiring in both OpenAI and Anthropic providers (`lib/llm/OpenAIProvider.ts`, `lib/llm/AnthropicProvider.ts`, `lib/llm/getLLMProvider.ts`).
- Completed: compile/query backend paths now read settings and enforce runtime token caps (`app/api/compile/route.ts`, `app/api/query/route.ts`, `backend/server.ts`).
- Completed: VPS async ingestion job API with create/start/status/retry/cancel and per-file progress (`backend/server.ts`):
  - `POST /api/ingestion/jobs`
  - `GET /api/ingestion/jobs`
  - `GET /api/ingestion/jobs/:id`
  - `POST /api/ingestion/jobs/:id/files`
  - `POST /api/ingestion/jobs/:id/start`
  - `POST /api/ingestion/jobs/:id/retry`
  - `POST /api/ingestion/jobs/:id/cancel`
- Completed: ingestion request rate limiting + per-job/per-file caps enforced from settings (`backend/server.ts`, `app/api/upload/route.ts`).
- Completed: optional OpenAI image enrichment merged into extraction output when enabled (`backend/server.ts`).
- Completed: Next API ingestion proxy endpoints for app access to VPS jobs:
  - `app/api/ingestion/jobs/route.ts`
  - `app/api/ingestion/jobs/[id]/route.ts`
  - `app/api/ingestion/jobs/[id]/[action]/route.ts`
- Completed: frontend upload switched from sequential one-file requests to batched upload request (`app/page.tsx`).
- Completed: moved global ingestion/output/model controls from user settings into admin-only platform controls:
  - DB schema: `users.is_admin`, new `platform_settings` table
  - Admin APIs:
    - `GET /api/admin/users`
    - `PATCH /api/admin/users/:id`
    - `GET/PUT /api/admin/platform-settings`
    - `POST /api/admin/bootstrap` (self-promote when no admin exists)
  - Admin UI:
    - `/admin` dashboard with:
      - all users list + plan/admin role management
      - global chat/compile/image model settings
      - global token output limits
      - global ingestion limits
- Completed: session/auth now includes admin role in JWT/session payloads and UI (`auth.ts`, `auth.config.ts`, `types/next-auth.d.ts`, `components/UserMenu.tsx`).
- Completed: compile/query/upload now resolve global platform settings so admin controls apply across users.
- Completed: existing personal settings modal no longer exposes global ingestion/output controls (admin dashboard is source of truth).
- Completed: admin user accounts promoted for owner operation.

## Validation Completed (2026-04-19)
- Unit tests:
  - `npm run test -- tests/unit/llm/OpenAIProvider.test.ts tests/unit/llm/AnthropicProvider.test.ts tests/unit/llm/getLLMProvider.test.ts` (pass)
  - `npm run test -- tests/unit/compiler/compile.test.ts` (pass)
- Build/typecheck:
  - `npm run build` (pass)
- Backend smoke test (local):
  - started backend with `npm run backend`
  - created ingestion job with one file
  - started job and fetched status
  - observed terminal status `completed` with `processed=1`, `success=1`
- Admin controls validation:
  - `npm run build` passes with new admin routes/page and platform settings wiring
  - targeted tests pass:
    - `tests/unit/admin/runtimeSettings.test.ts`
    - `tests/unit/llm/getLLMProvider.test.ts`
  - backend health check passes after settings changes
- Full unit test suite status:
  - `npm run test` currently has pre-existing unrelated failures in `tests/unit/api/*` and `tests/unit/graph/parseLinks.test.ts` (module resolution + existing assertion mismatch), while modified feature areas pass targeted tests and build/typecheck.

## Remaining Work
- Implement DB-backed ingestion job persistence (currently in-memory job store in backend process).
- Add dedicated admin page/tab for ingestion job monitoring (current UI exposes limits and batched upload only).
- Add full job-oriented frontend UX (polling progress, retry/cancel controls, failed-file filters).
- Add per-user authenticated ownership model for jobs (currently owner ID is request-provided; suitable for initial internal control but not strict multi-tenant auth).
- Add daily ingestion byte/token quotas in database and dashboards.

## Current Baseline (from repo)
- Upload extraction exists via VPS endpoint in `backend/server.ts` (`/api/upload`, `/api/upload-public`) and uses `backend/scripts/markitdown_extract.py`.
- Frontend import exists in `app/page.tsx` + `components/FileImportModal.tsx`, but uploads are sequential and capped (`<=10` files/request).
- Settings persistence exists in `lib/vault/settings.ts` and `/api/settings` routes with `SettingsModal` UI.
- LLM output token caps are hardcoded in providers:
  - `lib/llm/OpenAIProvider.ts` compile `max_tokens: 8192`, query `max_tokens: 2048`
  - `lib/llm/AnthropicProvider.ts` compile `max_tokens: 8192`, query `max_tokens: 2048`
- Usage limiting currently tracks action count/day (`lib/usage.ts`, `drizzle/0001_daily_usage.sql`), not token or ingestion byte volume.

## Target Architecture
### 1) Async Bulk Ingestion Jobs (VPS-first)
Implement an async ingestion job system on VPS instead of synchronous one-request extraction.

Flow:
1. Client creates import job (`POST /api/ingestion/jobs`) with files metadata and options.
2. Files uploaded in chunks/batches (or pre-signed upload strategy if moving to object storage later).
3. Job enqueued; worker processes files with concurrency controls.
4. Per-file results stored (success/failure, extracted markdown, image caption/OCR, warnings).
5. Client polls/streams progress (`GET /api/ingestion/jobs/:id`) and can retry failed files.

### 2) Multi-Stage Extractor Pipeline per file
For each file:
1. Detect type + validate policy.
2. Primary extraction:
   - Text/Office/PDF via MarkItDown.
3. Image enrichment path:
   - If file is image or low-text PDF pages, call OpenAI vision-capable model for:
     - OCR-like text extraction,
     - semantic scene/diagram description,
     - optional structured fields (title, entities, tags).
4. Normalize output into internal markdown contract:
   - `source_metadata` block (filename, mime, hash, extractor, confidence)
   - clean markdown body
5. Write raw note(s), then optional auto-compile into wiki note(s).

### 3) Rate Limits + Usage Controls
Add two limit layers:

1. Request protection (API edge):
- per-user/IP request rate limits for ingestion endpoints.
- burst + sustained windows.

2. Workload quotas (business logic):
- daily ingestion caps by plan/admin policy:
  - files/day
  - MB/day
  - tokens/day (extraction + compilation)
- per-job caps:
  - max files/job
  - max file size
  - max concurrent jobs/user

### 4) Admin Token Controls for Output Length
Add admin settings to control generation token budgets so compiled docs can be substantially longer.

New settings (global + optional per-plan overrides):
- `compile_max_output_tokens`
- `query_max_output_tokens`
- `image_extract_max_output_tokens`
- optional safety clamps:
  - `compile_max_input_tokens`
  - `max_context_notes`

Provider integration:
- Replace hardcoded `max_tokens` in `OpenAIProvider` and `AnthropicProvider` with runtime settings (with sane defaults + hard upper bounds).
- Surface active values in UI so admin can verify effective limits.

## Data Model Changes
Add ingestion tables (Drizzle migration):
- `ingestion_jobs`
  - id, user_id, status, created_at, started_at, completed_at
  - total_files, processed_files, success_files, failed_files
  - total_bytes, total_input_tokens, total_output_tokens
  - options JSON
- `ingestion_job_files`
  - id, job_id, filename, mime_type, size_bytes, checksum
  - status, error_message
  - extractor (`markitdown`, `openai_vision`, `hybrid`)
  - output_note_path(s), input_tokens, output_tokens, duration_ms
- `usage_counters_daily` (extend/replace current action count model)
  - user_id, date, ingestion_files, ingestion_bytes, input_tokens, output_tokens, compile_count, chat_count
- `admin_settings` (or extend vault settings storage path with secure server-side values)
  - token + quota controls listed above

## API Surface (proposed)
- `POST /api/ingestion/jobs` create job
- `POST /api/ingestion/jobs/:id/files` upload file batch
- `POST /api/ingestion/jobs/:id/start` enqueue processing
- `GET /api/ingestion/jobs/:id` status + progress
- `POST /api/ingestion/jobs/:id/retry` retry failed files
- `POST /api/ingestion/jobs/:id/cancel` cancel
- `GET /api/ingestion/jobs?cursor=` job history

Settings:
- extend existing `/api/settings` for vault paths,
- add `/api/admin/settings/llm` for token/quota policy (admin-only),
- add `/api/admin/usage` for dashboards and enforcement debugging.

## UI Changes
### Admin Settings Page
Add a dedicated admin section (or modal tab):
- Token Budget Controls
  - compile max output tokens
  - query max output tokens
  - image extraction token budget
- Ingestion Limits
  - max files/job
  - max file size
  - daily file/MB/token quotas
  - max concurrency per user
- Safety + cost guardrails
  - hard cap display and validation errors

### Bulk Import UX
Upgrade `FileImportModal` and import flow:
- drag/drop large batches (not just 10)
- background job progress bar + per-file statuses
- retry failed files only
- filter by failure reason
- optional "auto-compile after extraction"

## VPS/Worker Execution Strategy
Phase 1 implementation can use in-process queue with strict concurrency + persistence in DB.
Phase 2 should move to dedicated queue/worker (BullMQ/Redis or equivalent) for resilience.

Worker requirements:
- idempotent file processing (checksum + job-file state)
- retry policy with exponential backoff
- timeout per file + watchdog
- dead-letter terminal failure state
- metrics logging (latency, token usage, extraction success by mime type)

## OpenAI Image Path (practical policy)
Use OpenAI only when needed to control spend:
- image inputs always eligible,
- PDFs route to OpenAI vision only when MarkItDown text confidence/length is below threshold,
- admin switch: `enable_openai_image_enrichment`.

Prompt output contract:
- `extracted_text`
- `detailed_description`
- `key_entities`
- `quality_notes`

Then merge with MarkItDown text into one markdown artifact with provenance notes.

## Security & Governance
- Keep `/api/upload-public` disabled by default for production admin-only instances.
- Require auth + role check for all ingestion + admin settings routes.
- Validate extension + MIME + magic bytes.
- Malware scan hook point before processing (optional but recommended).
- Store hashes and audit trails for every ingested file.

## Implementation Phases
## Phase 0: Foundations (1-2 days)
- Define settings schema for token/limit controls.
- Add migration skeleton for ingestion + usage tables.
- Add shared validators and constants.

## Phase 1: Token Controls + Admin UI (2-3 days)
- Add admin settings API + UI.
- Wire provider `max_tokens` to settings.
- Add tests for caps and fallback defaults.

## Phase 2: Async Ingestion Job Backend (4-6 days)
- Add ingestion job endpoints + DB persistence.
- Move extraction out of synchronous upload response.
- Add worker loop + retries + status transitions.

## Phase 3: Image Enrichment (2-4 days)
- Add OpenAI vision extraction adapter.
- Add confidence/threshold routing logic.
- Persist token usage + provenance metadata.

## Phase 4: Frontend Bulk Import Upgrade (3-4 days)
- Job-oriented import modal with progress, cancel, retry.
- Higher batch support with chunked upload.

## Phase 5: Rate Limits + Observability (2-3 days)
- Request limiter middleware.
- Daily quota enforcement per user/plan.
- Admin usage dashboard + alerting hooks.

## Testing Strategy
- Unit tests:
  - settings validation
  - quota checks
  - token cap propagation to provider calls
- Integration tests:
  - create job -> upload -> process -> compile
  - mixed corpus with partial failures
  - retry and cancel semantics
- E2E:
  - admin sets high compile output token cap and verifies longer compiled note output
  - upload corpus containing PDF + DOCX + images and confirm notes appear in raw/wiki

## Definition of Done
- Admin can configure token output limits in UI and they are enforced in runtime calls.
- User/admin can ingest large corpus asynchronously with clear progress + retries.
- MarkItDown handles text/office/PDF baseline; OpenAI image path enriches image/low-text content.
- Usage and rate limits are enforced and visible.
- Full audit trail for ingested files and token spend exists.

## Recommended First Build Slice
Implement first in this order to unblock value quickly:
1. Admin token controls + provider wiring.
2. Ingestion job schema and status API.
3. Workerized MarkItDown extraction.
4. Frontend job progress UI.
5. OpenAI image enrichment toggle.
6. Quotas and advanced rate limiting.
