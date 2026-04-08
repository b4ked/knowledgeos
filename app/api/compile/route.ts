import path from 'path'
import { compile } from '@/lib/compiler/compile'
import type { Conventions } from '@/lib/conventions/types'

export async function POST(request: Request) {
  const body = await request.json() as {
    notePaths?: string[]
    outputFilename?: string
    conventions?: Partial<Conventions>
  }

  const { notePaths, outputFilename, conventions } = body

  if (!Array.isArray(notePaths) || notePaths.length === 0) {
    return Response.json({ error: 'notePaths must be a non-empty array' }, { status: 400 })
  }

  const vaultPath = process.env.VAULT_PATH
    ? path.resolve(process.env.VAULT_PATH)
    : path.resolve('./vault')

  try {
    const result = await compile(notePaths, outputFilename, vaultPath, conventions ?? {})
    return Response.json(result, { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Compilation failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
