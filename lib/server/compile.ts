import { compile } from '@/lib/compiler/compile'
import type { Conventions } from '@/lib/conventions/types'
import { getVaultPath } from './config'
import { ApiError } from './errors'

export async function compileNotes(
  payload: {
    notePaths?: string[]
    outputFilename?: string
    conventions?: Partial<Conventions>
  },
  vaultPath = getVaultPath()
) {
  if (!Array.isArray(payload.notePaths) || payload.notePaths.length === 0) {
    throw new ApiError(400, 'notePaths must be a non-empty array')
  }

  return compile(payload.notePaths, payload.outputFilename, vaultPath, payload.conventions ?? {})
}
