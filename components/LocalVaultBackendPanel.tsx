'use client'

import { useState } from 'react'
import type { ChunkSearchResult, DocumentRecord, VaultConfig, Workspace } from '@/lib/knowledge/types/models'

type OpenResponse = { workspace: Workspace; config: VaultConfig; error?: string }
type ScanResponse = { workspaceId: string; documentsIndexed: number; chunksIndexed: number; error?: string }

export default function LocalVaultBackendPanel() {
  const [vaultPath, setVaultPath] = useState('')
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [config, setConfig] = useState<VaultConfig | null>(null)
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ChunkSearchResult[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function openVault() {
    await run(async () => {
      const data = await post<OpenResponse>('/api/local-vault/open', { path: vaultPath })
      if (data.error) throw new Error(data.error)
      setWorkspace(data.workspace)
      setConfig(data.config)
      setStatus(`Opened ${data.config.vaultName}`)
      await loadDocuments(data.workspace.id)
    })
  }

  async function scan() {
    await run(async () => {
      const data = await post<ScanResponse>('/api/local-vault/scan', { path: vaultPath })
      if (data.error) throw new Error(data.error)
      setStatus(`Indexed ${data.documentsIndexed} documents and ${data.chunksIndexed} chunks`)
      await loadDocuments(data.workspaceId)
    })
  }

  async function search() {
    if (!workspace || !query.trim()) return
    await run(async () => {
      const params = new URLSearchParams({ path: vaultPath, workspaceId: workspace.id, q: query.trim() })
      const response = await fetch(`/api/local-vault/search?${params}`)
      const data = await response.json() as ChunkSearchResult[] | { error?: string }
      if (!response.ok || !Array.isArray(data)) throw new Error('error' in data ? data.error : 'Search failed')
      setResults(data)
      setStatus(`${data.length} matches`)
    })
  }

  async function loadDocuments(workspaceId: string) {
    const params = new URLSearchParams({ path: vaultPath, workspaceId })
    const response = await fetch(`/api/local-vault/documents?${params}`)
    const data = await response.json() as DocumentRecord[] | { error?: string }
    if (!response.ok || !Array.isArray(data)) throw new Error('error' in data ? data.error : 'Could not load documents')
    setDocuments(data)
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setStatus(null)
    try {
      await action()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="border-b border-gray-800 bg-gray-950 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={vaultPath}
          onChange={(event) => setVaultPath(event.target.value)}
          placeholder="/absolute/path/to/vault"
          className="min-w-[260px] flex-1 rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-100 outline-none focus:border-blue-500"
        />
        <button
          onClick={openVault}
          disabled={busy || !vaultPath.trim()}
          className="rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-100 disabled:opacity-40"
        >
          Open
        </button>
        <button
          onClick={scan}
          disabled={busy || !vaultPath.trim()}
          className="rounded bg-blue-700 px-3 py-1.5 text-xs text-blue-50 disabled:opacity-40"
        >
          Scan
        </button>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') void search() }}
          placeholder="Search chunks"
          className="w-48 rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-100 outline-none focus:border-blue-500"
        />
        <button
          onClick={search}
          disabled={busy || !workspace || !query.trim()}
          className="rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-100 disabled:opacity-40"
        >
          Search
        </button>
      </div>

      {(status || config || documents.length > 0 || results.length > 0) && (
        <div className="mt-2 grid gap-2 text-xs text-gray-400 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            {status && <p className="text-gray-300">{status}</p>}
            {config && <p className="truncate">PGlite database: {config.database.path}</p>}
            {documents.length > 0 && <p>{documents.length} documents in local index</p>}
          </div>
          {results.length > 0 && (
            <ol className="max-h-28 space-y-1 overflow-auto">
              {results.slice(0, 5).map((result) => (
                <li key={result.chunk.id} className="truncate">
                  <span className="text-gray-200">{result.documentPath}</span>
                  <span className="ml-2 text-gray-500">{result.snippet}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return await response.json() as T
}

