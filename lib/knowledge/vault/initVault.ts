import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { getPGliteDbPath, PGliteKnowledgeStore } from '../adapters/PGliteKnowledgeStore'
import type { VaultConfig, Workspace } from '../types/models'

export type InitVaultResult = {
  vaultPath: string
  config: VaultConfig
  workspace: Workspace
  store: PGliteKnowledgeStore
}

export async function initVault(vaultPathInput: string): Promise<InitVaultResult> {
  const vaultPath = path.resolve(vaultPathInput)
  const knowxPath = path.join(vaultPath, '.knowx')
  const configPath = path.join(knowxPath, 'config.json')

  await fs.mkdir(vaultPath, { recursive: true })
  await Promise.all([
    fs.mkdir(path.join(knowxPath, 'db'), { recursive: true }),
    fs.mkdir(path.join(knowxPath, 'objects'), { recursive: true }),
    fs.mkdir(path.join(knowxPath, 'graphify'), { recursive: true }),
    fs.mkdir(path.join(knowxPath, 'logs'), { recursive: true }),
  ])

  const config = await readOrCreateConfig(configPath, vaultPath)
  const store = new PGliteKnowledgeStore(getPGliteDbPath(vaultPath))
  await store.init()
  const workspace = await store.createWorkspace({
    id: config.vaultId,
    name: config.vaultName,
    rootPath: vaultPath,
  })

  return { vaultPath, config, workspace, store }
}

async function readOrCreateConfig(configPath: string, vaultPath: string): Promise<VaultConfig> {
  try {
    const existing = JSON.parse(await fs.readFile(configPath, 'utf-8')) as VaultConfig
    return existing
  } catch {
    const config: VaultConfig = {
      version: 1,
      vaultId: randomUUID(),
      vaultName: path.basename(vaultPath),
      database: {
        mode: 'pglite',
        path: '.knowx/db',
      },
    }
    await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8')
    return config
  }
}

