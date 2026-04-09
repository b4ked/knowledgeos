'use client'

import { useState, useEffect } from 'react'

interface EmbeddingsMeta {
  provider: string
  model: string
  updatedAt: string
}

interface RAGPanelProps {
  onClose: () => void
}

export default function RAGPanel({ onClose }: RAGPanelProps) {
  const [slugs, setSlugs] = useState<string[]>([])
  const [meta, setMeta] = useState<EmbeddingsMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    fetch('/api/embeddings/list')
      .then((r) => r.json())
      .then((data: { slugs: string[]; meta: EmbeddingsMeta | null }) => {
        setSlugs(data.slugs ?? [])
        setMeta(data.meta ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter.trim()
    ? slugs.filter((s) => s.toLowerCase().includes(filter.toLowerCase()))
    : slugs

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-lg mx-4 shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-100">RAG Index</h2>
            {meta && (
              <p className="text-xs text-gray-500 mt-0.5">
                {meta.provider} · {meta.model} · updated {new Date(meta.updatedAt).toLocaleString()}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Stats bar */}
        <div className="px-5 py-2.5 border-b border-gray-800 shrink-0 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {loading ? 'Loading…' : `${slugs.length} file${slugs.length !== 1 ? 's' : ''} indexed`}
          </span>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 w-40"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <p className="text-xs text-gray-600 text-center py-8">Loading…</p>
          ) : slugs.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-8">
              No files indexed yet. Use the Tokenise buttons in Settings to index your notes.
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-8">No matches for "{filter}"</p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((slug) => (
                <li key={slug} className="px-3 py-1.5 rounded text-xs text-gray-300 font-mono hover:bg-gray-800 transition-colors">
                  {slug}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-800 shrink-0">
          <button
            onClick={onClose}
            className="w-full px-3 py-1.5 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
