import type { NoteFolder, NoteMetadata, VaultAdapter } from './VaultAdapter'

/**
 * Proxies vault operations to a remote KnowledgeOS backend (e.g. VPS).
 * Used by Vercel API routes when VAULT_MODE=remote.
 */
export class RemoteVaultAdapter implements VaultAdapter {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  private async req(path: string, init: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${path}`
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
        ...(init.headers ?? {}),
      },
    })
    return res
  }

  async ensureDirectories(): Promise<void> {
    // Remote server manages its own directories
  }

  async listNotes(folder: NoteFolder): Promise<NoteMetadata[]> {
    const res = await this.req(`/api/notes?folder=${folder}`)
    if (!res.ok) throw new Error(`Remote listNotes failed: ${res.status}`)
    return res.json() as Promise<NoteMetadata[]>
  }

  async readNote(notePath: string): Promise<string> {
    const [folder, ...rest] = notePath.split('/')
    const slug = rest.join('/').replace(/\.md$/, '')
    const encodedSlug = slug.split('/').map(encodeURIComponent).join('/')
    const res = await this.req(`/api/notes/${encodedSlug}?folder=${folder}`)
    if (!res.ok) throw new Error(`Remote readNote failed: ${res.status}`)
    const data = await res.json() as { content: string }
    return data.content
  }

  async writeNote(notePath: string, content: string): Promise<void> {
    const [folder, ...rest] = notePath.split('/')
    const filename = rest.join('/')
    const res = await this.req('/api/notes', {
      method: 'POST',
      body: JSON.stringify({ folder, filename, content }),
    })
    if (!res.ok) throw new Error(`Remote writeNote failed: ${res.status}`)
  }

  async deleteNote(notePath: string): Promise<void> {
    const [folder, ...rest] = notePath.split('/')
    const slug = rest.join('/').replace(/\.md$/, '')
    const encodedSlug = slug.split('/').map(encodeURIComponent).join('/')
    const res = await this.req(`/api/notes/${encodedSlug}?folder=${folder}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 404) throw new Error(`Remote deleteNote failed: ${res.status}`)
  }
}
