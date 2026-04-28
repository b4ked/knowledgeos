import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { initVault } from '@/lib/knowledge/vault/initVault'
import { scanVault } from '@/lib/knowledge/vault/scanVault'

describe('vault ingestion', () => {
  it('indexes markdown files and replaces changed chunks', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'knowx-ingest-'))
    try {
      await fs.mkdir(path.join(dir, 'notes'), { recursive: true })
      await fs.writeFile(path.join(dir, 'notes', 'refunds.md'), '# Refunds\n\nRefund rules apply.', 'utf-8')
      await fs.writeFile(path.join(dir, 'notes', 'tax.md'), '# Tax\n\nVAT notes.', 'utf-8')

      const vault = await initVault(dir)
      const first = await scanVault(dir, vault.store)
      const documents = await vault.store.listDocuments(vault.workspace.id)
      const before = await vault.store.getDocumentByPath(vault.workspace.id, 'notes/refunds.md')

      await fs.writeFile(path.join(dir, 'notes', 'refunds.md'), '# Refunds\n\nRefund rules changed.\n\n## Exceptions\n\nLate claims.', 'utf-8')
      const second = await scanVault(dir, vault.store)
      const after = await vault.store.getDocumentByPath(vault.workspace.id, 'notes/refunds.md')
      const results = await vault.store.searchChunks(vault.workspace.id, 'exceptions')

      await vault.store.close()

      expect(first.documentsIndexed).toBe(2)
      expect(first.chunksIndexed).toBeGreaterThanOrEqual(2)
      expect(documents).toHaveLength(2)
      expect(second.documentsIndexed).toBe(2)
      expect(second.chunksIndexed).toBeGreaterThan(0)
      expect(after?.contentHash).not.toBe(before?.contentHash)
      expect(results[0]?.documentPath).toBe('notes/refunds.md')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

