import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { DEFAULT_CONVENTIONS } from '@/lib/conventions/defaults'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'conv-test-'))
  vi.stubEnv('VAULT_PATH', tmpDir)
  vi.resetModules()
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await fs.rm(tmpDir, { recursive: true, force: true })
})

async function importRoutes() {
  const mod = await import('@/app/api/conventions/route')
  return mod
}

describe('GET /api/conventions', () => {
  it('returns DEFAULT_CONVENTIONS when no file exists', async () => {
    const { GET } = await importRoutes()
    const res = await GET()
    const data = await res.json()
    expect(data.provider).toBe(DEFAULT_CONVENTIONS.provider)
    expect(data.compilationModel).toBe(DEFAULT_CONVENTIONS.compilationModel)
  })

  it('returns saved conventions when file exists', async () => {
    const saved = { ...DEFAULT_CONVENTIONS, provider: 'openai' as const, compilationModel: 'gpt-4.1-nano' }
    await fs.writeFile(path.join(tmpDir, 'CONVENTIONS.json'), JSON.stringify(saved), 'utf-8')
    const { GET } = await importRoutes()
    const res = await GET()
    const data = await res.json()
    expect(data.provider).toBe('openai')
    expect(data.compilationModel).toBe('gpt-4.1-nano')
  })
})

describe('PUT /api/conventions', () => {
  it('saves conventions and returns merged result', async () => {
    const { PUT } = await importRoutes()
    const update = { provider: 'openai' as const, compilationModel: 'gpt-4.1-nano' }
    const req = new Request('http://localhost/api/conventions', {
      method: 'PUT',
      body: JSON.stringify(update),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.provider).toBe('openai')
    expect(data.compilationModel).toBe('gpt-4.1-nano')
  })

  it('persists to disk', async () => {
    const { PUT } = await importRoutes()
    const update = { provider: 'openai' as const }
    const req = new Request('http://localhost/api/conventions', {
      method: 'PUT',
      body: JSON.stringify(update),
      headers: { 'Content-Type': 'application/json' },
    })
    await PUT(req)
    const raw = await fs.readFile(path.join(tmpDir, 'CONVENTIONS.json'), 'utf-8')
    const saved = JSON.parse(raw)
    expect(saved.provider).toBe('openai')
  })
})
