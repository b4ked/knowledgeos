import { config as dotenvConfig } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import express from 'express'
import cors from 'cors'
import fs from 'fs/promises'
import os from 'os'
import { randomUUID } from 'crypto'
import { z } from 'zod'

import { bearerAuth } from './middleware/auth.js'
import { LocalVaultAdapter } from '../lib/vault/LocalVaultAdapter.js'
import { parseLinks } from '../lib/graph/parseLinks.js'
import { compile } from '../lib/compiler/compile.js'
import { getLLMProvider } from '../lib/llm/getLLMProvider.js'
import { retrieveContext } from '../lib/embeddings/retrieve.js'
import { readMeta, readStore, upsertEmbedding, writeMeta, writeStore } from '../lib/embeddings/store.js'
import { DEFAULT_CONVENTIONS } from '../lib/conventions/defaults.js'
import { readSettings, writeSettings } from '../lib/vault/settings.js'
import type { NoteFolder } from '../lib/vault/VaultAdapter.js'
import type { Conventions } from '../lib/conventions/types.js'
import { normalizeRuntimeAdminSettings } from '../lib/admin/runtimeSettings.js'
import { extractMarkdownFromFile } from './uploadExtraction.js'
import { initVault } from '../lib/knowledge/vault/initVault.js'
import { scanVault } from '../lib/knowledge/vault/scanVault.js'
import { getPGliteDbPath, PGliteKnowledgeStore } from '../lib/knowledge/adapters/PGliteKnowledgeStore.js'

// Load backend/.env.local — env vars are read lazily at request time so hoisting is fine
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenvConfig({ path: path.resolve(__dirname, '.env.local') })

const app = express()
const PORT = process.env.PORT ?? 4000

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
// Increased limit for base64-encoded file uploads (50 MB file ≈ 68 MB base64)
app.use(express.json({ limit: '100mb' }))

// Health check — public, no auth required
app.get('/health', (_req, res) => {
  res.json({ ok: true, vault: getVaultPath() })
})

// ── Local-first PGlite vault API ─────────────────────────────────────────────

const vaultPathSchema = z.object({ path: z.string().min(1) })

app.post('/vault/open', async (req, res) => {
  const parsed = vaultPathSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
    return
  }

  try {
    const vault = await initVault(parsed.data.path)
    await vault.store.close()
    res.json({ workspace: vault.workspace, config: vault.config })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Could not open vault' })
  }
})

app.post('/vault/scan', async (req, res) => {
  const parsed = vaultPathSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
    return
  }

  try {
    res.json(await scanVault(parsed.data.path))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Could not scan vault' })
  }
})

app.get('/documents', async (req, res) => {
  const workspaceId = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : ''
  const vaultPath = typeof req.query.path === 'string' ? req.query.path : getVaultPath()
  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId is required' })
    return
  }

  const store = new PGliteKnowledgeStore(getPGliteDbPath(path.resolve(vaultPath)))
  try {
    await store.init()
    res.json(await store.listDocuments(workspaceId))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Could not list documents' })
  } finally {
    await store.close()
  }
})

app.get('/search', async (req, res) => {
  const workspaceId = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : ''
  const query = typeof req.query.q === 'string' ? req.query.q : ''
  const vaultPath = typeof req.query.path === 'string' ? req.query.path : getVaultPath()
  if (!workspaceId || !query) {
    res.status(400).json({ error: 'workspaceId and q are required' })
    return
  }

  const store = new PGliteKnowledgeStore(getPGliteDbPath(path.resolve(vaultPath)))
  try {
    await store.init()
    res.json(await store.searchChunks(workspaceId, query))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Could not search chunks' })
  } finally {
    await store.close()
  }
})

app.use('/api', (req, res, next) => {
  if (req.path === '/upload-public') {
    next()
    return
  }
  bearerAuth(req, res, next)
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function getVaultPath(): string {
  return process.env.VAULT_PATH
    ? path.resolve(process.env.VAULT_PATH)
    : path.resolve(__dirname, 'vault')
}

async function getAdapter(): Promise<LocalVaultAdapter> {
  const settings = await readSettings()
  const vaultPath = getVaultPath()
  const rawPath = settings.rawPath ? path.resolve(settings.rawPath) : undefined
  const wikiPath = settings.wikiPath ? path.resolve(settings.wikiPath) : undefined
  return new LocalVaultAdapter(vaultPath, rawPath, wikiPath)
}

function conventionsPath(): string {
  return path.join(getVaultPath(), 'CONVENTIONS.json')
}

async function getRuntimeSettings() {
  const settings = await readSettings()
  return { settings, admin: normalizeRuntimeAdminSettings(settings) }
}

// ── Notes ─────────────────────────────────────────────────────────────────────

app.get('/api/notes', async (req, res) => {
  const folder = req.query.folder as string
  if (folder !== 'raw' && folder !== 'wiki') {
    res.status(400).json({ error: 'folder must be raw or wiki' })
    return
  }
  const adapter = await getAdapter()
  await adapter.ensureDirectories()
  const notes = await adapter.listNotes(folder as NoteFolder)
  res.json(notes)
})

app.post('/api/notes', async (req, res) => {
  const { folder, filename, content } = req.body as {
    folder?: string; filename?: string; content?: string
  }
  if (folder !== 'raw' && folder !== 'wiki') {
    res.status(400).json({ error: 'folder must be raw or wiki' }); return
  }
  if (!filename || typeof filename !== 'string') {
    res.status(400).json({ error: 'filename is required' }); return
  }
  if (typeof content !== 'string') {
    res.status(400).json({ error: 'content is required' }); return
  }
  const safeFilename = filename.endsWith('.md') ? filename : `${filename}.md`
  const notePath = `${folder}/${safeFilename}`
  const adapter = await getAdapter()
  await adapter.ensureDirectories()
  await adapter.writeNote(notePath, content)
  const notes = await adapter.listNotes(folder as NoteFolder)
  const created = notes.find((n) => n.filename === safeFilename)
  if (!created) { res.status(500).json({ error: 'Note created but metadata not found' }); return }
  res.status(201).json(created)
})

app.get('/api/notes/*', async (req, res) => {
  const slugParts = (req.params as Record<string, string>)[0]
  const folder = req.query.folder as string
  if (folder !== 'raw' && folder !== 'wiki') {
    res.status(400).json({ error: 'folder must be raw or wiki' }); return
  }
  const notePath = `${folder}/${slugParts}.md`
  const adapter = await getAdapter()
  try {
    const content = await adapter.readNote(notePath)
    res.json({ content })
  } catch {
    res.status(404).json({ error: `Note not found: ${slugParts}` })
  }
})

app.delete('/api/notes/*', async (req, res) => {
  const slugParts = (req.params as Record<string, string>)[0]
  const folder = req.query.folder as string
  if (folder !== 'raw' && folder !== 'wiki') {
    res.status(400).json({ error: 'folder must be raw or wiki' }); return
  }
  const notePath = `${folder}/${slugParts}.md`
  const adapter = await getAdapter()
  try {
    await adapter.deleteNote(notePath)
    res.status(204).send()
  } catch {
    res.status(404).json({ error: `Note not found: ${slugParts}` })
  }
})

// ── Graph ─────────────────────────────────────────────────────────────────────

app.get('/api/graph', async (_req, res) => {
  const adapter = await getAdapter()
  await adapter.ensureDirectories()

  const [wikiMeta, rawMeta] = await Promise.all([
    adapter.listNotes('wiki'),
    adapter.listNotes('raw'),
  ])

  const [wikiNotes, rawNotes] = await Promise.all([
    Promise.all(wikiMeta.map(async (m) => ({
      slug: m.slug,
      content: await adapter.readNote(m.path).catch(() => ''),
      type: 'wiki' as const,
    }))),
    Promise.all(rawMeta.map(async (m) => ({
      slug: m.slug,
      content: await adapter.readNote(m.path).catch(() => ''),
      type: 'raw' as const,
    }))),
  ])

  res.json(parseLinks([...wikiNotes, ...rawNotes]))
})

// ── Compile ───────────────────────────────────────────────────────────────────

app.post('/api/compile', async (req, res) => {
  const { notePaths, outputFilename, conventions } = req.body as {
    notePaths?: string[]
    outputFilename?: string
    conventions?: Partial<Conventions>
  }
  if (!Array.isArray(notePaths) || notePaths.length === 0) {
    res.status(400).json({ error: 'notePaths must be a non-empty array' }); return
  }
  const vaultPath = getVaultPath()
  const { settings, admin } = await getRuntimeSettings()
  const requested = conventions ?? {}
  const effectiveConventions = admin.enforceGlobalModels
    ? {
        ...requested,
        compilationModel: admin.globalCompilationModel,
        queryModel: admin.globalQueryModel,
      }
    : requested
  const rawPath = settings.rawPath ? path.resolve(settings.rawPath) : undefined
  const wikiPath = settings.wikiPath ? path.resolve(settings.wikiPath) : undefined
  try {
    const result = await compile(notePaths, outputFilename, vaultPath, effectiveConventions, rawPath, wikiPath, {
      compileMaxTokens: admin.compileMaxOutputTokens,
      queryMaxTokens: admin.queryMaxOutputTokens,
      compilationModel: admin.globalCompilationModel,
      queryModel: admin.globalQueryModel,
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Compilation failed' })
  }
})

// ── Query ─────────────────────────────────────────────────────────────────────

app.post('/api/query', async (req, res) => {
  const { question } = req.body as { question?: string }
  if (!question || typeof question !== 'string' || !question.trim()) {
    res.status(400).json({ error: 'question is required' }); return
  }
  const vaultPath = getVaultPath()
  const { admin } = await getRuntimeSettings()
  const llm = getLLMProvider(undefined, {
    compileMaxTokens: admin.compileMaxOutputTokens,
    queryMaxTokens: admin.queryMaxOutputTokens,
    queryModel: admin.globalQueryModel,
  })
  const meta = await readMeta(vaultPath)
  const currentProvider = process.env.LLM_PROVIDER ?? 'anthropic'
  if (meta && meta.provider !== currentProvider) {
    res.status(409).json({
      error: `Embedding mismatch: vault indexed with '${meta.provider}' but current provider is '${currentProvider}'.`
    })
    return
  }
  try {
    const retrieved = await retrieveContext(question.trim(), vaultPath, llm)
    const answer = await llm.query(question.trim(), retrieved.map((r) => r.content))
    res.json({ answer, sources: retrieved.map((r) => r.slug) })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Query failed' })
  }
})

// ── Embeddings ────────────────────────────────────────────────────────────────

app.post('/api/embeddings/index', async (req, res) => {
  const { folder } = req.body as { folder?: string }
  if (folder !== 'raw' && folder !== 'wiki') {
    res.status(400).json({ error: 'folder must be raw or wiki' }); return
  }
  const vaultPath = getVaultPath()
  const adapter = await getAdapter()
  const { admin } = await getRuntimeSettings()
  const llm = getLLMProvider(undefined, {
    compileMaxTokens: admin.compileMaxOutputTokens,
    queryMaxTokens: admin.queryMaxOutputTokens,
    queryModel: admin.globalQueryModel,
  })
  const provider = process.env.LLM_PROVIDER ?? 'anthropic'
  const model = provider === 'openai' ? 'text-embedding-3-small' : 'voyage-3-lite'
  await adapter.ensureDirectories()
  const notes = await adapter.listNotes(folder as NoteFolder)
  const store = await readStore(vaultPath)
  let indexed = 0, skipped = 0
  const errors: string[] = []
  for (const note of notes) {
    if (store[note.slug] !== undefined) { skipped++; continue }
    try {
      const content = await adapter.readNote(note.path)
      const embedding = await llm.embed(content)
      await upsertEmbedding(vaultPath, note.slug, embedding)
      indexed++
    } catch (err) {
      errors.push(`${note.slug}: ${(err as Error).message}`)
    }
  }
  if (indexed > 0) await writeMeta(vaultPath, { provider, model, updatedAt: new Date().toISOString() })
  res.json({ indexed, skipped, total: notes.length, errors })
})

app.post('/api/embeddings/reindex', async (_req, res) => {
  const vaultPath = getVaultPath()
  const adapter = await getAdapter()
  const { admin } = await getRuntimeSettings()
  const llm = getLLMProvider(undefined, {
    compileMaxTokens: admin.compileMaxOutputTokens,
    queryMaxTokens: admin.queryMaxOutputTokens,
    queryModel: admin.globalQueryModel,
  })
  const provider = process.env.LLM_PROVIDER ?? 'anthropic'
  const model = provider === 'openai' ? 'text-embedding-3-small' : 'voyage-3-lite'
  await adapter.ensureDirectories()
  const notes = await adapter.listNotes('wiki')
  const results: { slug: string; ok: boolean; error?: string }[] = []
  for (const note of notes) {
    try {
      const content = await adapter.readNote(note.path)
      const embedding = await llm.embed(content)
      await upsertEmbedding(vaultPath, note.slug, embedding)
      results.push({ slug: note.slug, ok: true })
    } catch (err) {
      results.push({ slug: note.slug, ok: false, error: (err as Error).message })
    }
  }
  await writeMeta(vaultPath, { provider, model, updatedAt: new Date().toISOString() })
  res.json({ results })
})

app.delete('/api/embeddings/clear', async (_req, res) => {
  const vaultPath = getVaultPath()
  try {
    await writeStore(vaultPath, {})
    res.json({ ok: true, cleared: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to clear' })
  }
})

app.get('/api/embeddings/list', async (_req, res) => {
  const vaultPath = getVaultPath()
  try {
    const [store, meta] = await Promise.all([readStore(vaultPath), readMeta(vaultPath)])
    const slugs = Object.keys(store).sort()
    res.json({ slugs, meta })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to read embeddings' })
  }
})

// ── Conventions ───────────────────────────────────────────────────────────────

app.get('/api/conventions', async (_req, res) => {
  try {
    const raw = await fs.readFile(conventionsPath(), 'utf-8')
    res.json(JSON.parse(raw))
  } catch {
    res.json(DEFAULT_CONVENTIONS)
  }
})

app.put('/api/conventions', async (req, res) => {
  const body = req.body as Partial<Conventions>
  const merged: Conventions = { ...DEFAULT_CONVENTIONS, ...body }
  const vaultPath = getVaultPath()
  try {
    await fs.mkdir(vaultPath, { recursive: true })
    await fs.writeFile(conventionsPath(), JSON.stringify(merged, null, 2), 'utf-8')
    res.json(merged)
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save conventions' })
  }
})

// ── Settings ──────────────────────────────────────────────────────────────────

app.get('/api/settings', async (_req, res) => {
  const settings = await readSettings()
  res.json({ ...settings, ...normalizeRuntimeAdminSettings(settings) })
})

app.post('/api/settings', async (req, res) => {
  const {
    rawPath,
    wikiPath,
    presetsPath,
    globalCompilationModel,
    globalQueryModel,
    globalImageModel,
    enforceGlobalModels,
    compileMaxOutputTokens,
    queryMaxOutputTokens,
    imageExtractMaxOutputTokens,
    enableOpenAIImageEnrichment,
    ingestionMaxFilesPerJob,
    ingestionMaxFileSizeMb,
    ingestionRequestsPerMinute,
    ingestionMaxConcurrentJobsPerOwner,
  } = req.body as {
    rawPath?: string
    wikiPath?: string
    presetsPath?: string
    globalCompilationModel?: string
    globalQueryModel?: string
    globalImageModel?: string
    enforceGlobalModels?: boolean
    compileMaxOutputTokens?: number
    queryMaxOutputTokens?: number
    imageExtractMaxOutputTokens?: number
    enableOpenAIImageEnrichment?: boolean
    ingestionMaxFilesPerJob?: number
    ingestionMaxFileSizeMb?: number
    ingestionRequestsPerMinute?: number
    ingestionMaxConcurrentJobsPerOwner?: number
  }

  const normalized = normalizeRuntimeAdminSettings({
    globalCompilationModel,
    globalQueryModel,
    globalImageModel,
    enforceGlobalModels,
    compileMaxOutputTokens,
    queryMaxOutputTokens,
    imageExtractMaxOutputTokens,
    enableOpenAIImageEnrichment,
    ingestionMaxFilesPerJob,
    ingestionMaxFileSizeMb,
    ingestionRequestsPerMinute,
    ingestionMaxConcurrentJobsPerOwner,
  })

  await writeSettings({
    rawPath: rawPath || undefined,
    wikiPath: wikiPath || undefined,
    presetsPath: presetsPath || undefined,
    ...normalized,
  })
  res.json({ ok: true })
})

// ── Presets ───────────────────────────────────────────────────────────────────

async function getPresetsPath(): Promise<string> {
  const settings = await readSettings()
  return settings.presetsPath
    ? path.resolve(settings.presetsPath)
    : path.join(getVaultPath(), 'presets')
}

app.get('/api/presets', async (_req, res) => {
  const presetsDir = await getPresetsPath()
  try {
    await fs.mkdir(presetsDir, { recursive: true })
    const files = await fs.readdir(presetsDir)
    const names = files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5))
      .sort()
    res.json({ names })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list presets' })
  }
})

app.get('/api/presets/:name', async (req, res) => {
  const presetsDir = await getPresetsPath()
  const name = req.params.name.replace(/[^a-zA-Z0-9_\- ]/g, '')
  try {
    const raw = await fs.readFile(path.join(presetsDir, `${name}.json`), 'utf-8')
    res.json(JSON.parse(raw))
  } catch {
    res.status(404).json({ error: `Preset not found: ${name}` })
  }
})

app.put('/api/presets/:name', async (req, res) => {
  const presetsDir = await getPresetsPath()
  const name = req.params.name.replace(/[^a-zA-Z0-9_\- ]/g, '')
  try {
    await fs.mkdir(presetsDir, { recursive: true })
    await fs.writeFile(path.join(presetsDir, `${name}.json`), JSON.stringify(req.body, null, 2), 'utf-8')
    res.json({ ok: true, name })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save preset' })
  }
})

app.delete('/api/presets/:name', async (req, res) => {
  const presetsDir = await getPresetsPath()
  const name = req.params.name.replace(/[^a-zA-Z0-9_\- ]/g, '')
  try {
    await fs.unlink(path.join(presetsDir, `${name}.json`))
    res.status(204).send()
  } catch {
    res.status(404).json({ error: `Preset not found: ${name}` })
  }
})

// ── File import via markitdown ────────────────────────────────────────────────

const ALLOWED_UPLOAD_EXT = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff',
  '.txt', '.md', '.markdown', '.html', '.htm', '.csv',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.odt', '.ods', '.odp', '.rtf', '.xml', '.json',
])
const IMAGE_UPLOAD_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff',
])

type UploadRequestFile = { filename?: string; content?: string; mimeType?: string }

interface UploadResult {
  filename: string
  ok: boolean
  error?: string
  markdown?: string
  suggestedSlug?: string
  mimeType?: string
  inputTokens?: number
  outputTokens?: number
}

type JobStatus = 'created' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
type JobFileStatus = 'pending' | 'running' | 'completed' | 'failed'

interface IngestionJobFile {
  id: string
  filename: string
  mimeType?: string
  status: JobFileStatus
  error?: string
  suggestedSlug?: string
  outputPath?: string
  inputTokens: number
  outputTokens: number
  source: UploadRequestFile
}

interface IngestionJob {
  id: string
  ownerId: string
  status: JobStatus
  createdAt: string
  startedAt?: string
  completedAt?: string
  options: { writeRawNotes: boolean }
  files: IngestionJobFile[]
  totals: {
    totalFiles: number
    processedFiles: number
    successFiles: number
    failedFiles: number
    inputTokens: number
    outputTokens: number
  }
}

const ingestionJobs = new Map<string, IngestionJob>()
const ingestionRateCounters = new Map<string, { windowStart: number; count: number }>()

function buildUploadSlug(filename: string): string {
  const ext = path.extname(filename)
  return (
    path.basename(filename, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'imported-file'
  )
}

function estimateBase64Bytes(base64: string): number {
  const normalized = base64.replace(/\s+/g, '')
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding)
}

async function extractImageWithOpenAI(
  filePath: string,
  mimeType: string | undefined,
  model: string,
  maxOutputTokens: number,
): Promise<{ ok: boolean; markdown?: string; error?: string; inputTokens?: number; outputTokens?: number }> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return { ok: false, error: 'OPENAI_API_KEY is not set' }

  try {
    const { default: OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: key })
    const bytes = await fs.readFile(filePath)
    const effectiveMime = mimeType || 'image/png'
    const prompt = [
      'Extract any visible text and describe the image in detail for a knowledge base.',
      'Return markdown with these headings in order:',
      '## OCR Text',
      '## Image Description',
      '## Key Entities',
      'If a section has no data, write "None".',
    ].join('\n')

    const completion = await client.chat.completions.create({
      model,
      max_tokens: maxOutputTokens,
      messages: [
        { role: 'system', content: 'You convert image content into structured markdown for knowledge ingestion.' },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:${effectiveMime};base64,${bytes.toString('base64')}` },
            },
          ],
        },
      ],
    })

    const markdown = completion.choices[0]?.message.content?.trim()
    if (!markdown) return { ok: false, error: 'No content returned by OpenAI image extraction.' }
    return {
      ok: true,
      markdown,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'OpenAI image extraction failed.' }
  }
}

function parseUploadRequest(body: {
  files?: UploadRequestFile[]
  filename?: string
  content?: string
  mimeType?: string
}): UploadRequestFile[] {
  return Array.isArray(body.files)
    ? body.files
    : body.filename && body.content
      ? [{ filename: body.filename, content: body.content, mimeType: body.mimeType }]
      : []
}

function limitIngestionRequest(req: express.Request, perMinute: number): boolean {
  const key = `${req.ip || 'unknown'}:${req.path}`
  const now = Date.now()
  const current = ingestionRateCounters.get(key)
  if (!current || now - current.windowStart >= 60_000) {
    ingestionRateCounters.set(key, { windowStart: now, count: 1 })
    return true
  }
  if (current.count >= perMinute) return false
  current.count += 1
  return true
}

function ownerIdFromRequest(req: express.Request): string {
  const raw = (req.headers['x-owner-id'] as string | undefined) || (req.body as { ownerId?: string })?.ownerId
  const owner = (raw || 'default-owner').trim()
  return owner.replace(/[^a-zA-Z0-9_\-:@.]/g, '').slice(0, 100) || 'default-owner'
}

function runningJobCountForOwner(ownerId: string): number {
  let count = 0
  for (const job of ingestionJobs.values()) {
    if (job.ownerId !== ownerId) continue
    if (job.status === 'queued' || job.status === 'running') count++
  }
  return count
}

function toJobSummary(job: IngestionJob) {
  return {
    id: job.id,
    ownerId: job.ownerId,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    totals: job.totals,
    files: job.files.map((f) => ({
      id: f.id,
      filename: f.filename,
      mimeType: f.mimeType,
      status: f.status,
      error: f.error,
      suggestedSlug: f.suggestedSlug,
      outputPath: f.outputPath,
      inputTokens: f.inputTokens,
      outputTokens: f.outputTokens,
    })),
  }
}

async function processUploadFile(
  file: UploadRequestFile,
  admin: ReturnType<typeof normalizeRuntimeAdminSettings>,
): Promise<UploadResult> {
  const filename = file.filename?.trim() || 'upload'
  const base64Content = file.content
  const mimeType = file.mimeType
  const safeExt = path.extname(filename).toLowerCase()

  if (!base64Content) return { filename, ok: false, error: 'Missing file content.' }
  if (!ALLOWED_UPLOAD_EXT.has(safeExt)) {
    return { filename, ok: false, error: `Unsupported file type: ${safeExt || '(none)'}` }
  }
  const estimatedBytes = estimateBase64Bytes(base64Content)
  if (estimatedBytes > admin.ingestionMaxFileSizeMb * 1024 * 1024) {
    return { filename, ok: false, error: `File exceeds ${admin.ingestionMaxFileSizeMb}MB limit.` }
  }

  const tmpPath = path.join(os.tmpdir(), `kos-upload-${randomUUID()}${safeExt}`)
  try {
    await fs.writeFile(tmpPath, Buffer.from(base64Content, 'base64'))

    const extracted = await extractMarkdownFromFile(tmpPath)
    const useImageEnrichment = admin.enableOpenAIImageEnrichment && IMAGE_UPLOAD_EXT.has(safeExt)
    const vision = useImageEnrichment
      ? await extractImageWithOpenAI(
          tmpPath,
          mimeType,
          admin.globalImageModel,
          admin.imageExtractMaxOutputTokens,
        )
      : { ok: false as const }

    const parts: string[] = []
    if (extracted.ok && extracted.markdown?.trim()) parts.push(extracted.markdown.trim())
    if (vision.ok && vision.markdown?.trim()) {
      parts.push(`## OpenAI Image Enrichment\n\n${vision.markdown.trim()}`)
    }

    const mergedMarkdown = parts.join('\n\n---\n\n').trim()
    if (!mergedMarkdown) {
      return {
        filename,
        ok: false,
        error: vision.ok ? 'No text could be extracted from this file.' : (extracted.error ?? 'No text could be extracted from this file.'),
      }
    }

    return {
      filename,
      ok: true,
      markdown: mergedMarkdown,
      suggestedSlug: buildUploadSlug(filename),
      mimeType,
      inputTokens: vision.ok ? vision.inputTokens : 0,
      outputTokens: vision.ok ? vision.outputTokens : 0,
    }
  } finally {
    fs.unlink(tmpPath).catch(() => {})
  }
}

async function handleUploadRequest(req: express.Request, res: express.Response) {
  const { admin } = await getRuntimeSettings()
  if (!limitIngestionRequest(req, admin.ingestionRequestsPerMinute)) {
    res.status(429).json({ error: 'Upload rate limit exceeded. Try again in a minute.' })
    return
  }

  const body = req.body as {
    files?: UploadRequestFile[]
    filename?: string
    content?: string
    mimeType?: string
  }

  const files = parseUploadRequest(body)

  if (files.length === 0) {
    res.status(400).json({ error: 'files must be a non-empty array' }); return
  }
  if (files.length > admin.ingestionMaxFilesPerJob) {
    res.status(400).json({ error: `Upload up to ${admin.ingestionMaxFilesPerJob} files at a time.` }); return
  }

  const results: UploadResult[] = []
  for (const file of files) {
    results.push(await processUploadFile(file, admin))
  }

  res.json({ results })
}

app.post('/api/upload-public', handleUploadRequest)

app.post('/api/upload', handleUploadRequest)

// ── Async ingestion jobs ─────────────────────────────────────────────────────

async function processIngestionJob(jobId: string): Promise<void> {
  const job = ingestionJobs.get(jobId)
  if (!job || job.status === 'cancelled') return
  if (job.status !== 'queued' && job.status !== 'created') return

  const { admin } = await getRuntimeSettings()
  job.status = 'running'
  job.startedAt = new Date().toISOString()
  const adapter = await getAdapter()
  await adapter.ensureDirectories()

  for (const file of job.files) {
    if ((job.status as JobStatus) === 'cancelled') break
    if (file.status !== 'pending') continue

    file.status = 'running'
    const result = await processUploadFile(file.source, admin)
    if (!result.ok || !result.markdown) {
      file.status = 'failed'
      file.error = result.error ?? 'Extraction failed'
      job.totals.failedFiles += 1
      job.totals.processedFiles += 1
      continue
    }

    const slug = result.suggestedSlug ?? buildUploadSlug(file.filename)
    file.suggestedSlug = slug
    file.inputTokens = result.inputTokens ?? 0
    file.outputTokens = result.outputTokens ?? 0
    job.totals.inputTokens += file.inputTokens
    job.totals.outputTokens += file.outputTokens

    if (job.options.writeRawNotes) {
      const outputPath = `raw/${slug}-${job.id.slice(0, 8)}.md`
      await adapter.writeNote(outputPath, result.markdown)
      file.outputPath = outputPath
    }

    file.status = 'completed'
    job.totals.successFiles += 1
    job.totals.processedFiles += 1
  }

  if ((job.status as JobStatus) === 'cancelled') {
    job.completedAt = new Date().toISOString()
    return
  }

  job.status = job.totals.failedFiles > 0 ? 'failed' : 'completed'
  job.completedAt = new Date().toISOString()
}

app.post('/api/ingestion/jobs', async (req, res) => {
  const { admin } = await getRuntimeSettings()
  if (!limitIngestionRequest(req, admin.ingestionRequestsPerMinute)) {
    res.status(429).json({ error: 'Ingestion rate limit exceeded. Try again in a minute.' })
    return
  }

  const body = req.body as {
    files?: UploadRequestFile[]
    options?: { writeRawNotes?: boolean }
    ownerId?: string
  }
  const ownerId = ownerIdFromRequest(req)
  if (runningJobCountForOwner(ownerId) >= admin.ingestionMaxConcurrentJobsPerOwner) {
    res.status(429).json({
      error: `Too many active jobs for owner ${ownerId}. Limit: ${admin.ingestionMaxConcurrentJobsPerOwner}.`,
    })
    return
  }

  const files = Array.isArray(body.files) ? body.files : []
  if (files.length === 0) {
    res.status(400).json({ error: 'files must be a non-empty array' })
    return
  }
  if (files.length > admin.ingestionMaxFilesPerJob) {
    res.status(400).json({ error: `Job exceeds max files (${admin.ingestionMaxFilesPerJob}).` })
    return
  }

  const id = randomUUID()
  const now = new Date().toISOString()
  const job: IngestionJob = {
    id,
    ownerId,
    status: 'created',
    createdAt: now,
    options: { writeRawNotes: body.options?.writeRawNotes !== false },
    files: files.map((file) => ({
      id: randomUUID(),
      filename: file.filename?.trim() || 'upload',
      mimeType: file.mimeType,
      status: 'pending',
      source: file,
      inputTokens: 0,
      outputTokens: 0,
    })),
    totals: {
      totalFiles: files.length,
      processedFiles: 0,
      successFiles: 0,
      failedFiles: 0,
      inputTokens: 0,
      outputTokens: 0,
    },
  }
  ingestionJobs.set(id, job)
  res.status(201).json({ job: toJobSummary(job) })
})

app.get('/api/ingestion/jobs', (req, res) => {
  const ownerFilter = ((req.query.ownerId as string | undefined) || '').trim()
  const jobs = Array.from(ingestionJobs.values())
    .filter((j) => !ownerFilter || j.ownerId === ownerFilter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100)
    .map(toJobSummary)
  res.json({ jobs })
})

app.get('/api/ingestion/jobs/:id', (req, res) => {
  const job = ingestionJobs.get(req.params.id)
  if (!job) {
    res.status(404).json({ error: 'Job not found' })
    return
  }
  res.json({ job: toJobSummary(job) })
})

app.post('/api/ingestion/jobs/:id/files', async (req, res) => {
  const job = ingestionJobs.get(req.params.id)
  if (!job) {
    res.status(404).json({ error: 'Job not found' })
    return
  }
  if (job.status !== 'created' && job.status !== 'queued') {
    res.status(400).json({ error: `Cannot append files while job is ${job.status}` })
    return
  }
  const { admin } = await getRuntimeSettings()
  const body = req.body as { files?: UploadRequestFile[] }
  const files = Array.isArray(body.files) ? body.files : []
  if (files.length === 0) {
    res.status(400).json({ error: 'files must be a non-empty array' })
    return
  }
  if (job.files.length + files.length > admin.ingestionMaxFilesPerJob) {
    res.status(400).json({ error: `Job exceeds max files (${admin.ingestionMaxFilesPerJob}).` })
    return
  }
  for (const file of files) {
    job.files.push({
      id: randomUUID(),
      filename: file.filename?.trim() || 'upload',
      mimeType: file.mimeType,
      status: 'pending',
      source: file,
      inputTokens: 0,
      outputTokens: 0,
    })
  }
  job.totals.totalFiles = job.files.length
  res.json({ job: toJobSummary(job) })
})

app.post('/api/ingestion/jobs/:id/start', async (req, res) => {
  const job = ingestionJobs.get(req.params.id)
  if (!job) {
    res.status(404).json({ error: 'Job not found' })
    return
  }
  if (job.status === 'running' || job.status === 'completed' || job.status === 'cancelled') {
    res.status(400).json({ error: `Cannot start job in status: ${job.status}` })
    return
  }

  const { admin } = await getRuntimeSettings()
  if (runningJobCountForOwner(job.ownerId) >= admin.ingestionMaxConcurrentJobsPerOwner) {
    res.status(429).json({
      error: `Too many active jobs for owner ${job.ownerId}. Limit: ${admin.ingestionMaxConcurrentJobsPerOwner}.`,
    })
    return
  }

  job.status = 'queued'
  processIngestionJob(job.id).catch((err) => {
    const latest = ingestionJobs.get(job.id)
    if (!latest) return
    latest.status = 'failed'
    latest.completedAt = new Date().toISOString()
    console.error('ingestion job failed:', err)
  })
  res.json({ ok: true, job: toJobSummary(job) })
})

app.post('/api/ingestion/jobs/:id/retry', async (req, res) => {
  const job = ingestionJobs.get(req.params.id)
  if (!job) {
    res.status(404).json({ error: 'Job not found' })
    return
  }
  if (job.status === 'running' || job.status === 'queued') {
    res.status(400).json({ error: 'Cannot retry while job is active' })
    return
  }
  for (const file of job.files) {
    if (file.status === 'failed') {
      file.status = 'pending'
      file.error = undefined
      file.outputPath = undefined
      file.inputTokens = 0
      file.outputTokens = 0
    }
  }
  job.totals.processedFiles = job.files.filter((f) => f.status === 'completed').length
  job.totals.successFiles = job.files.filter((f) => f.status === 'completed').length
  job.totals.failedFiles = 0
  job.totals.inputTokens = job.files.reduce((sum, f) => sum + f.inputTokens, 0)
  job.totals.outputTokens = job.files.reduce((sum, f) => sum + f.outputTokens, 0)
  job.status = 'queued'
  job.completedAt = undefined

  processIngestionJob(job.id).catch((err) => {
    const latest = ingestionJobs.get(job.id)
    if (!latest) return
    latest.status = 'failed'
    latest.completedAt = new Date().toISOString()
    console.error('ingestion retry failed:', err)
  })
  res.json({ ok: true, job: toJobSummary(job) })
})

app.post('/api/ingestion/jobs/:id/cancel', (req, res) => {
  const job = ingestionJobs.get(req.params.id)
  if (!job) {
    res.status(404).json({ error: 'Job not found' })
    return
  }
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    res.status(400).json({ error: `Cannot cancel job in status: ${job.status}` })
    return
  }
  job.status = 'cancelled'
  job.completedAt = new Date().toISOString()
  res.json({ ok: true, job: toJobSummary(job) })
})

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`KnowledgeOS backend running on port ${PORT}`)
  console.log(`Vault: ${getVaultPath()}`)
})
