import path from 'path'
import { LocalVaultAdapter } from './LocalVaultAdapter'
import { RemoteVaultAdapter } from './RemoteVaultAdapter'
import { CloudVaultAdapter } from './CloudVaultAdapter'
import { readSettings } from './settings'
import type { VaultAdapter } from './VaultAdapter'
import { db } from '@/lib/db'
import { userPreferences } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export type ServerVaultMode = 'remote' | 'cloud'

export async function getServerVaultMode(userId?: string): Promise<ServerVaultMode> {
  if (!userId) return 'remote'

  const prefs = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  })

  return prefs?.vaultMode === 'remote' ? 'remote' : 'cloud'
}

export async function getAdapter(userId?: string): Promise<VaultAdapter> {
  // If a userId is provided, use the cloud (database-backed) adapter
  if (userId) {
    return new CloudVaultAdapter(db, userId)
  }

  const mode = process.env.VAULT_MODE ?? 'local'

  if (mode === 'remote') {
    const baseUrl = process.env.VPS_BASE_URL
    const token = process.env.VPS_API_TOKEN
    if (!baseUrl) throw new Error('VPS_BASE_URL is required when VAULT_MODE=remote')
    if (!token) throw new Error('VPS_API_TOKEN is required when VAULT_MODE=remote')
    return new RemoteVaultAdapter(baseUrl, token)
  }

  // Default: local filesystem adapter
  const settings = await readSettings()
  const vaultPath = process.env.VAULT_PATH
    ? path.resolve(process.env.VAULT_PATH)
    : path.resolve('./vault')
  const rawPath = settings.rawPath ? path.resolve(settings.rawPath) : undefined
  const wikiPath = settings.wikiPath ? path.resolve(settings.wikiPath) : undefined
  return new LocalVaultAdapter(vaultPath, rawPath, wikiPath)
}
