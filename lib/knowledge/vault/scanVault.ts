import fs from 'fs/promises'
import path from 'path'
import type { KnowledgeStore } from '../adapters/KnowledgeStore'
import { chunkMarkdown } from './chunkMarkdown'
import { hashContent } from './hashContent'
import { initVault } from './initVault'
import type { VaultConfig } from '../types/models'

const IGNORED_DIRS = new Set(['.knowx', 'node_modules', '.git', 'dist', 'build'])

export type ScanVaultResult = {
  workspaceId: string
  documentsIndexed: number
  chunksIndexed: number
}

export async function scanVault(vaultPathInput: string, existingStore?: KnowledgeStore): Promise<ScanVaultResult> {
  const vault = existingStore
    ? null
    : await initVault(vaultPathInput)
  const store = existingStore ?? vault!.store
  const rootPath = path.resolve(vaultPathInput)
  const config = vault?.config ?? await readVaultConfig(rootPath)
  const workspace = vault?.workspace ?? (await store.createWorkspace({
    id: config?.vaultId,
    name: config?.vaultName ?? path.basename(rootPath),
    rootPath,
  }))

  try {
    const files = await findMarkdownFiles(path.resolve(vaultPathInput))
    let documentsIndexed = 0
    let chunksIndexed = 0

    for (const filePath of files) {
      const content = await fs.readFile(filePath, 'utf-8')
      const stats = await fs.stat(filePath)
      const relativePath = path.relative(path.resolve(vaultPathInput), filePath).replace(/\\/g, '/')
      const previous = await store.getDocumentByPath(workspace.id, relativePath)
      const contentHash = hashContent(content)
      const document = await store.upsertDocument({
        workspaceId: workspace.id,
        path: relativePath,
        title: extractTitle(content) ?? path.basename(filePath, '.md'),
        sourceType: 'markdown',
        contentHash,
        sizeBytes: stats.size,
      })

      if (!previous || previous.contentHash !== contentHash) {
        const chunks = await store.replaceChunks(document.id, chunkMarkdown(content, workspace.id))
        chunksIndexed += chunks.length
        await store.appendSyncEvent({
          workspaceId: workspace.id,
          entityType: 'document',
          entityId: document.id,
          operation: previous ? 'update' : 'create',
          payload: { path: relativePath, contentHash },
        })
        for (const chunk of chunks) {
          await store.appendSyncEvent({
            workspaceId: workspace.id,
            entityType: 'chunk',
            entityId: chunk.id,
            operation: 'replace',
            payload: { documentId: document.id, chunkIndex: chunk.chunkIndex },
          })
        }
      }
      documentsIndexed++
    }

    return { workspaceId: workspace.id, documentsIndexed, chunksIndexed }
  } finally {
    if (vault) await vault.store.close()
  }
}

async function readVaultConfig(rootPath: string): Promise<VaultConfig | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(rootPath, '.knowx', 'config.json'), 'utf-8')) as VaultConfig
  } catch {
    return null
  }
}

async function findMarkdownFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...await findMarkdownFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath)
    }
  }
  return files.sort()
}

function extractTitle(content: string): string | null {
  return /^#\s+(.+?)\s*$/m.exec(content)?.[1] ?? null
}
