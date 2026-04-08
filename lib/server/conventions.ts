import fs from 'fs/promises'
import path from 'path'
import { DEFAULT_CONVENTIONS } from '@/lib/conventions/defaults'
import type { Conventions } from '@/lib/conventions/types'
import { getVaultPath } from './config'

function conventionsPath(vaultPath: string) {
  return path.join(vaultPath, 'CONVENTIONS.json')
}

export async function readConventions(vaultPath = getVaultPath()): Promise<Conventions> {
  try {
    const raw = await fs.readFile(conventionsPath(vaultPath), 'utf-8')
    return JSON.parse(raw) as Conventions
  } catch {
    return DEFAULT_CONVENTIONS
  }
}

export async function saveConventions(
  body: Partial<Conventions>,
  vaultPath = getVaultPath()
): Promise<Conventions> {
  const merged: Conventions = { ...DEFAULT_CONVENTIONS, ...body }
  await fs.mkdir(vaultPath, { recursive: true })
  await fs.writeFile(conventionsPath(vaultPath), JSON.stringify(merged, null, 2), 'utf-8')
  return merged
}
