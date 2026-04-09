'use client'

import { useState, useEffect } from 'react'

interface SettingsModalProps {
  onClose: () => void
  onSaved?: (msg: string) => void
  onError?: (msg: string) => void
}

interface Settings {
  rawPath?: string
  wikiPath?: string
}

interface TokeniseResult {
  indexed: number
  skipped: number
  total: number
  errors: string[]
}

interface FolderTokeniseState {
  status: 'idle' | 'running' | 'done' | 'error'
  result?: TokeniseResult
  error?: string
}

export default function SettingsModal({ onClose, onSaved, onError }: SettingsModalProps) {
  const [rawPath, setRawPath] = useState('')
  const [wikiPath, setWikiPath] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [rawTokenise, setRawTokenise] = useState<FolderTokeniseState>({ status: 'idle' })
  const [wikiTokenise, setWikiTokenise] = useState<FolderTokeniseState>({ status: 'idle' })
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)

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

  async function handleTokenise(folder: 'raw' | 'wiki') {
    const setState = folder === 'raw' ? setRawTokenise : setWikiTokenise
    setState({ status: 'running' })
    try {
      const res = await fetch('/api/embeddings/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder }),
      })
      const data = await res.json() as TokeniseResult & { error?: string }
      if (!res.ok) {
        setState({ status: 'error', error: data.error ?? 'Tokenisation failed' })
      } else {
        setState({ status: 'done', result: data })
      }
    } catch {
      setState({ status: 'error', error: 'Network error' })
    }
  }

  async function handleClearConfirmed() {
    setClearing(true)
    try {
      const res = await fetch('/api/embeddings/clear', { method: 'DELETE' })
      if (res.ok) {
        onSaved?.('RAG database cleared')
        setRawTokenise({ status: 'idle' })
        setWikiTokenise({ status: 'idle' })
      } else {
        onError?.('Failed to clear RAG database')
      }
    } catch {
      onError?.('Network error — could not clear database')
    } finally {
      setClearing(false)
      setClearConfirm(false)
    }
  }

  function TokeniseRow({ folder }: { folder: 'raw' | 'wiki' }) {
    const state = folder === 'raw' ? rawTokenise : wikiTokenise
    const accentColor = folder === 'raw' ? 'text-red-400' : 'text-blue-400'

    return (
      <div className="mt-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleTokenise(folder)}
            disabled={state.status === 'running' || clearing}
            className="px-3 py-1.5 text-xs font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-gray-100 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors border border-gray-700"
          >
            {state.status === 'running' ? 'Tokenising…' : 'Tokenise for RAG'}
          </button>
          <button
            onClick={() => setClearConfirm(true)}
            disabled={state.status === 'running' || clearing}
            className="px-3 py-1.5 text-xs font-medium bg-gray-800 text-red-500 hover:bg-red-950 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors border border-gray-700"
          >
            Clear RAG Database
          </button>
        </div>

        {state.status === 'done' && state.result && (
          <p className={`text-xs mt-1.5 ${accentColor}`}>
            {state.result.indexed > 0
              ? `✓ ${state.result.indexed} new file${state.result.indexed !== 1 ? 's' : ''} indexed`
              : '✓ All files already indexed'}
            {state.result.skipped > 0 && (
              <span className="text-gray-500"> · {state.result.skipped} skipped</span>
            )}
            {state.result.errors.length > 0 && (
              <span className="text-red-400"> · {state.result.errors.length} error{state.result.errors.length !== 1 ? 's' : ''}</span>
            )}
          </p>
        )}
        {state.status === 'error' && (
          <p className="text-xs mt-1.5 text-red-400">{state.error}</p>
        )}
      </div>
    )
  }

  return (
    <>
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
                  {/* Raw */}
                  <div className="border border-gray-800 rounded-lg p-4">
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
                    <TokeniseRow folder="raw" />
                  </div>

                  {/* Wiki */}
                  <div className="border border-gray-800 rounded-lg p-4">
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
                    <TokeniseRow folder="wiki" />
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

      {/* Clear confirmation popup */}
      {clearConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60">
          <div className="bg-gray-900 border border-red-900 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-gray-100 mb-2">Clear RAG Database?</h3>
            <p className="text-xs text-gray-400 mb-5">
              This will permanently delete all tokenised embeddings. Your notes will not be affected,
              but you will need to re-tokenise before using RAG chat again.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setClearConfirm(false)}
                disabled={clearing}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearConfirmed}
                disabled={clearing}
                className="px-3 py-1.5 text-xs font-medium bg-red-900 text-red-200 hover:bg-red-800 disabled:opacity-40 rounded transition-colors"
              >
                {clearing ? 'Clearing…' : 'Yes, Clear Database'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
