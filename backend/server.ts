import { config as dotenvConfig } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import express from 'express'
import cors from 'cors'
import fs from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import { randomUUID } from 'crypto'

const execFileAsync = promisify(execFile)

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

app.use(bearerAuth)

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
  const settings = await readSettings()
  const rawPath = settings.rawPath ? path.resolve(settings.rawPath) : undefined
  const wikiPath = settings.wikiPath ? path.resolve(settings.wikiPath) : undefined
  try {
    const result = await compile(notePaths, outputFilename, vaultPath, conventions ?? {}, rawPath, wikiPath)
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
  const llm = getLLMProvider()
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
  const llm = getLLMProvider()
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
  const llm = getLLMProvider()
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
  res.json(settings)
})

app.post('/api/settings', async (req, res) => {
  const { rawPath, wikiPath, presetsPath } = req.body as { rawPath?: string; wikiPath?: string; presetsPath?: string }
  await writeSettings({ rawPath: rawPath || undefined, wikiPath: wikiPath || undefined, presetsPath: presetsPath || undefined })
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

async function extractMarkdownFromFile(filePath: string): Promise<{ ok: boolean; markdown?: string; error?: string }> {
  const scriptPath = path.resolve(__dirname, 'scripts/markitdown_extract.py')
  const pythonCmd = process.env.MARKITDOWN_PYTHON?.trim() || 'python3'

  try {
    const { stdout } = await execFileAsync(pythonCmd, [scriptPath, filePath], {
      timeout: 60000,
      maxBuffer: 5 * 1024 * 1024,
    })
    const parsed = JSON.parse(stdout.trim()) as { ok?: boolean; markdown?: string; error?: string }
    if (!parsed.ok || !parsed.markdown) {
      return { ok: false, error: parsed.error ?? 'Could not extract text from this file.' }
    }
    return { ok: true, markdown: parsed.markdown }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not extract text from this file.',
    }
  }
}

app.post('/api/upload', async (req, res) => {
  const body = req.body as {
    files?: Array<{ filename?: string; content?: string; mimeType?: string }>
    filename?: string
    content?: string
    mimeType?: string
  }

  const files = Array.isArray(body.files)
    ? body.files
    : body.filename && body.content
      ? [{ filename: body.filename, content: body.content, mimeType: body.mimeType }]
      : []

  if (files.length === 0) {
    res.status(400).json({ error: 'files must be a non-empty array' }); return
  }
  if (files.length > 10) {
    res.status(400).json({ error: 'Upload up to 10 files at a time.' }); return
  }

  const results: Array<{
    filename: string
    ok: boolean
    error?: string
    markdown?: string
    suggestedSlug?: string
    mimeType?: string
  }> = []

  for (const file of files) {
    const filename = file.filename?.trim() || 'upload'
    const base64Content = file.content
    const mimeType = file.mimeType
    const safeExt = path.extname(filename).toLowerCase()

    if (!base64Content) {
      results.push({ filename, ok: false, error: 'Missing file content.' })
      continue
    }
    if (!ALLOWED_UPLOAD_EXT.has(safeExt)) {
      results.push({ filename, ok: false, error: `Unsupported file type: ${safeExt || '(none)'}` })
      continue
    }

    const tmpPath = path.join(os.tmpdir(), `kos-upload-${randomUUID()}${safeExt}`)

    try {
      await fs.writeFile(tmpPath, Buffer.from(base64Content, 'base64'))
      const extracted = await extractMarkdownFromFile(tmpPath)
      if (!extracted.ok || !extracted.markdown?.trim()) {
        results.push({
          filename,
          ok: false,
          error: extracted.error ?? 'No text could be extracted from this file.',
        })
        continue
      }

      results.push({
        filename,
        ok: true,
        markdown: extracted.markdown,
        suggestedSlug: buildUploadSlug(filename),
        mimeType,
      })
    } finally {
      fs.unlink(tmpPath).catch(() => {})
    }
  }

  res.json({ results })
})

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`KnowledgeOS backend running on port ${PORT}`)
  console.log(`Vault: ${getVaultPath()}`)
})
