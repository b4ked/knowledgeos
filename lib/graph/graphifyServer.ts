import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { buildGraphifyOutputFromAdapter, normalizeGraphifyOutput } from './graphify'
import type { GraphifyRunResult } from './graphify'
import type { VaultAdapter } from '../vault/VaultAdapter'

const execFileAsync = promisify(execFile)

export async function runGraphifyForAdapter(adapter: VaultAdapter): Promise<GraphifyRunResult> {
  const command = process.env.GRAPHIFY_COMMAND?.trim()
  if (!command) return buildGraphifyOutputFromAdapter(adapter)

  await adapter.ensureDirectories()
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'knowx-graphify-'))
  const inputPath = path.join(tempDir, 'notes.json')
  const outputPath = path.join(tempDir, 'graph.json')

  try {
    const [wikiMeta, rawMeta] = await Promise.all([
      adapter.listNotes('wiki'),
      adapter.listNotes('raw'),
    ])
    const notes = await Promise.all(
      [...wikiMeta, ...rawMeta].map(async (note) => ({
        slug: note.slug,
        path: note.path,
        folder: note.folder,
        content: await adapter.readNote(note.path).catch(() => ''),
      })),
    )
    await fs.writeFile(inputPath, JSON.stringify({ notes }, null, 2), 'utf-8')
    await runGraphifyCommand(command, inputPath, outputPath)
    const parsed = JSON.parse(await fs.readFile(outputPath, 'utf-8')) as unknown
    return normalizeGraphifyOutput({
      ...normalizeGraphifyOutput(parsed),
      source: 'graphify',
    })
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

export async function writeGraphifyOutput(adapter: VaultAdapter, result: GraphifyRunResult): Promise<void> {
  await adapter.writeNote('.knowx/graphify/graph.json', `${JSON.stringify(result, null, 2)}\n`)
}

async function runGraphifyCommand(command: string, inputPath: string, outputPath: string): Promise<void> {
  const [bin, ...rawArgs] = command.split(/\s+/)
  const args = rawArgs.map((arg) =>
    arg
      .replaceAll('{input}', inputPath)
      .replaceAll('{output}', outputPath),
  )
  if (!rawArgs.some((arg) => arg.includes('{input}'))) args.push(inputPath)
  if (!rawArgs.some((arg) => arg.includes('{output}'))) args.push(outputPath)
  await execFileAsync(bin, args, { timeout: 120_000, maxBuffer: 20 * 1024 * 1024 })
}
