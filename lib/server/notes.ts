import { LocalVaultAdapter } from '@/lib/vault/LocalVaultAdapter'
import type { NoteMetadata } from '@/lib/vault/VaultAdapter'
import { getVaultPath } from './config'
import { ApiError, requireFolder, requireNonEmptyString } from './errors'

export async function listNotes(folderValue: string | null, vaultPath = getVaultPath()): Promise<NoteMetadata[]> {
  const folder = requireFolder(folderValue)
  const adapter = new LocalVaultAdapter(vaultPath)
  await adapter.ensureDirectories()
  return adapter.listNotes(folder)
}

export async function createNote(
  payload: { folder?: string; filename?: string; content?: string },
  vaultPath = getVaultPath()
): Promise<NoteMetadata> {
  const folder = requireFolder(payload.folder ?? null)
  const filename = requireNonEmptyString(payload.filename, 'filename is required')

  if (typeof payload.content !== 'string') {
    throw new ApiError(400, 'content is required')
  }

  const safeFilename = filename.endsWith('.md') ? filename : `${filename}.md`
  const notePath = `${folder}/${safeFilename}`

  const adapter = new LocalVaultAdapter(vaultPath)
  await adapter.ensureDirectories()
  await adapter.writeNote(notePath, payload.content)

  const notes = await adapter.listNotes(folder)
  const created = notes.find((note) => note.filename === safeFilename)
  if (!created) {
    throw new ApiError(500, 'Note created but metadata not found')
  }

  return created
}

export async function readNote(
  slugValue: string,
  folderValue: string | null,
  vaultPath = getVaultPath()
): Promise<{ content: string }> {
  const slug = requireNonEmptyString(slugValue, 'slug is required')
  const folder = requireFolder(folderValue)
  const adapter = new LocalVaultAdapter(vaultPath)

  try {
    return { content: await adapter.readNote(`${folder}/${slug}.md`) }
  } catch {
    throw new ApiError(404, `Note not found: ${slug}`)
  }
}

export async function deleteNote(
  slugValue: string,
  folderValue: string | null,
  vaultPath = getVaultPath()
): Promise<void> {
  const slug = requireNonEmptyString(slugValue, 'slug is required')
  const folder = requireFolder(folderValue)
  const adapter = new LocalVaultAdapter(vaultPath)

  try {
    await adapter.deleteNote(`${folder}/${slug}.md`)
  } catch {
    throw new ApiError(404, `Note not found: ${slug}`)
  }
}
