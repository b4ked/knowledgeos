import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { LocalVaultAdapter } from '@/lib/vault/LocalVaultAdapter'
import type { VaultAdapter } from '@/lib/vault/VaultAdapter'

describe('LocalVaultAdapter', () => {
  let vaultPath: string

  beforeEach(() => {
    vaultPath = path.join(os.tmpdir(), crypto.randomUUID())
  })

  afterEach(async () => {
    await fs.rm(vaultPath, { recursive: true, force: true })
  })

  it('ensureDirectories creates raw/ and wiki/ subdirs', async () => {
    const adapter = new LocalVaultAdapter(vaultPath)
    await adapter.ensureDirectories()

    const rawStat = await fs.stat(path.join(vaultPath, 'raw'))
    const wikiStat = await fs.stat(path.join(vaultPath, 'wiki'))

    expect(rawStat.isDirectory()).toBe(true)
    expect(wikiStat.isDirectory()).toBe(true)
  })

  it('listNotes returns empty array when folder is empty', async () => {
    const adapter = new LocalVaultAdapter(vaultPath)
    await adapter.ensureDirectories()

    const notes = await adapter.listNotes('raw')

    expect(notes).toEqual([])
  })

  it('listNotes returns NoteMetadata for .md files in correct folder', async () => {
    const adapter = new LocalVaultAdapter(vaultPath)
    await adapter.ensureDirectories()

    const rawFolder = path.join(vaultPath, 'raw')
    await fs.writeFile(path.join(rawFolder, 'hello.md'), '# Hello', 'utf-8')
    await fs.writeFile(path.join(rawFolder, 'world.md'), '# World', 'utf-8')
    // A non-.md file — should be excluded
    await fs.writeFile(path.join(rawFolder, 'ignored.txt'), 'nope', 'utf-8')

    const notes = await adapter.listNotes('raw')

    expect(notes).toHaveLength(2)

    const filenames = notes.map((n) => n.filename).sort()
    expect(filenames).toEqual(['hello.md', 'world.md'])

    for (const note of notes) {
      expect(note.folder).toBe('raw')
      expect(note.slug).toBe(note.filename.replace(/\.md$/, ''))
      expect(note.path).toBe(`raw/${note.filename}`)
      expect(note.createdAt).toBeInstanceOf(Date)
      expect(note.updatedAt).toBeInstanceOf(Date)
    }
  })

  it('readNote returns correct content', async () => {
    const adapter = new LocalVaultAdapter(vaultPath)
    const notePath = 'raw/my-note.md'
    const fullPath = path.join(vaultPath, notePath)

    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, '# My Note\n\nSome content.', 'utf-8')

    const content = await adapter.readNote(notePath)

    expect(content).toBe('# My Note\n\nSome content.')
  })

  it('writeNote creates file with correct content', async () => {
    const adapter = new LocalVaultAdapter(vaultPath)
    const notePath = 'raw/new-note.md'

    await adapter.writeNote(notePath, '# New Note')

    const content = await fs.readFile(path.join(vaultPath, notePath), 'utf-8')
    expect(content).toBe('# New Note')
  })

  it('writeNote creates parent directories if needed', async () => {
    const adapter = new LocalVaultAdapter(vaultPath)
    const notePath = 'raw/deep/nested/note.md'

    await adapter.writeNote(notePath, 'nested content')

    const content = await fs.readFile(path.join(vaultPath, notePath), 'utf-8')
    expect(content).toBe('nested content')
  })

  it('deleteNote removes the file', async () => {
    const adapter = new LocalVaultAdapter(vaultPath)
    const notePath = 'raw/to-delete.md'
    const fullPath = path.join(vaultPath, notePath)

    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, 'delete me', 'utf-8')

    await adapter.deleteNote(notePath)

    await expect(fs.stat(fullPath)).rejects.toThrow()
  })

  it('readNote throws if file does not exist', async () => {
    const adapter = new LocalVaultAdapter(vaultPath)

    await expect(adapter.readNote('raw/ghost.md')).rejects.toThrow(
      'Note not found: raw/ghost.md'
    )
  })

  it('deleteNote throws if file does not exist', async () => {
    const adapter = new LocalVaultAdapter(vaultPath)

    await expect(adapter.deleteNote('raw/ghost.md')).rejects.toThrow(
      'Note not found: raw/ghost.md'
    )
  })

  it('LocalVaultAdapter satisfies VaultAdapter interface (type check)', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const adapter: VaultAdapter = new LocalVaultAdapter(vaultPath)
  })
})
