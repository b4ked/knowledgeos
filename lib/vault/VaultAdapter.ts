export type NoteFolder = 'raw' | 'wiki'

export interface NoteMetadata {
  slug: string
  filename: string
  folder: NoteFolder
  path: `${NoteFolder}/${string}`
  createdAt: Date | string
  updatedAt: Date | string
}

export interface VaultAdapter {
  ensureDirectories(): Promise<void>
  listNotes(folder: NoteFolder): Promise<NoteMetadata[]>
  readNote(notePath: string): Promise<string>
  writeNote(notePath: string, content: string): Promise<void>
  deleteNote(notePath: string): Promise<void>
}
