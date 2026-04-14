'use client'

import { useState, useEffect } from 'react'
import type { Conventions } from '@/lib/conventions/types'
import { DEFAULT_CONVENTIONS, BUILT_IN_PRESETS, buildSystemPrompt } from '@/lib/conventions/defaults'

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
  const [customPresets, setCustomPresets] = useState<string[]>([])
  const [savePresetName, setSavePresetName] = useState('')
  const [savingPreset, setSavingPreset] = useState(false)
  const [deletingPreset, setDeletingPreset] = useState<string | null>(null)
  const [activePreset, setActivePreset] = useState<'default' | string>('default')

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
    setActivePreset(key)
    setForm((prev) => ({ ...DEFAULT_CONVENTIONS, ...prev, ...preset }))
  }

  async function loadCustomPreset(name: string) {
    const res = await fetch(`/api/presets/${encodeURIComponent(name)}`)
    if (!res.ok) { onError(`Could not load preset "${name}"`); return }
    const preset = await res.json() as Partial<Conventions>
    setActivePreset(name)
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
      setActivePreset(name)
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
        onError(data.error ?? 'Failed to save')
      } else {
        onSaved('Presets saved')
        onClose()
      }
    } catch {
      onError('Network error — could not save')
    } finally {
      setSaving(false)
    }
  }

  const modelOptions = form.provider === 'openai' ? OPENAI_MODELS : ANTHROPIC_MODELS

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-4xl mx-4 flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 shrink-0 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-100">Presets</span>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none">×</button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <p className="text-xs text-gray-600">Loading…</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-0 divide-x divide-gray-800">

              {/* Left column — preset settings */}
              <div className="px-6 py-4 space-y-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Configuration</h3>

                {/* Built-in presets */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Built-in presets</label>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(BUILT_IN_PRESETS).map((key) => (
                      <button
                        key={key}
                        onClick={() => applyBuiltInPreset(key)}
                        className={`px-2 py-1 text-xs rounded transition-colors capitalize ${
                          activePreset === key ? 'bg-blue-700 text-blue-100' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {key === 'default' ? 'Default' : key}
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
                            className={`px-2 py-1 text-xs rounded-l transition-colors ${
                              activePreset === name ? 'bg-amber-700 text-amber-100' : 'bg-gray-800 text-amber-300 hover:bg-gray-700'
                            }`}
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
                      placeholder="Save current as preset…"
                      className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500"
                    />
                    <button
                      onClick={saveCustomPreset}
                      disabled={!savePresetName.trim() || savingPreset}
                      className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 transition-colors whitespace-nowrap"
                    >
                      {savingPreset ? 'Saving…' : 'Save'}
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
                    className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-gray-500"
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
                      className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-gray-500"
                    >
                      {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Query model</label>
                    <select
                      value={form.queryModel}
                      onChange={(e) => set('queryModel', e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-gray-500"
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
                    className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-gray-500"
                  />
                </div>

                {/* Output format */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Output format</label>
                  <textarea
                    value={form.outputFormat}
                    onChange={(e) => set('outputFormat', e.target.value)}
                    rows={2}
                    className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-gray-500 resize-none"
                  />
                </div>

                {/* Wikilink rules */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Wikilink rules</label>
                  <textarea
                    value={form.wikilinkRules}
                    onChange={(e) => set('wikilinkRules', e.target.value)}
                    rows={2}
                    className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-gray-500 resize-none"
                  />
                </div>

                {/* Naming convention */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Naming convention</label>
                  <input
                    value={form.namingConvention}
                    onChange={(e) => set('namingConvention', e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-gray-500"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tags (comma-separated)</label>
                  <input
                    value={form.tags.join(', ')}
                    onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
                    placeholder="knowledge, compiled, …"
                    className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500"
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
                    className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
                  />
                </div>
              </div>

              {/* Right column — live system prompt preview */}
              <div className="px-6 py-4 flex flex-col">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">System prompt preview</h3>
                {activePreset === 'default' ? (
                  <div className="flex-1 rounded border border-gray-800 bg-gray-950 p-3 text-xs text-gray-500">
                    The system prompt for the built-in Default preset is hidden.
                  </div>
                ) : (
                  <pre className="flex-1 bg-gray-950 border border-gray-800 rounded p-3 text-xs text-gray-400 overflow-auto whitespace-pre-wrap font-mono leading-relaxed">
                    {buildSystemPrompt(form)}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-800 shrink-0 flex gap-2 justify-end">
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
            {saving ? 'Saving…' : 'Save as default'}
          </button>
        </div>
      </div>
    </div>
  )
}
