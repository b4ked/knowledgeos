'use client'

import { useState } from 'react'

interface NewFolderDialogProps {
  parentPath?: string
  folder: 'raw' | 'wiki'
  onCreated: () => void
  onClose: () => void
}

export default function NewFolderDialog({ parentPath, folder, onCreated, onClose }: NewFolderDialogProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Folder name is required'); return }
    if (trimmed.includes('..') || trimmed.includes('/')) { setError('Folder name cannot contain .. or /'); return }
    setSaving(true)
    setError(null)
    try {
      const folderPath = parentPath ? `${parentPath}/${trimmed}` : trimmed
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder, folderPath }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Failed to create folder')
        return
      }
      onCreated()
      onClose()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-6 w-80 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-gray-100">New Folder</h2>
        {parentPath && (
          <p className="text-xs text-gray-500">Inside: <span className="text-gray-400 font-mono">{parentPath}</span></p>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded px-3 py-2">{error}</p>
          )}
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="folder-name"
            autoFocus
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium bg-yellow-900/60 text-yellow-200 hover:bg-yellow-900 disabled:opacity-50 rounded transition-colors"
            >
              {saving ? 'Creating…' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
