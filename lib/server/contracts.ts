export type Folder = 'raw' | 'wiki'

export interface CompileRequestBody {
  notePaths?: string[]
  outputFilename?: string
  conventions?: Record<string, unknown>
}
