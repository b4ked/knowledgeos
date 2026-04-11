'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  isFSAccessSupported,
  pickVaultFolder,
  BrowserVaultAdapter,
  saveVaultFolderHandle,
} from '@/lib/vault/BrowserVaultAdapter'
import type { VaultMode } from './VaultModeBanner'

interface SettingsModalProps {
  onClose: () => void
  onSaved?: (msg: string) => void
  onError?: (msg: string) => void
  vaultMode: VaultMode
  browserAdapter?: BrowserVaultAdapter | null
  onVaultModeChange: (mode: VaultMode, adapter?: BrowserVaultAdapter) => void | Promise<void>
  onLocalTokenise?: (folder: 'raw' | 'wiki') => Promise<TokeniseResult>
  onLocalClearRag?: () => Promise<void>
}

interface Settings {
  rawPath?: string
  wikiPath?: string
  presetsPath?: string
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

export default function SettingsModal({
  onClose,
  onSaved,
  onError,
  vaultMode,
  browserAdapter,
  onVaultModeChange,
  onLocalTokenise,
  onLocalClearRag,
}: SettingsModalProps) {
  const { data: session, status: sessionStatus } = useSession()
  const [rawPath, setRawPath] = useState('')
  const [wikiPath, setWikiPath] = useState('')
  const [presetsPath, setPresetsPath] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [rawTokenise, setRawTokenise] = useState<FolderTokeniseState>({ status: 'idle' })
  const [wikiTokenise, setWikiTokenise] = useState<FolderTokeniseState>({ status: 'idle' })
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [pickingFolder, setPickingFolder] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data: Settings) => {
        setRawPath(data.rawPath ?? '')
        setWikiPath(data.wikiPath ?? '')
        setPresetsPath(data.presetsPath ?? '')
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  async function handlePickLocalVault() {
    setPickingFolder(true)
    try {
      const dirHandle = await pickVaultFolder()
      const adapter = new BrowserVaultAdapter(dirHandle)
      await adapter.ensureDirectories()
      await saveVaultFolderHandle(dirHandle).catch(() => {})
      await onVaultModeChange('local', adapter)
      onSaved?.('Switched to local vault')
      onClose()
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        onError?.('Could not open vault folder')
      }
    } finally {
      setPickingFolder(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawPath: rawPath.trim(), wikiPath: wikiPath.trim(), presetsPath: presetsPath.trim() }),
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
      if (vaultMode === 'local') {
        if (!onLocalTokenise) {
          setState({ status: 'error', error: 'Local vault is not connected' })
          return
        }
        const result = await onLocalTokenise(folder)
        setState({ status: 'done', result })
      } else {
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
      }
    } catch (err) {
      setState({ status: 'error', error: err instanceof Error ? err.message : 'Network error' })
    }
  }

  async function handleClearConfirmed() {
    setClearing(true)
    try {
      if (vaultMode === 'local') {
        if (!onLocalClearRag) {
          onError?.('Local RAG database is not available')
          return
        }
        await onLocalClearRag()
        onSaved?.('RAG database cleared')
        setRawTokenise({ status: 'idle' })
        setWikiTokenise({ status: 'idle' })
      } else {
        const res = await fetch('/api/embeddings/clear', { method: 'DELETE' })
        if (res.ok) {
          onSaved?.('RAG database cleared')
          setRawTokenise({ status: 'idle' })
          setWikiTokenise({ status: 'idle' })
        } else {
          onError?.('Failed to clear RAG database')
        }
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
              {/* Vault mode */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  Vault Mode
                </h3>
                <div className="border border-gray-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-300 font-medium">
                        {vaultMode === 'local'
                          ? 'Local vault (your computer)'
                          : vaultMode === 'cloud'
                          ? 'Cloud vault (your account)'
                          : 'Demo vault (remote server)'}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {vaultMode === 'local'
                          ? 'Reading files directly from your local folder'
                          : vaultMode === 'cloud'
                          ? 'Notes stored securely in your account on the server'
                          : 'Using the example vault on the demo server'}
                      </p>
                    </div>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        vaultMode === 'local'
                          ? 'bg-emerald-400'
                          : vaultMode === 'cloud'
                          ? 'bg-blue-400'
                          : 'bg-gray-600'
                      }`}
                    />
                  </div>

                  {!session?.user && sessionStatus !== 'loading' ? (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-2">
                      <p className="text-xs text-gray-400">
                        A free account is required to use local or cloud vault mode.
                      </p>
                      <div className="flex gap-2">
                        <Link
                          href="/signup"
                          onClick={onClose}
                          className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                        >
                          Create free account
                        </Link>
                        <Link
                          href="/login"
                          onClick={onClose}
                          className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-700 rounded transition-colors"
                        >
                          Sign in
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={() => { onVaultModeChange('cloud'); onClose() }}
                        className={`w-full px-3 py-2 text-xs font-medium rounded transition-colors ${
                          vaultMode === 'cloud'
                            ? 'bg-blue-700 text-blue-100'
                            : 'bg-blue-900 text-blue-200 hover:bg-blue-800'
                        }`}
                      >
                        Use cloud vault
                      </button>
                      {isFSAccessSupported() ? (
                        <div className="space-y-2">
                          <button
                            onClick={() => {
                              if (browserAdapter) {
                                onVaultModeChange('local', browserAdapter)
                                onClose()
                              } else {
                                handlePickLocalVault()
                              }
                            }}
                            disabled={pickingFolder}
                            className={`w-full px-3 py-2 text-xs font-medium rounded disabled:opacity-40 transition-colors ${
                              vaultMode === 'local'
                                ? 'bg-emerald-700 text-emerald-100'
                                : 'bg-emerald-900 text-emerald-200 hover:bg-emerald-800'
                            }`}
                          >
                            {pickingFolder
                              ? 'Selecting folder…'
                              : browserAdapter
                              ? 'Use connected local vault'
                              : 'Connect local vault folder'}
                          </button>
                          <button
                            onClick={handlePickLocalVault}
                            disabled={pickingFolder}
                            className="w-full px-3 py-2 text-xs font-medium rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 transition-colors border border-gray-700"
                          >
                            {browserAdapter ? 'Choose a different local folder' : 'Pick local folder'}
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-500">
                          Local vault is not supported in this browser. Use Chrome or Edge.
                        </p>
                      )}
                      <button
                        onClick={() => { onVaultModeChange('remote'); onClose() }}
                        className={`w-full px-3 py-2 text-xs font-medium rounded transition-colors border ${
                          vaultMode === 'remote'
                            ? 'bg-gray-700 text-gray-100 border-gray-600'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border-gray-700'
                        }`}
                      >
                        Use demo vault
                      </button>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  RAG Index
                </h3>
                <p className="text-xs text-gray-600 mb-4">
                  {vaultMode === 'local'
                    ? 'Local vault mode stores embeddings as a .rag-index.json file inside your wiki folder. The index travels with your vault — reopen the same folder in any browser and the index is immediately available.'
                    : vaultMode === 'cloud'
                    ? 'Cloud vault mode stores embeddings in your Supabase/Postgres account database. Chat retrieves from your indexed wiki notes stored there.'
                    : 'Demo mode stores embeddings on the server. Tokenise notes here before using RAG chat.'}
                </p>

                <div className="border border-gray-800 rounded-lg p-4">
                  <label className="block text-xs text-gray-400 mb-1.5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                    Wiki notes index
                  </label>
                  <p className="text-xs text-gray-600 mb-2">
                    Index your compiled wiki notes. Chat answers are grounded in the wiki notes currently present in this vault.
                  </p>
                  <TokeniseRow folder="wiki" />
                </div>
              </section>

              {vaultMode === 'remote' && (
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
                    </div>

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
                    </div>
                  </div>
                </section>
              )}

              {/* Presets folder */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  Presets Folder
                </h3>
                <p className="text-xs text-gray-600 mb-3">
                  Absolute path to a folder on the server where custom convention presets are stored as JSON files.
                </p>
                <input
                  type="text"
                  value={presetsPath}
                  onChange={(e) => setPresetsPath(e.target.value)}
                  placeholder="/path/to/presets"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500 font-mono"
                />
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
