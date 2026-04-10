'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { NoteMetadata } from '@/lib/vault/VaultAdapter'
import type { VaultMode } from './VaultModeBanner'
import type { BrowserVaultAdapter } from '@/lib/vault/BrowserVaultAdapter'

interface ClipPanelProps {
  onClose: () => void
  onClipped: (note: NoteMetadata) => void
  vaultMode: VaultMode
  browserAdapter?: BrowserVaultAdapter | null
}

type Tab = 'url' | 'paste'
type Status = 'idle' | 'loading' | 'success' | 'error'

export default function ClipPanel({ onClose, onClipped, vaultMode, browserAdapter }: ClipPanelProps) {
  const [tab, setTab] = useState<Tab>('url')

  // URL tab state
  const [url, setUrl] = useState('')
  const [urlFilename, setUrlFilename] = useState('')
  const [urlStatus, setUrlStatus] = useState<Status>('idle')
  const [urlError, setUrlError] = useState('')
  const [urlSaved, setUrlSaved] = useState<NoteMetadata | null>(null)

  // Paste tab state
  const [pasteContent, setPasteContent] = useState('')
  const [pasteFilename, setPasteFilename] = useState('')
  const [pasteStatus, setPasteStatus] = useState<Status>('idle')
  const [pasteError, setPasteError] = useState('')
  const [pasteSaved, setPasteSaved] = useState<NoteMetadata | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const urlInputRef = useRef<HTMLInputElement>(null)

  // Focus the URL input on open
  useEffect(() => {
    urlInputRef.current?.focus()
  }, [])

  // Global paste handler: if user pastes a URL, auto-populate URL tab
  const handleGlobalPaste = useCallback((e: ClipboardEvent) => {
    const text = e.clipboardData?.getData('text') ?? ''
    if (text.startsWith('http://') || text.startsWith('https://')) {
      setTab('url')
      setUrl(text)
      setUrlStatus('idle')
      setUrlError('')
      setUrlSaved(null)
      e.preventDefault()
    }
  }, [])

  useEffect(() => {
    window.addEventListener('paste', handleGlobalPaste)
    return () => window.removeEventListener('paste', handleGlobalPaste)
  }, [handleGlobalPaste])

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function handleClipUrl() {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setUrlError('Please enter a URL')
      return
    }
    setUrlStatus('loading')
    setUrlError('')
    setUrlSaved(null)
    try {
      const res = await fetch('/api/clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: trimmedUrl,
          filename: urlFilename.trim() || undefined,
          save: vaultMode !== 'local',
        }),
      })
      const data = await res.json() as (NoteMetadata & { error?: string }) | {
        error?: string
        slug: string
        filename: string
        path: `raw/${string}`
        content: string
      }
      if (!res.ok) {
        setUrlStatus('error')
        setUrlError(('error' in data ? data.error : undefined) ?? 'Clip failed')
      } else {
        if (vaultMode === 'local' && browserAdapter && 'content' in data) {
          await browserAdapter.writeNote(data.path, data.content)
          setUrlSaved({
            slug: data.slug,
            filename: data.filename,
            folder: 'raw',
            path: data.path,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        } else {
          setUrlSaved(data as NoteMetadata)
        }
        setUrlStatus('success')
      }
    } catch {
      setUrlStatus('error')
      setUrlError('Network error — could not clip URL')
    }
  }

  async function handleSavePaste() {
    const trimmedContent = pasteContent.trim()
    if (!trimmedContent) {
      setPasteError('Nothing to save — paste some content first')
      return
    }
    setPasteStatus('loading')
    setPasteError('')
    setPasteSaved(null)

    // Detect if content looks like HTML
    const looksLikeHtml = /<[a-z][\s\S]*>/i.test(trimmedContent)

    try {
      const res = await fetch('/api/clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [looksLikeHtml ? 'html' : 'text']: trimmedContent,
          filename: pasteFilename.trim() || undefined,
          save: vaultMode !== 'local',
        }),
      })
      const data = await res.json() as (NoteMetadata & { error?: string }) | {
        error?: string
        slug: string
        filename: string
        path: `raw/${string}`
        content: string
      }
      if (!res.ok) {
        setPasteStatus('error')
        setPasteError(('error' in data ? data.error : undefined) ?? 'Save failed')
      } else {
        if (vaultMode === 'local' && browserAdapter && 'content' in data) {
          await browserAdapter.writeNote(data.path, data.content)
          setPasteSaved({
            slug: data.slug,
            filename: data.filename,
            folder: 'raw',
            path: data.path,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        } else {
          setPasteSaved(data as NoteMetadata)
        }
        setPasteStatus('success')
      }
    } catch {
      setPasteStatus('error')
      setPasteError('Network error — could not save content')
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/html')
    if (text) {
      setPasteContent(text)
      setPasteStatus('idle')
      setPasteError('')
      setPasteSaved(null)
    }
  }

  function handleCompile(note: NoteMetadata) {
    onClipped(note)
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <h2 className="text-sm font-semibold text-gray-100">Clip to vault</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-4 shrink-0">
          <button
            onClick={() => setTab('url')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              tab === 'url'
                ? 'bg-gray-800 text-gray-100'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            }`}
          >
            Clip URL
          </button>
          <button
            onClick={() => setTab('paste')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              tab === 'paste'
                ? 'bg-gray-800 text-gray-100'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            }`}
          >
            Paste content
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1">
          {tab === 'url' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">URL</label>
                <input
                  ref={urlInputRef}
                  type="url"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setUrlStatus('idle'); setUrlError('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleClipUrl() }}
                  placeholder="https://example.com/article"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  Custom filename <span className="text-gray-600">(optional)</span>
                </label>
                <input
                  type="text"
                  value={urlFilename}
                  onChange={(e) => setUrlFilename(e.target.value)}
                  placeholder="my-article"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
              </div>

              {urlError && (
                <p className="text-xs text-red-400">{urlError}</p>
              )}

              {urlStatus === 'success' && urlSaved && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-2">
                  <p className="text-xs text-emerald-400">
                    Saved → <span className="font-mono text-emerald-300">{urlSaved.path}</span>
                  </p>
                  <button
                    onClick={() => handleCompile(urlSaved)}
                    className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                  >
                    Compile to wiki →
                  </button>
                </div>
              )}

              <button
                onClick={handleClipUrl}
                disabled={urlStatus === 'loading'}
                className="w-full px-3 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {urlStatus === 'loading' ? 'Fetching & clipping…' : 'Clip'}
              </button>
            </div>
          )}

          {tab === 'paste' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  Content <span className="text-gray-600">(HTML or plain text)</span>
                </label>
                <textarea
                  value={pasteContent}
                  onChange={(e) => { setPasteContent(e.target.value); setPasteStatus('idle'); setPasteError('') }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  placeholder="Paste or drop HTML / text here…"
                  rows={8}
                  className={`w-full bg-gray-800 border rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none resize-none font-mono leading-relaxed transition-colors ${
                    isDragOver
                      ? 'border-blue-500 bg-gray-750'
                      : 'border-gray-700 focus:border-gray-500'
                  }`}
                />
                {isDragOver && (
                  <p className="text-xs text-blue-400 mt-1">Drop to paste</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  Filename <span className="text-gray-600">(optional)</span>
                </label>
                <input
                  type="text"
                  value={pasteFilename}
                  onChange={(e) => setPasteFilename(e.target.value)}
                  placeholder="my-notes"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
              </div>

              {pasteError && (
                <p className="text-xs text-red-400">{pasteError}</p>
              )}

              {pasteStatus === 'success' && pasteSaved && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-2">
                  <p className="text-xs text-emerald-400">
                    Saved → <span className="font-mono text-emerald-300">{pasteSaved.path}</span>
                  </p>
                  <button
                    onClick={() => handleCompile(pasteSaved)}
                    className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                  >
                    Compile to wiki →
                  </button>
                </div>
              )}

              <button
                onClick={handleSavePaste}
                disabled={pasteStatus === 'loading'}
                className="w-full px-3 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pasteStatus === 'loading' ? 'Saving…' : 'Save to raw'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
