import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { PGliteKnowledgeStore } from '@/lib/knowledge/adapters/PGliteKnowledgeStore'
import { hashContent } from '@/lib/knowledge/vault/hashContent'

describe('PGliteKnowledgeStore', () => {
  it('persists documents after reopening', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'knowx-pglite-'))
    const dbPath = path.join(dir, '.knowx', 'db')

    try {
      const store = new PGliteKnowledgeStore(dbPath)
      await store.init()
      const workspace = await store.createWorkspace({ name: 'Temp Vault', rootPath: dir })
      await store.upsertDocument({
        workspaceId: workspace.id,
        path: 'notes/example.md',
        title: 'Example',
        sourceType: 'markdown',
        contentHash: hashContent('hello'),
        sizeBytes: 5,
      })
      await store.close()

      const reopened = new PGliteKnowledgeStore(dbPath)
      await reopened.init()
      const document = await reopened.getDocumentByPath(workspace.id, 'notes/example.md')
      await reopened.close()

      expect(document).toMatchObject({ path: 'notes/example.md', title: 'Example' })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

