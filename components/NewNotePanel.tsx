'use client'

import { useState, useEffect } from 'react'
import type { NoteMetadata } from '@/lib/vault/VaultAdapter'
import type { Conventions } from '@/lib/conventions/types'
import { BUILT_IN_PRESETS } from '@/lib/conventions/defaults'

interface NewNotePanelProps {
  onSave: (note: NoteMetadata) => void
  onCancel: () => void
}

type PresetSource = 'builtin' | 'custom'

export default function NewNotePanel({ onSave, onCancel }: NewNotePanelProps) {
  const [filename, setFilename] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [customPresets, setCustomPresets] = useState<string[]>([])
  const [selectedPreset, setSelectedPreset] = useState<string>('default')
  const [selectedPresetSource, setSelectedPresetSource] = useState<PresetSource>('builtin')
  const [selectedConventions, setSelectedConventions] = useState<Partial<Conventions>>(BUILT_IN_PRESETS['default'])

  useEffect(() => {
    fetch('/api/presets').then((r) => r.json())
      .then((data: { names: string[] }) => setCustomPresets(data.names ?? []))
      .catch(() => { /* silent */ })
  }, [])

  async function selectBuiltIn(key: string) {
    setSelectedPreset(key)
    setSelectedPresetSource('builtin')
    setSelectedConventions(BUILT_IN_PRESETS[key] ?? {})
  }

  async function selectCustom(name: string) {
    setSelectedPreset(name)
    setSelectedPresetSource('custom')
    try {
      const res = await fetch(`/api/presets/${encodeURIComponent(name)}`)
      if (res.ok) {
        setSelectedConventions(await res.json() as Partial<Conventions>)
      }
    } catch { /* silent */ }
  }

  async function handleSave() {
    if (!filename.trim()) { setError('Filename is required'); return }
    if (!content.trim()) { setError('Content is required'); return }

    setSaving(true)
    setError(null)

    try {
      // 1. Save raw note
      setStatus('Saving raw note…')
      const rawRes = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: 'raw', filename: filename.trim(), content }),
      })
      if (!rawRes.ok) {
        const data = await rawRes.json()
        setError(data.error ?? 'Failed to save raw note')
        return
      }
      const rawNote = await rawRes.json() as NoteMetadata

      // 2. Compile to wiki
      setStatus('Compiling to wiki…')
      const compileRes = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notePaths: [rawNote.path],
          conventions: selectedConventions,
        }),
      })
      if (!compileRes.ok) {
        const data = await compileRes.json()
        setError(data.error ?? 'Compilation failed — raw note was saved')
        return
      }
      const compileResult = await compileRes.json() as { slug: string }

      // 3. Return wiki note to parent
      onSave({
        slug: compileResult.slug,
        filename: `${compileResult.slug}.md`,
        folder: 'wiki',
        path: `wiki/${compileResult.slug}.md`,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
      setStatus(null)
    }
  }

  function isSelected(name: string, source: PresetSource) {
    return selectedPreset === name && selectedPresetSource === source
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-3 border-b border-gray-800 shrink-0 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-100">New Note</h2>
        <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          Cancel
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded px-3 py-2">
            {error}
          </div>
        )}

        {/* Preset selector */}
        <div className="flex gap-2 items-start">
          <label className="text-xs text-gray-500 w-20 pt-1 shrink-0">Preset</label>
          <div className="flex flex-wrap gap-1.5">
            {/* Built-in presets */}
            {Object.keys(BUILT_IN_PRESETS).map((key) => (
              <button
                key={`builtin-${key}`}
                onClick={() => selectBuiltIn(key)}
                className={`px-2 py-1 text-xs rounded transition-colors capitalize ${
                  isSelected(key, 'builtin')
                    ? 'bg-blue-700 text-blue-100'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {key}
              </button>
            ))}
            {/* Custom presets */}
            {customPresets.map((name) => (
              <button
                key={`custom-${name}`}
                onClick={() => selectCustom(name)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  isSelected(name, 'custom')
                    ? 'bg-amber-700 text-amber-100'
                    : 'bg-gray-800 text-amber-300 hover:bg-gray-700'
                }`}
              >
                {name}
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
          />
        </div>

        {/* Content */}
        <div className="flex gap-2 flex-1 min-h-0">
          <label className="text-xs text-gray-500 w-20 pt-1.5 shrink-0">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste or write your raw note content here…"
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none min-h-64"
          />
        </div>

        {/* Save button */}
        <div className="flex items-center justify-end gap-3 pb-2">
          {status && <span className="text-xs text-gray-500">{status}</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-xs font-medium bg-blue-900 text-blue-200 rounded hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? status ?? 'Working…' : 'Save & Compile'}
          </button>
        </div>
      </div>
    </div>
  )
}
