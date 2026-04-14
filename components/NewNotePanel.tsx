'use client'

import { useState, useEffect } from 'react'
import type { NoteMetadata } from '@/lib/vault/VaultAdapter'
import type { Conventions } from '@/lib/conventions/types'
import { BUILT_IN_PRESETS } from '@/lib/conventions/defaults'
import type { VaultMode } from '@/components/VaultModeBanner'
import type { BrowserVaultAdapter } from '@/lib/vault/BrowserVaultAdapter'
import { extractInlineTags, normaliseTagList, stringifyWithFrontmatter } from '@/lib/vault/frontmatter'

interface NewNotePanelProps {
  onSave: (note: NoteMetadata) => void
  onCancel: () => void
  defaultFolderPrefix?: string
  vaultMode: VaultMode
  browserAdapter?: BrowserVaultAdapter | null
}

type PresetSource = 'builtin' | 'custom'

export default function NewNotePanel({ onSave, onCancel, defaultFolderPrefix, vaultMode, browserAdapter }: NewNotePanelProps) {
  const [filename, setFilename] = useState(() => defaultFolderPrefix ? `${defaultFolderPrefix}/` : '')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [fmTags, setFmTags] = useState('')
  const [fmDate, setFmDate] = useState(() => new Date().toISOString().split('T')[0])
  const [customPresets, setCustomPresets] = useState<string[]>([])
  const [selectedPreset, setSelectedPreset] = useState<string>('default')
  const [selectedPresetSource, setSelectedPresetSource] = useState<PresetSource>('builtin')
  const [selectedConventions, setSelectedConventions] = useState<Partial<Conventions>>(BUILT_IN_PRESETS['default'])

  useEffect(() => {
    fetch('/api/presets').then((r) => r.json())
      .then((data: { names: string[] }) => setCustomPresets(data.names ?? []))
      .catch(() => { /* silent */ })
  }, [])

  // Pre-fill filename when folder prefix changes (e.g. when opened from folder "+" button)
  useEffect(() => {
    if (defaultFolderPrefix) {
      setFilename(`${defaultFolderPrefix}/`)
    } else {
      setFilename('')
    }
  }, [defaultFolderPrefix])

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
      if (res.ok) setSelectedConventions(await res.json() as Partial<Conventions>)
    } catch { /* silent */ }
  }

  async function handleSave() {
    if (!content.trim()) { setError('Content is required'); return }

    setSaving(true)
    setError(null)

    const tags = normaliseTagList([
      ...fmTags.split(','),
      ...extractInlineTags(content),
    ])
    const finalContent = stringifyWithFrontmatter(
      { tags, date: fmDate },
      content
    )

    try {
      const providedName = filename.trim()

      if (vaultMode === 'local' && browserAdapter) {
        const tempName = providedName || `_temp-${Date.now()}`
        const rawPath = `raw/${providedName ? `${providedName}-raw` : tempName}.md`

        setStatus('Compiling…')
        const compileRes = await fetch('/api/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notePaths: [rawPath],
            sources: [finalContent],
            outputFilename: providedName || undefined,
            conventions: selectedConventions,
          }),
        })
        if (!compileRes.ok) {
          const d = await compileRes.json()
          setError(d.error ?? 'Compilation failed')
          return
        }

        const { slug, output, outputPath } = await compileRes.json() as { slug: string; output: string; outputPath: `wiki/${string}` }

        setStatus('Saving notes…')
        await browserAdapter.writeNote(providedName ? `raw/${providedName}-raw.md` : `raw/${slug}-raw.md`, finalContent)
        await browserAdapter.writeNote(outputPath, output)

        onSave({
          slug,
          filename: `${slug}.md`,
          folder: 'wiki',
          path: outputPath,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        return
      }

      if (providedName) {
        // ── Named flow: user provided a filename ─────────────────────────────
        // 1. Save raw note as {name}-raw.md
        setStatus('Saving raw note…')
        const rawRes = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder: 'raw', filename: `${providedName}-raw`, content: finalContent }),
        })
        if (!rawRes.ok) {
          const d = await rawRes.json()
          setError(d.error ?? 'Failed to save raw note')
          return
        }
        const rawNote = await rawRes.json() as NoteMetadata

        // 2. Compile raw → wiki/{name}.md
        setStatus('Compiling to wiki…')
        const compileRes = await fetch('/api/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notePaths: [rawNote.path],
            outputFilename: providedName,
            conventions: selectedConventions,
          }),
        })
        if (!compileRes.ok) {
          const d = await compileRes.json()
          setError(d.error ?? 'Compilation failed — raw note was saved')
          return
        }
        const { slug } = await compileRes.json() as { slug: string }
        onSave({ slug, filename: `${slug}.md`, folder: 'wiki', path: `wiki/${slug}.md`, createdAt: new Date(), updatedAt: new Date() })

      } else {
        // ── Auto-name flow: LLM picks the name ──────────────────────────────
        // 1. Save content to a temp raw note so compile can read it
        const tempName = `_temp-${Date.now()}`
        setStatus('Saving draft…')
        const tempRes = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder: 'raw', filename: tempName, content: finalContent }),
        })
        if (!tempRes.ok) {
          const d = await tempRes.json()
          setError(d.error ?? 'Failed to save draft')
          return
        }
        const tempNote = await tempRes.json() as NoteMetadata

        // 2. Compile — LLM generates slug from content
        setStatus('Compiling…')
        const compileRes = await fetch('/api/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notePaths: [tempNote.path], conventions: selectedConventions }),
        })
        if (!compileRes.ok) {
          const d = await compileRes.json()
          // Clean up temp note best-effort
          await fetch(`/api/notes/${encodeURIComponent(tempName)}?folder=raw`, { method: 'DELETE' }).catch(() => {})
          setError(d.error ?? 'Compilation failed')
          return
        }
        const { slug } = await compileRes.json() as { slug: string }

        // 3. Save properly-named raw note as {slug}-raw.md
        setStatus('Saving raw note…')
        await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder: 'raw', filename: `${slug}-raw`, content: finalContent }),
        })

        // 4. Clean up temp note
        await fetch(`/api/notes/${encodeURIComponent(tempName)}?folder=raw`, { method: 'DELETE' }).catch(() => {})

        onSave({ slug, filename: `${slug}.md`, folder: 'wiki', path: `wiki/${slug}.md`, createdAt: new Date(), updatedAt: new Date() })
      }
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
          <div className="flex-1">
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="my-note (optional)"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
            <p className="mt-1 text-xs text-gray-700">
              Leave blank to use naming convention from preset. Raw note will be saved as <span className="text-gray-600 font-mono">name-raw.md</span>.
            </p>
          </div>
        </div>

        {/* Frontmatter */}
        <div className="flex gap-2 items-start">
          <label className="text-xs text-gray-500 w-20 pt-1 shrink-0">Frontmatter</label>
          <div className="flex-1 flex flex-col gap-2">
            <input
              type="text"
              value={fmTags}
              onChange={e => setFmTags(e.target.value)}
              placeholder="tags (comma-separated)"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
            <input
              type="date"
              value={fmDate}
              onChange={e => setFmDate(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-gray-500"
            />
            <p className="text-xs text-gray-700">Comma-separated tags and inline #tags in the note are merged together.</p>
          </div>
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
