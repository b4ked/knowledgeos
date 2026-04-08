'use client'

import { useState } from 'react'
import type { NoteMetadata } from '@/lib/vault/VaultAdapter'

interface NewNotePanelProps {
  defaultFolder?: 'raw' | 'wiki'
  onSave: (note: NoteMetadata) => void
  onCancel: () => void
}

export default function NewNotePanel({ defaultFolder = 'raw', onSave, onCancel }: NewNotePanelProps) {
  const [folder, setFolder] = useState<'raw' | 'wiki'>(defaultFolder)
  const [filename, setFilename] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!filename.trim()) {
      setError('Filename is required')
      return
    }
    if (!content.trim()) {
      setError('Content is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder, filename: filename.trim(), content }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to save note')
        return
      }

      const note = await res.json() as NoteMetadata
      onSave(note)
    } catch {
      setError('Network error — could not save note')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-3 border-b border-gray-800 shrink-0 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-100">New Note</h2>
        <button
          onClick={onCancel}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded px-3 py-2">
            {error}
          </div>
        )}

        {/* Folder selector */}
        <div className="flex gap-2">
          <label className="text-xs text-gray-500 w-20 pt-1 shrink-0">Folder</label>
          <div className="flex gap-1">
            {(['raw', 'wiki'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFolder(f)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  folder === f
                    ? 'bg-gray-700 text-gray-100'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Filename */}
        <div className="flex gap-2 items-start">
          <label className="text-xs text-gray-500 w-20 pt-1.5 shrink-0">Filename</label>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="my-note (without .md)"
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>

        {/* Content */}
        <div className="flex gap-2 flex-1 min-h-0">
          <label className="text-xs text-gray-500 w-20 pt-1.5 shrink-0">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste markdown content here..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none min-h-64"
          />
        </div>

        {/* Save button */}
        <div className="flex justify-end pb-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-xs font-medium bg-gray-700 text-gray-100 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  )
}
