'use client'

import { useState, useEffect } from 'react'

interface SettingsModalProps {
  onClose: () => void
  onSaved?: (msg: string) => void
  onError?: (msg: string) => void
}

interface Settings {
  rawPath: string
  wikiPath: string
}

export default function SettingsModal({ onClose, onSaved, onError }: SettingsModalProps) {
  const [rawPath, setRawPath] = useState('')
  const [wikiPath, setWikiPath] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data: Settings) => {
        setRawPath(data.rawPath ?? '')
        setWikiPath(data.wikiPath ?? '')
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawPath: rawPath.trim(), wikiPath: wikiPath.trim() }),
      })
      if (res.ok) {
        onSaved?.('Settings saved')
        onClose()
      } else {
        onError?.('Failed to save settings')
      }
    } catch {
      onError?.('Network error — could not save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-gray-100">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {!loaded ? (
          <p className="text-xs text-gray-600 py-4 text-center">Loading…</p>
        ) : (
          <div className="space-y-5">
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Note Folder Paths
              </h3>
              <p className="text-xs text-gray-600 mb-4">
                Set absolute paths to your raw and wiki note folders. Leave blank to use the
                default <code className="bg-gray-800 px-0.5 rounded text-gray-400">VAULT_PATH/raw</code> and{' '}
                <code className="bg-gray-800 px-0.5 rounded text-gray-400">VAULT_PATH/wiki</code> directories.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    Raw notes folder
                  </label>
                  <input
                    type="text"
                    value={rawPath}
                    onChange={(e) => setRawPath(e.target.value)}
                    placeholder="/Users/you/notes/raw"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                    Wiki notes folder
                  </label>
                  <input
                    type="text"
                    value={wikiPath}
                    onChange={(e) => setWikiPath(e.target.value)}
                    placeholder="/Users/you/notes/wiki"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500 font-mono"
                  />
                </div>
              </div>
            </section>

            <div className="flex gap-2 justify-end pt-2 border-t border-gray-800">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium bg-blue-900 text-blue-200 hover:bg-blue-800 disabled:opacity-40 rounded transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
