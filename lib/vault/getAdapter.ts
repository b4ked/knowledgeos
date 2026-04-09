import path from 'path'
import { LocalVaultAdapter } from './LocalVaultAdapter'
import { readSettings } from './settings'

export async function getAdapter(): Promise<LocalVaultAdapter> {
  const settings = await readSettings()
  const vaultPath = process.env.VAULT_PATH
    ? path.resolve(process.env.VAULT_PATH)
    : path.resolve('./vault')
  const rawPath = settings.rawPath ? path.resolve(settings.rawPath) : undefined
  const wikiPath = settings.wikiPath ? path.resolve(settings.wikiPath) : undefined
  return new LocalVaultAdapter(vaultPath, rawPath, wikiPath)
}
