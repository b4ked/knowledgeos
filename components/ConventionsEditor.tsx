'use client'

import { useState, useEffect } from 'react'
import type { Conventions } from '@/lib/conventions/types'
import { DEFAULT_CONVENTIONS } from '@/lib/conventions/defaults'

const BUILT_IN_PRESETS: Record<string, Partial<Conventions>> = {
  default: {},
  zettelkasten: {
    role: 'Zettelkasten note writer — create atomic, evergreen notes with unique identifiers',
    outputFormat: 'Single atomic idea per note. ## Idea, ## Evidence, ## Links sections.',
    wikilinkRules: 'Link to exactly one concept per [[wikilink]]. Prefer atomic concept names.',
    namingConvention: 'Descriptive phrase slug, e.g. "learning-through-retrieval-practice"',
    customInstructions: 'Keep each note under 300 words. One idea only.',
  },
  academic: {
    role: 'Academic knowledge synthesiser — create structured literature notes',
    outputFormat: '## Abstract, ## Methodology, ## Findings, ## Critique, ## Citations sections',
    wikilinkRules: 'Link author names, theories, and key terms in [[wikilinks]]',
    namingConvention: 'author-year-keyword, e.g. "kahneman-2011-thinking-fast"',
    customInstructions: 'Include a critical analysis. Note methodological strengths/weaknesses.',
  },
  meeting: {
    role: 'Meeting note compiler — extract decisions, actions, and context',
    outputFormat: '## Context, ## Decisions, ## Action Items, ## Open Questions sections',
    wikilinkRules: 'Link project names, people, and recurring topics in [[wikilinks]]',
    namingConvention: 'date-topic slug, e.g. "2025-01-15-product-review"',
    customInstructions: 'Lead with decisions made. List action items with owners if mentioned.',
  },
}

const ANTHROPIC_MODELS = ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001']
const OPENAI_MODELS = ['gpt-4o', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano']

interface ConventionsEditorProps {
  onClose: () => void
  onSaved: (msg: string) => void
  onError: (msg: string) => void
}

export default function ConventionsEditor({ onClose, onSaved, onError }: ConventionsEditorProps) {
  const [form, setForm] = useState<Conventions>(DEFAULT_CONVENTIONS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewPrompt, setPreviewPrompt] = useState(false)
  const [customPresets, setCustomPresets] = useState<string[]>([])
  const [savePresetName, setSavePresetName] = useState('')
  const [savingPreset, setSavingPreset] = useState(false)
  const [deletingPreset, setDeletingPreset] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/conventions').then((r) => r.json()).catch(() => DEFAULT_CONVENTIONS),
      fetch('/api/presets').then((r) => r.json()).catch(() => ({ names: [] })),
    ]).then(([conventions, presetsData]) => {
      setForm(conventions as Conventions)
      setCustomPresets((presetsData as { names: string[] }).names ?? [])
    }).finally(() => setLoading(false))
  }, [])

  function applyBuiltInPreset(key: string) {
    const preset = BUILT_IN_PRESETS[key]
    setForm((prev) => ({ ...DEFAULT_CONVENTIONS, ...prev, ...preset }))
  }

  async function loadCustomPreset(name: string) {
    const res = await fetch(`/api/presets/${encodeURIComponent(name)}`)
    if (!res.ok) { onError(`Could not load preset "${name}"`); return }
    const preset = await res.json() as Partial<Conventions>
    setForm((prev) => ({ ...prev, ...preset }))
  }

  async function saveCustomPreset() {
    const name = savePresetName.trim()
    if (!name) return
    setSavingPreset(true)
    try {
      const res = await fetch(`/api/presets/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { onError('Failed to save preset'); return }
      setCustomPresets((prev) => prev.includes(name) ? prev : [...prev, name].sort())
      setSavePresetName('')
      onSaved(`Preset "${name}" saved`)
    } catch {
      onError('Network error — could not save preset')
    } finally {
      setSavingPreset(false)
    }
  }

  async function deleteCustomPreset(name: string) {
    setDeletingPreset(name)
    try {
      await fetch(`/api/presets/${encodeURIComponent(name)}`, { method: 'DELETE' })
      setCustomPresets((prev) => prev.filter((p) => p !== name))
    } catch {
      onError('Network error — could not delete preset')
    } finally {
      setDeletingPreset(null)
    }
  }

  function set<K extends keyof Conventions>(key: K, value: Conventions[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/conventions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        onError(data.error ?? 'Failed to save conventions')
      } else {
        onSaved('Conventions saved')
        onClose()
      }
    } catch {
      onError('Network error — could not save conventions')
    } finally {
      setSaving(false)
    }
  }

  const modelOptions = form.provider === 'openai' ? OPENAI_MODELS : ANTHROPIC_MODELS

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 shrink-0 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Conventions</span>
        <button onClick={onClose} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">✕</button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-gray-600">Loading…</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Built-in presets */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Built-in presets</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(BUILT_IN_PRESETS).map((key) => (
                <button
                  key={key}
                  onClick={() => applyBuiltInPreset(key)}
                  className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors capitalize"
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          {/* Custom presets */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Custom presets</label>
            {customPresets.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {customPresets.map((name) => (
                  <div key={name} className="flex items-center gap-0.5">
                    <button
                      onClick={() => loadCustomPreset(name)}
                      className="px-2 py-1 text-xs rounded-l bg-gray-800 text-amber-300 hover:bg-gray-700 transition-colors"
                    >
                      {name}
                    </button>
                    <button
                      onClick={() => deleteCustomPreset(name)}
                      disabled={deletingPreset === name}
                      className="px-1.5 py-1 text-xs rounded-r bg-gray-800 text-gray-600 hover:text-red-400 hover:bg-gray-700 transition-colors disabled:opacity-40"
                      title={`Delete "${name}"`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-700 mb-2">No custom presets yet.</p>
            )}
            <div className="flex gap-1.5">
              <input
                value={savePresetName}
                onChange={(e) => setSavePresetName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveCustomPreset()}
                placeholder="Preset name…"
                className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500"
              />
              <button
                onClick={saveCustomPreset}
                disabled={!savePresetName.trim() || savingPreset}
                className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                {savingPreset ? 'Saving…' : 'Save as preset'}
              </button>
            </div>
          </div>

          {/* Provider */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Provider</label>
            <select
              value={form.provider}
              onChange={(e) => {
                const p = e.target.value as Conventions['provider']
                const defaultModel = p === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-6'
                setForm((prev) => ({ ...prev, provider: p, compilationModel: defaultModel, queryModel: defaultModel }))
              }}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-gray-500"
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>

          {/* Models */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Compilation model</label>
              <select
                value={form.compilationModel}
                onChange={(e) => set('compilationModel', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-gray-500"
              >
                {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Query model</label>
              <select
                value={form.queryModel}
                onChange={(e) => set('queryModel', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-gray-500"
              >
                {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Role</label>
            <input
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-gray-500"
            />
          </div>

          {/* Output format */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Output format</label>
            <textarea
              value={form.outputFormat}
              onChange={(e) => set('outputFormat', e.target.value)}
              rows={2}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-gray-500 resize-none"
            />
          </div>

          {/* Wikilink rules */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Wikilink rules</label>
            <textarea
              value={form.wikilinkRules}
              onChange={(e) => set('wikilinkRules', e.target.value)}
              rows={2}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-gray-500 resize-none"
            />
          </div>

          {/* Naming convention */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Naming convention</label>
            <input
              value={form.namingConvention}
              onChange={(e) => set('namingConvention', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-gray-500"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tags (comma-separated)</label>
            <input
              value={form.tags.join(', ')}
              onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
              placeholder="knowledge, compiled, …"
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>

          {/* Custom instructions */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Custom instructions</label>
            <textarea
              value={form.customInstructions}
              onChange={(e) => set('customInstructions', e.target.value)}
              rows={3}
              placeholder="Any additional instructions for the LLM…"
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
            />
          </div>

          {/* Prompt preview toggle */}
          <div>
            <button
              onClick={() => setPreviewPrompt((v) => !v)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {previewPrompt ? '▾' : '▸'} Preview system prompt
            </button>
            {previewPrompt && (
              <pre className="mt-2 bg-gray-900 border border-gray-800 rounded p-2 text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap">
                {buildPromptPreview(form)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-800 shrink-0 flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 text-xs font-medium bg-blue-900 text-blue-200 hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function buildPromptPreview(c: Conventions): string {
  const tagLine = c.tags.length > 0
    ? `\n- Add these tags: ${c.tags.map((t) => `#${t}`).join(' ')}`
    : ''
  const customLine = c.customInstructions ? `\n\nAdditional instructions: ${c.customInstructions}` : ''
  return `Role: ${c.role}\n\nOutput format: ${c.outputFormat}\n\nWikilink rules: ${c.wikilinkRules}\n\nNaming: ${c.namingConvention}${customLine}${tagLine}`
}
