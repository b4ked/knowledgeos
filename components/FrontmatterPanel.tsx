'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { parseNoteFrontmatter, stringifyWithFrontmatter } from '@/lib/vault/frontmatter'
import type { NoteFrontmatter } from '@/lib/vault/frontmatter'

interface FrontmatterPanelProps {
  content: string
  slug: string
  folder: 'raw' | 'wiki'
  onContentSaved?: (newContent: string) => void
}

export default function FrontmatterPanel({ content, slug, folder, onContentSaved }: FrontmatterPanelProps) {
  const [open, setOpen] = useState(false)
  const [fm, setFm] = useState<NoteFrontmatter>({ tags: [] })
  const [body, setBody] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRender = useRef(true)

  useEffect(() => {
    const parsed = parseNoteFrontmatter(content)
    setFm(parsed.frontmatter)
    setBody(parsed.content)
    isFirstRender.current = true
  }, [content])

  const save = useCallback(async (frontmatter: NoteFrontmatter, noteBody: string) => {
    setSaving(true)
    setSaveError(null)
    try {
      const newContent = stringifyWithFrontmatter(frontmatter, noteBody)
      const res = await fetch(`/api/notes/${encodeURIComponent(slug)}?folder=${folder}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent }),
      })
      if (!res.ok) throw new Error('Save failed')
      onContentSaved?.(newContent)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [slug, folder, onContentSaved])

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(fm, body), 1000)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [fm, body, save])

  function removeTag(tag: string) {
    setFm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))
  }

  function addTag() {
    const tag = tagInput.trim().replace(/^#/, '')
    if (!tag) return
    if (fm.tags.includes(tag)) { setTagInput(''); return }
    setFm(prev => ({ ...prev, tags: [...prev.tags, tag] }))
    setTagInput('')
  }

  function setDate(date: string) {
    setFm(prev => ({ ...prev, date: date || undefined }))
  }

  const customKeys = Object.keys(fm).filter(k => !['tags', 'date', 'aliases'].includes(k))

  function setCustomValue(key: string, value: string) {
    setFm(prev => ({ ...prev, [key]: value }))
  }

  function removeCustomKey(key: string) {
    setFm(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  return (
    <div className="shrink-0 border-t border-gray-800 bg-gray-900">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        <span className="font-medium uppercase tracking-widest">Attributes</span>
        <div className="flex items-center gap-2">
          {saving && <span className="text-gray-600">Saving…</span>}
          {saveError && <span className="text-red-400">{saveError}</span>}
          <span>{open ? '▾' : '▸'}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-gray-600 uppercase tracking-wide">Tags</span>
            <div className="flex flex-wrap gap-1.5">
              {fm.tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-gray-800 text-gray-300">
                  #{tag}
                  <button onClick={() => removeTag(tag)} className="text-gray-600 hover:text-red-400 transition-colors leading-none">×</button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                  placeholder="add tag…"
                  className="bg-gray-800 text-xs text-gray-200 placeholder-gray-600 px-2 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-gray-600 w-24"
                />
                <button onClick={addTag} className="text-xs text-gray-600 hover:text-gray-300 transition-colors px-1">+</button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600 uppercase tracking-wide w-16 shrink-0">Date</span>
            <input
              type="date"
              value={fm.date ?? ''}
              onChange={e => setDate(e.target.value)}
              className="bg-gray-800 text-xs text-gray-200 px-2 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-gray-600"
            />
          </div>

          {customKeys.map(key => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-16 shrink-0 truncate">{key}</span>
              <input
                type="text"
                value={String(fm[key] ?? '')}
                onChange={e => setCustomValue(key, e.target.value)}
                className="flex-1 bg-gray-800 text-xs text-gray-200 px-2 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-gray-600 min-w-0"
              />
              <button onClick={() => removeCustomKey(key)} className="text-gray-600 hover:text-red-400 transition-colors text-xs shrink-0">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
