import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { describe, expect, it } from 'vitest'
import type { KnowledgeStore } from '@/lib/knowledge/adapters/KnowledgeStore'
import { PGliteKnowledgeStore } from '@/lib/knowledge/adapters/PGliteKnowledgeStore'
import { hashContent } from '@/lib/knowledge/vault/hashContent'

function contract(name: string, makeStore: () => Promise<{ store: KnowledgeStore; cleanup: () => Promise<void> }>) {
  describe(name, () => {
    it('supports the core KnowledgeStore contract', async () => {
      const { store, cleanup } = await makeStore()
      try {
        await store.init()
        const workspace = await store.createWorkspace({ name: 'Contract Vault', rootPath: '/tmp/contract-vault' })
        const document = await store.upsertDocument({
          workspaceId: workspace.id,
          path: 'wiki/refunds.md',
          title: 'Refunds',
          sourceType: 'markdown',
          contentHash: hashContent('Refund policy'),
          sizeBytes: 13,
        })
        const chunks = await store.replaceChunks(document.id, [{
          workspaceId: workspace.id,
          chunkIndex: 0,
          headingPath: ['Refunds'],
          content: 'Refund policy details',
          tokenEstimate: 6,
          contentHash: hashContent('Refund policy details'),
        }])
        const node = await store.upsertGraphNode({
          workspaceId: workspace.id,
          externalId: 'refunds',
          label: 'Refunds',
          type: 'topic',
        })
        const target = await store.upsertGraphNode({
          workspaceId: workspace.id,
          externalId: 'customers',
          label: 'Customers',
          type: 'topic',
        })
        const edge = await store.upsertGraphEdge({
          workspaceId: workspace.id,
          sourceNodeId: node.id,
          targetNodeId: target.id,
          type: 'mentions',
        })
        await store.appendSyncEvent({
          workspaceId: workspace.id,
          entityType: 'document',
          entityId: document.id,
          operation: 'create',
          payload: { path: document.path },
        })

        expect(await store.getWorkspace(workspace.id)).toMatchObject({ id: workspace.id })
        expect(await store.getDocumentByPath(workspace.id, 'wiki/refunds.md')).toMatchObject({ id: document.id })
        expect(await store.listDocuments(workspace.id)).toHaveLength(1)
        expect(chunks).toHaveLength(1)
        expect(edge.type).toBe('mentions')
        expect(await store.searchChunks(workspace.id, 'policy')).toHaveLength(1)
        expect(await store.listUnsyncedEvents(workspace.id)).toHaveLength(1)
      } finally {
        await store.close()
        await cleanup()
      }
    })
  })
}

contract('PGliteKnowledgeStore', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'knowx-contract-'))
  return {
    store: new PGliteKnowledgeStore(path.join(dir, '.knowx', 'db')),
    cleanup: async () => fs.rm(dir, { recursive: true, force: true }),
  }
})

