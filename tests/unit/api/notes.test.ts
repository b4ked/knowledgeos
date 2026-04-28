import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import crypto from 'crypto'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}))

// --- helpers to invoke route handlers directly ---

function makeRequest(url: string, init?: RequestInit): Request {
  return new Request(url, init)
}

// We need to set VAULT_PATH before importing the route modules
// so we use dynamic imports inside each test after stubbing the env.

describe('GET /api/notes', () => {
  let vaultPath: string

  beforeEach(async () => {
    vaultPath = path.join(os.tmpdir(), crypto.randomUUID())
    await fs.mkdir(path.join(vaultPath, 'raw'), { recursive: true })
    await fs.mkdir(path.join(vaultPath, 'wiki'), { recursive: true })
    vi.stubEnv('VAULT_PATH', vaultPath)
    vi.stubEnv('SETTINGS_PATH', path.join(vaultPath, 'settings.json'))
  })

  afterEach(async () => {
    await fs.rm(vaultPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('returns array of NoteMetadata for folder=raw', async () => {
    await fs.writeFile(path.join(vaultPath, 'raw', 'note-a.md'), '# A', 'utf-8')
    await fs.writeFile(path.join(vaultPath, 'raw', 'note-b.md'), '# B', 'utf-8')

    const { GET } = await import('@/app/api/notes/route')
    const req = makeRequest('http://localhost/api/notes?folder=raw')
    const res = await GET(req as never)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(2)
    const slugs = data.map((n: { slug: string }) => n.slug).sort()
    expect(slugs).toEqual(['note-a', 'note-b'])
  })

  it('returns 400 when folder param is missing or invalid', async () => {
    const { GET } = await import('@/app/api/notes/route')
    const req = makeRequest('http://localhost/api/notes?folder=invalid')
    const res = await GET(req as never)
    expect(res.status).toBe(400)
  })

  it('returns empty array when folder is empty', async () => {
    const { GET } = await import('@/app/api/notes/route')
    const req = makeRequest('http://localhost/api/notes?folder=wiki')
    const res = await GET(req as never)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([])
  })
})

describe('POST /api/notes', () => {
  let vaultPath: string

  beforeEach(async () => {
    vaultPath = path.join(os.tmpdir(), crypto.randomUUID())
    vi.stubEnv('VAULT_PATH', vaultPath)
    vi.stubEnv('SETTINGS_PATH', path.join(vaultPath, 'settings.json'))
  })

  afterEach(async () => {
    await fs.rm(vaultPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('creates file on disk and returns NoteMetadata', async () => {
    const { POST } = await import('@/app/api/notes/route')
    const req = makeRequest('http://localhost/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: 'raw', filename: 'my-note', content: '# Hello' }),
    })
    const res = await POST(req as never)

    expect(res.status).toBe(201)
    const note = await res.json()
    expect(note.slug).toBe('my-note')
    expect(note.folder).toBe('raw')

    const onDisk = await fs.readFile(path.join(vaultPath, 'raw', 'my-note.md'), 'utf-8')
    expect(onDisk).toBe('# Hello')
  })

  it('appends .md to filename if not already present', async () => {
    const { POST } = await import('@/app/api/notes/route')
    const req = makeRequest('http://localhost/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: 'raw', filename: 'auto-ext.md', content: 'content' }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(201)

    const onDisk = await fs.readFile(path.join(vaultPath, 'raw', 'auto-ext.md'), 'utf-8')
    expect(onDisk).toBe('content')
  })

  it('returns 400 for invalid folder', async () => {
    const { POST } = await import('@/app/api/notes/route')
    const req = makeRequest('http://localhost/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: 'bad', filename: 'x', content: 'y' }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/notes/[slug]', () => {
  let vaultPath: string

  beforeEach(async () => {
    vaultPath = path.join(os.tmpdir(), crypto.randomUUID())
    await fs.mkdir(path.join(vaultPath, 'raw'), { recursive: true })
    vi.stubEnv('VAULT_PATH', vaultPath)
    vi.stubEnv('SETTINGS_PATH', path.join(vaultPath, 'settings.json'))
  })

  afterEach(async () => {
    await fs.rm(vaultPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('returns note content', async () => {
    await fs.writeFile(path.join(vaultPath, 'raw', 'test-note.md'), '# Test', 'utf-8')

    const { GET } = await import('@/app/api/notes/[...slug]/route')
    const req = makeRequest('http://localhost/api/notes/test-note?folder=raw')
    const res = await GET(req as never, { params: Promise.resolve({ slug: ['test-note'] }) })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.content).toBe('# Test')
  })

  it('returns 404 for missing note', async () => {
    const { GET } = await import('@/app/api/notes/[...slug]/route')
    const req = makeRequest('http://localhost/api/notes/ghost?folder=raw')
    const res = await GET(req as never, { params: Promise.resolve({ slug: ['ghost'] }) })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/notes/[slug]', () => {
  let vaultPath: string

  beforeEach(async () => {
    vaultPath = path.join(os.tmpdir(), crypto.randomUUID())
    await fs.mkdir(path.join(vaultPath, 'raw'), { recursive: true })
    vi.stubEnv('VAULT_PATH', vaultPath)
    vi.stubEnv('SETTINGS_PATH', path.join(vaultPath, 'settings.json'))
  })

  afterEach(async () => {
    await fs.rm(vaultPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('removes file from disk', async () => {
    await fs.writeFile(path.join(vaultPath, 'raw', 'to-delete.md'), 'bye', 'utf-8')

    const { DELETE } = await import('@/app/api/notes/[...slug]/route')
    const req = makeRequest('http://localhost/api/notes/to-delete?folder=raw', { method: 'DELETE' })
    const res = await DELETE(req as never, { params: Promise.resolve({ slug: ['to-delete'] }) })

    expect(res.status).toBe(204)
    await expect(fs.stat(path.join(vaultPath, 'raw', 'to-delete.md'))).rejects.toThrow()
  })

  it('returns 404 when deleting a note that does not exist', async () => {
    const { DELETE } = await import('@/app/api/notes/[...slug]/route')
    const req = makeRequest('http://localhost/api/notes/ghost?folder=raw', { method: 'DELETE' })
    const res = await DELETE(req as never, { params: Promise.resolve({ slug: ['ghost'] }) })

    expect(res.status).toBe(404)
  })
})
