import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readStore, writeStore, upsertEmbedding, readMeta, writeMeta } from '@/lib/embeddings/store'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'store-test-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('readStore / writeStore', () => {
  it('returns empty object when file does not exist', async () => {
    const store = await readStore(tmpDir)
    expect(store).toEqual({})
  })

  it('round-trips data correctly', async () => {
    const data = { 'note-a': [1, 2, 3], 'note-b': [4, 5, 6] }
    await writeStore(tmpDir, data)
    const store = await readStore(tmpDir)
    expect(store).toEqual(data)
  })
})

describe('upsertEmbedding', () => {
  it('adds a new entry', async () => {
    await upsertEmbedding(tmpDir, 'my-note', [0.1, 0.2, 0.3])
    const store = await readStore(tmpDir)
    expect(store['my-note']).toEqual([0.1, 0.2, 0.3])
  })

  it('overwrites an existing entry', async () => {
    await upsertEmbedding(tmpDir, 'my-note', [1, 2, 3])
    await upsertEmbedding(tmpDir, 'my-note', [9, 8, 7])
    const store = await readStore(tmpDir)
    expect(store['my-note']).toEqual([9, 8, 7])
  })

  it('preserves other entries when upserting', async () => {
    await upsertEmbedding(tmpDir, 'note-a', [1, 2])
    await upsertEmbedding(tmpDir, 'note-b', [3, 4])
    const store = await readStore(tmpDir)
    expect(store['note-a']).toEqual([1, 2])
    expect(store['note-b']).toEqual([3, 4])
  })
})

describe('readMeta / writeMeta', () => {
  it('returns null when meta file does not exist', async () => {
    const meta = await readMeta(tmpDir)
    expect(meta).toBeNull()
  })

  it('round-trips meta correctly', async () => {
    const meta = { provider: 'openai', model: 'text-embedding-3-small', updatedAt: '2025-01-01T00:00:00.000Z' }
    await writeMeta(tmpDir, meta)
    const read = await readMeta(tmpDir)
    expect(read).toEqual(meta)
  })
})
