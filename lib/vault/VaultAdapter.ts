export interface NoteMetadata {
  slug: string        // filename without extension
  filename: string    // full filename with extension
  folder: 'raw' | 'wiki'
  path: string        // relative path from vault root: raw/filename.md or wiki/filename.md
  createdAt: Date
  updatedAt: Date
}

export interface VaultAdapter {
  listNotes(folder: 'raw' | 'wiki'): Promise<NoteMetadata[]>
  readNote(path: string): Promise<string>
  writeNote(path: string, content: string): Promise<void>
  deleteNote(path: string): Promise<void>
  ensureDirectories(): Promise<void>
}
