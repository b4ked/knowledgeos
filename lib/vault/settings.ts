import fs from 'fs/promises'
import path from 'path'

export interface VaultSettings {
  rawPath?: string
  wikiPath?: string
  presetsPath?: string
}

function settingsPath(): string {
  return process.env.SETTINGS_PATH
    ? path.resolve(process.env.SETTINGS_PATH)
    : path.resolve('./vault/settings.json')
}

export async function readSettings(): Promise<VaultSettings> {
  try {
    const content = await fs.readFile(settingsPath(), 'utf-8')
    return JSON.parse(content) as VaultSettings
  } catch {
    return {}
  }
}

export async function writeSettings(settings: VaultSettings): Promise<void> {
  const p = settingsPath()
  await fs.mkdir(path.dirname(p), { recursive: true })
  await fs.writeFile(p, JSON.stringify(settings, null, 2), 'utf-8')
}
