import { config as dotenvConfig } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import express from 'express'
import cors from 'cors'
import fs from 'fs/promises'

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
app.use(express.json())

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
  const { rawPath, wikiPath } = req.body as { rawPath?: string; wikiPath?: string }
  await writeSettings({ rawPath: rawPath || undefined, wikiPath: wikiPath || undefined })
  res.json({ ok: true })
})

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`KnowledgeOS backend running on port ${PORT}`)
  console.log(`Vault: ${getVaultPath()}`)
})
