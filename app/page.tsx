'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { NoteMetadata } from '@/lib/vault/VaultAdapter'
import type { GraphData } from '@/lib/graph/parseLinks'
import FolderTree from '@/components/FolderTree'
import NoteViewer from '@/components/NoteViewer'
import NewNotePanel from '@/components/NewNotePanel'
import GraphView from '@/components/GraphView'
import ChatPanel from '@/components/ChatPanel'
import ConventionsEditor from '@/components/ConventionsEditor'
import SettingsModal from '@/components/SettingsModal'
import VaultModeBanner from '@/components/VaultModeBanner'
import RAGPanel from '@/components/RAGPanel'
import ToastStack from '@/components/ToastStack'
import { useToast } from '@/lib/toast/useToast'
import type { VaultMode } from '@/components/VaultModeBanner'
import type { BrowserVaultAdapter } from '@/lib/vault/BrowserVaultAdapter'

type Folder = 'raw' | 'wiki'
type Panel = 'viewer' | 'new'

export default function Home() {
  const [folder, setFolder] = useState<Folder>('wiki')
  const [notes, setNotes] = useState<NoteMetadata[]>([])
  const [selectedNote, setSelectedNote] = useState<NoteMetadata | null>(null)
  const [noteContent, setNoteContent] = useState<string>('')
  const [panel, setPanel] = useState<Panel>('viewer')
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<NoteMetadata | null>(null)
  const [checkedSlugs, setCheckedSlugs] = useState<Set<string>>(new Set())
  const [compiling, setCompiling] = useState(false)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [showGraph, setShowGraph] = useState(true)
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] })
  const [graphLoading, setGraphLoading] = useState(false)
  const [showChat, setShowChat] = useState(true)
  const [showConventions, setShowConventions] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showRAG, setShowRAG] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(256)
  const [vaultMode, setVaultMode] = useState<VaultMode>('remote')
  const browserAdapterRef = useRef<BrowserVaultAdapter | null>(null)
  const [highlightedSlugs, setHighlightedSlugs] = useState<Set<string>>(new Set())
  const [chatWidth, setChatWidth] = useState(320)
  const isResizingChat = useRef(false)
  const isResizingSidebar = useRef(false)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(320)
  const resizeStartXSidebar = useRef(0)
  const resizeStartWidthSidebar = useRef(256)
  const { toasts, addToast, removeToast } = useToast()

  function handleVaultModeChange(mode: VaultMode, adapter?: BrowserVaultAdapter) {
    browserAdapterRef.current = adapter ?? null
    setVaultMode(mode)
  }

  const loadNotes = useCallback(async (f: Folder) => {
    setLoading(true)
    try {
      if (vaultMode === 'local' && browserAdapterRef.current) {
        const data = await browserAdapterRef.current.listNotes(f)
        setNotes(data)
      } else {
        const res = await fetch(`/api/notes?folder=${f}`)
        if (res.ok) {
          const data = await res.json() as NoteMetadata[]
          setNotes(data)
        }
      }
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultMode])

  const loadGraph = useCallback(async () => {
    setGraphLoading(true)
    try {
      if (vaultMode === 'local' && browserAdapterRef.current) {
        const adapter = browserAdapterRef.current
        const [wikiMeta, rawMeta] = await Promise.all([
          adapter.listNotes('wiki'),
          adapter.listNotes('raw'),
        ])
        const { parseLinks } = await import('@/lib/graph/parseLinks')
        const [wikiNotes, rawNotes] = await Promise.all([
          Promise.all(wikiMeta.map(async (m) => ({
            slug: m.slug,
            content: await adapter.readNote(m.path).catch(() => ''),
            type: 'wiki' as const,
          }))),
          Promise.all(rawMeta.map(async (m) => ({
            slug: m.slug,
            content: await adapter.readNote(m.path).catch(() => ''),
            type: 'raw' as const,
          }))),
        ])
        setGraphData(parseLinks([...wikiNotes, ...rawNotes]))
      } else {
        const res = await fetch('/api/graph')
        if (res.ok) {
          setGraphData(await res.json() as GraphData)
        }
      }
    } finally {
      setGraphLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultMode])

  useEffect(() => {
    loadNotes(folder)
    setSelectedNote(null)
    setNoteContent('')
    setPanel('viewer')
    setCheckedSlugs(new Set())
    setCompileError(null)
  }, [folder, loadNotes, vaultMode])

  useEffect(() => {
    if (showGraph) loadGraph()
  }, [showGraph, loadGraph])

  // Open graph: close note viewer
  function openGraph() {
    setShowGraph(true)
    setSelectedNote(null)
    setNoteContent('')
    setPanel('viewer')
  }

  function closeGraph() {
    setShowGraph(false)
  }

  function toggleGraph() {
    if (showGraph) closeGraph()
    else openGraph()
  }

  async function handleSelectNote(note: NoteMetadata) {
    setShowGraph(false)
    setSelectedNote(note)
    setPanel('viewer')
    if (vaultMode === 'local' && browserAdapterRef.current) {
      const content = await browserAdapterRef.current.readNote(note.path).catch(() => '')
      setNoteContent(content)
    } else {
      const res = await fetch(`/api/notes/${note.slug}?folder=${note.folder}`)
      if (res.ok) {
        const data = await res.json() as { content: string }
        setNoteContent(data.content)
      }
    }
  }

  async function handleDeleteNote(note: NoteMetadata) {
    setDeleteConfirm(note)
  }

  async function confirmDelete() {
    if (!deleteConfirm) return
    const res = await fetch(
      `/api/notes/${deleteConfirm.slug}?folder=${deleteConfirm.folder}`,
      { method: 'DELETE' }
    )
    if (res.ok || res.status === 204) {
      if (selectedNote?.slug === deleteConfirm.slug) {
        setSelectedNote(null)
        setNoteContent('')
      }
      await loadNotes(folder)
      if (showGraph) loadGraph()
      addToast(`Deleted ${deleteConfirm.slug}`, 'info')
    }
    setDeleteConfirm(null)
  }

  function handleNoteSaved(note: NoteMetadata) {
    loadNotes(folder)
    setPanel('viewer')
    handleSelectNote(note)
    addToast(`Saved ${note.slug}`, 'success')
  }

  function handleCheck(slug: string, isChecked: boolean) {
    setCheckedSlugs((prev) => {
      const next = new Set(prev)
      if (isChecked) next.add(slug)
      else next.delete(slug)
      return next
    })
  }

  async function handleCompile() {
    if (checkedSlugs.size === 0) return
    setCompiling(true)
    setCompileError(null)

    const notePaths = notes
      .filter((n) => checkedSlugs.has(n.slug))
      .map((n) => n.path)

    try {
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notePaths }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCompileError(data.error ?? 'Compilation failed')
        return
      }
      setCheckedSlugs(new Set())
      setFolder('wiki')
      if (showGraph) loadGraph()
      addToast(`Compiled → ${data.slug}`, 'success')
      setTimeout(async () => {
        const wikiRes = await fetch(`/api/notes/${data.slug}?folder=wiki`)
        if (wikiRes.ok) {
          const { content } = await wikiRes.json()
          setShowGraph(false)
          setSelectedNote({
            slug: data.slug,
            filename: `${data.slug}.md`,
            folder: 'wiki',
            path: `wiki/${data.slug}.md`,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          setNoteContent(content)
        }
      }, 300)
    } catch {
      setCompileError('Network error — could not compile')
    } finally {
      setCompiling(false)
    }
  }

  async function handleWikilinkClick(slug: string) {
    setFolder('wiki')
    setShowGraph(false)
    const res = await fetch(`/api/notes/${slug}?folder=wiki`)
    if (res.ok) {
      const { content } = await res.json()
      setSelectedNote({
        slug,
        filename: `${slug}.md`,
        folder: 'wiki',
        path: `wiki/${slug}.md`,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      setNoteContent(content)
      setPanel('viewer')
    } else {
      addToast(`Note not found: ${slug}`, 'error')
    }
  }

  async function handleChatSourceClick(slug: string) {
    setFolder('wiki')
    setShowGraph(false)
    setTimeout(async () => {
      const res = await fetch(`/api/notes/${slug}?folder=wiki`)
      if (res.ok) {
        const { content } = await res.json()
        setSelectedNote({
          slug,
          filename: `${slug}.md`,
          folder: 'wiki',
          path: `wiki/${slug}.md`,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        setNoteContent(content)
        setPanel('viewer')
      }
    }, 150)
  }

  function handleGraphNodeClick(nodeId: string, nodeType: 'wiki' | 'raw' | 'stub') {
    if (nodeType === 'stub') return
    const targetFolder = nodeType === 'wiki' ? 'wiki' : 'raw'
    if (folder !== targetFolder) setFolder(targetFolder)
    setTimeout(async () => {
      const res = await fetch(`/api/notes/${nodeId}?folder=${targetFolder}`)
      if (res.ok) {
        const { content } = await res.json()
        setShowGraph(false)
        setSelectedNote({
          slug: nodeId,
          filename: `${nodeId}.md`,
          folder: targetFolder,
          path: `${targetFolder}/${nodeId}.md`,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        setNoteContent(content)
        setPanel('viewer')
      }
    }, 150)
  }

  // Resize drag — sidebar (right edge) and chat (left edge)
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (isResizingSidebar.current) {
        const delta = e.clientX - resizeStartXSidebar.current
        setSidebarWidth(Math.max(160, Math.min(480, resizeStartWidthSidebar.current + delta)))
      }
      if (isResizingChat.current) {
        const delta = resizeStartX.current - e.clientX
        setChatWidth(Math.max(200, Math.min(960, resizeStartWidth.current + delta)))
      }
    }
    function onMouseUp() {
      isResizingChat.current = false
      isResizingSidebar.current = false
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey && e.key === 'n') { e.preventDefault(); setPanel('new') }
      if (e.metaKey && e.key === 'g') { e.preventDefault(); toggleGraph() }
      if (e.metaKey && e.key === '/') { e.preventDefault(); setShowChat((v) => !v) }
      if (e.metaKey && e.key === ',') { e.preventDefault(); setShowConventions((v) => !v) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGraph])

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 h-12 shrink-0">
        <span className="text-sm font-semibold tracking-wide text-gray-100">KnowledgeOS</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPanel('new')}
            className="px-3 py-1 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors"
            title="New note (⌘N)"
          >
            New Note
          </button>
          <button
            onClick={() => setShowChat((v) => !v)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              showChat ? 'bg-blue-900 text-blue-200' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
            }`}
            title="Toggle chat (⌘/)"
          >
            Chat
          </button>
          <button
            onClick={toggleGraph}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              showGraph ? 'bg-blue-900 text-blue-200' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
            }`}
            title="Toggle graph (⌘G)"
          >
            Graph
          </button>
          <button
            onClick={() => setShowConventions((v) => !v)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              showConventions ? 'bg-blue-900 text-blue-200' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
            }`}
            title="Conventions (⌘,)"
          >
            Conventions
          </button>
          <button
            onClick={() => setShowRAG(true)}
            className="px-3 py-1 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors"
            title="RAG index"
          >
            RAG
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="px-3 py-1 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors"
            title="Settings"
          >
            Settings
          </button>
        </div>
      </header>

      <VaultModeBanner
        mode={vaultMode}
        onSwitch={() => setShowSettings(true)}
      />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar collapse strip */}
        {!sidebarOpen && (
          <div className="w-8 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-3 shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-200 transition-colors"
              title="Show sidebar"
            >
              ›
            </button>
          </div>
        )}

        {/* Sidebar */}
        {sidebarOpen && (
          <aside
            className="bg-gray-900 border-r border-gray-800 flex flex-row shrink-0"
            style={{ width: sidebarWidth }}
          >
          <div className="flex flex-col flex-1 min-w-0">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <h1 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Notes</h1>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-gray-600 hover:text-gray-300 transition-colors text-sm leading-none"
                title="Hide sidebar"
              >
                ‹
              </button>
            </div>

            <div className="flex gap-1 px-3 py-2 border-b border-gray-800">
              {(['raw', 'wiki'] as Folder[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFolder(f)}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    folder === f
                      ? 'bg-gray-800 text-gray-100'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-gray-600">Loading…</p>
              </div>
            ) : (
              <FolderTree
                notes={notes}
                selectedSlug={selectedNote?.slug ?? null}
                onSelect={handleSelectNote}
                onDelete={handleDeleteNote}
                checkable={folder === 'raw'}
                checked={checkedSlugs}
                onCheck={handleCheck}
              />
            )}

            {folder === 'raw' && (
              <div className="shrink-0 px-3 py-2 border-t border-gray-800">
                {compileError && (
                  <p className="text-xs text-red-400 mb-2 truncate" title={compileError}>
                    {compileError}
                  </p>
                )}
                <button
                  onClick={handleCompile}
                  disabled={checkedSlugs.size === 0 || compiling}
                  className="w-full px-3 py-2 text-xs font-medium rounded transition-colors bg-blue-900 text-blue-200 hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {compiling
                    ? 'Compiling…'
                    : checkedSlugs.size > 0
                    ? `Compile Selected (${checkedSlugs.size})`
                    : 'Compile Selected'}
                </button>
              </div>
            )}
          </div>

          {/* Sidebar resize handle — right edge */}
          <div
            className="w-1 shrink-0 cursor-col-resize bg-gray-800 hover:bg-blue-500 active:bg-blue-400 transition-colors select-none"
            onMouseDown={(e) => {
              isResizingSidebar.current = true
              resizeStartXSidebar.current = e.clientX
              resizeStartWidthSidebar.current = sidebarWidth
              e.preventDefault()
            }}
          />
          </aside>
        )}

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden min-w-0">

          {/* Note viewer — hidden when graph is open */}
          {!showGraph && (
            <main className="flex-1 bg-gray-950 overflow-hidden flex flex-col min-w-0">
              {panel === 'new' ? (
                <NewNotePanel
                  defaultFolder={folder}
                  onSave={handleNoteSaved}
                  onCancel={() => setPanel('viewer')}
                />
              ) : selectedNote ? (
                <NoteViewer
                  content={noteContent}
                  slug={selectedNote.slug}
                  onWikilinkClick={handleWikilinkClick}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    {notes.length === 0 && !loading ? (
                      <>
                        <p className="text-sm text-gray-500 font-medium">Welcome to KnowledgeOS</p>
                        <div className="text-xs text-gray-600 space-y-1">
                          <p>1. Press <kbd className="bg-gray-800 px-1 py-0.5 rounded text-gray-400">⌘N</kbd> to create your first raw note</p>
                          <p>2. Select notes and click <span className="text-blue-400">Compile Selected</span> to generate wiki notes</p>
                          <p>3. Press <kbd className="bg-gray-800 px-1 py-0.5 rounded text-gray-400">⌘/</kbd> to chat with your vault</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-gray-600">Select a note</p>
                        <p className="text-xs text-gray-700">or press ⌘N to create one</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </main>
          )}

          {/* Graph panel */}
          {showGraph && (
            <aside className="flex-1 bg-gray-950 flex flex-col min-w-0">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Graph</span>
                <button
                  onClick={loadGraph}
                  disabled={graphLoading}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
                  title="Refresh graph"
                >
                  ↻
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                {graphLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-xs text-gray-600">Loading graph…</p>
                  </div>
                ) : graphData.nodes.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-xs text-gray-600">No notes yet</p>
                  </div>
                ) : (
                  <GraphView
                    data={graphData}
                    onNodeClick={handleGraphNodeClick}
                    highlightedSlugs={highlightedSlugs}
                  />
                )}
              </div>
            </aside>
          )}

          {/* Chat panel — resizable, coexists with graph */}
          {showChat && (
            <aside
              className="bg-gray-950 border-l border-gray-800 flex flex-row shrink-0"
              style={{ width: chatWidth }}
            >
              {/* Drag handle */}
              <div
                className="w-1 shrink-0 cursor-col-resize bg-gray-800 hover:bg-blue-500 active:bg-blue-400 transition-colors select-none"
                onMouseDown={(e) => {
                  isResizingChat.current = true
                  resizeStartX.current = e.clientX
                  resizeStartWidth.current = chatWidth
                  e.preventDefault()
                }}
              />
              <div className="flex-1 flex flex-col min-w-0">
                <ChatPanel
                  onSourceClick={handleChatSourceClick}
                  onSourcesUpdate={(slugs) => setHighlightedSlugs(new Set(slugs))}
                />
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Conventions editor overlay */}
      {showConventions && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-end z-40 pt-12">
          <aside className="w-96 h-full bg-gray-900 border-l border-gray-800 flex flex-col shadow-2xl">
            <ConventionsEditor
              onClose={() => setShowConventions(false)}
              onSaved={(msg) => addToast(msg, 'success')}
              onError={(msg) => addToast(msg, 'error')}
            />
          </aside>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onSaved={(msg) => addToast(msg, 'success')}
          onError={(msg) => addToast(msg, 'error')}
          vaultMode={vaultMode}
          onVaultModeChange={handleVaultModeChange}
        />
      )}

      {/* RAG index panel */}
      {showRAG && <RAGPanel onClose={() => setShowRAG(false)} />}

      <ToastStack toasts={toasts} onDismiss={removeToast} />

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-sm font-semibold text-gray-100 mb-2">Delete note?</h3>
            <p className="text-xs text-gray-400 mb-4">
              <span className="text-gray-200">{deleteConfirm.slug}</span> will be permanently deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-1.5 text-xs font-medium bg-red-900 text-red-200 hover:bg-red-800 rounded transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
