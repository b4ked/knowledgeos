'use client'

import { useState, useEffect, useCallback } from 'react'
import type { NoteMetadata } from '@/lib/vault/VaultAdapter'
import type { GraphData } from '@/lib/graph/parseLinks'
import NoteList from '@/components/NoteList'
import NoteViewer from '@/components/NoteViewer'
import NewNotePanel from '@/components/NewNotePanel'
import GraphView from '@/components/GraphView'

type Folder = 'raw' | 'wiki'
type Panel = 'viewer' | 'new'

export default function Home() {
  const [folder, setFolder] = useState<Folder>('raw')
  const [notes, setNotes] = useState<NoteMetadata[]>([])
  const [selectedNote, setSelectedNote] = useState<NoteMetadata | null>(null)
  const [noteContent, setNoteContent] = useState<string>('')
  const [panel, setPanel] = useState<Panel>('viewer')
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<NoteMetadata | null>(null)
  const [checkedSlugs, setCheckedSlugs] = useState<Set<string>>(new Set())
  const [compiling, setCompiling] = useState(false)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [showGraph, setShowGraph] = useState(false)
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] })
  const [graphLoading, setGraphLoading] = useState(false)

  const loadNotes = useCallback(async (f: Folder) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/notes?folder=${f}`)
      if (res.ok) {
        const data = await res.json() as NoteMetadata[]
        setNotes(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const loadGraph = useCallback(async () => {
    setGraphLoading(true)
    try {
      const res = await fetch('/api/graph')
      if (res.ok) {
        setGraphData(await res.json() as GraphData)
      }
    } finally {
      setGraphLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNotes(folder)
    setSelectedNote(null)
    setNoteContent('')
    setPanel('viewer')
    setCheckedSlugs(new Set())
    setCompileError(null)
  }, [folder, loadNotes])

  // Refresh graph when it's open
  useEffect(() => {
    if (showGraph) loadGraph()
  }, [showGraph, loadGraph])

  async function handleSelectNote(note: NoteMetadata) {
    setSelectedNote(note)
    setPanel('viewer')
    const res = await fetch(`/api/notes/${note.slug}?folder=${note.folder}`)
    if (res.ok) {
      const data = await res.json() as { content: string }
      setNoteContent(data.content)
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
    }
    setDeleteConfirm(null)
  }

  function handleNoteSaved(note: NoteMetadata) {
    loadNotes(folder)
    setPanel('viewer')
    handleSelectNote(note)
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
      setTimeout(async () => {
        const wikiRes = await fetch(`/api/notes/${data.slug}?folder=wiki`)
        if (wikiRes.ok) {
          const { content } = await wikiRes.json()
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

  function handleGraphNodeClick(nodeId: string, nodeType: 'wiki' | 'raw' | 'stub') {
    if (nodeType === 'stub') return
    const targetFolder = nodeType === 'wiki' ? 'wiki' : 'raw'
    if (folder !== targetFolder) setFolder(targetFolder)
    // Small delay to let folder switch + notes load before selecting
    setTimeout(async () => {
      const res = await fetch(`/api/notes/${nodeId}?folder=${targetFolder}`)
      if (res.ok) {
        const { content } = await res.json()
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

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey && e.key === 'n') { e.preventDefault(); setPanel('new') }
      if (e.metaKey && e.key === 'g') { e.preventDefault(); setShowGraph((v) => !v) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 h-12 shrink-0">
        <span className="text-sm font-semibold tracking-wide text-gray-100">KnowledgeOS</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPanel('new')}
            className="px-2 py-1 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors"
            title="New note (⌘N)"
          >
            ⌘N
          </button>
          <button className="px-2 py-1 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors">
            ⌘/
          </button>
          <button
            onClick={() => setShowGraph((v) => !v)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              showGraph
                ? 'bg-blue-900 text-blue-200'
                : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
            }`}
            title="Toggle graph (⌘G)"
          >
            ⌘G
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-gray-800">
            <h1 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Notes</h1>
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
            <NoteList
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
        </aside>

        {/* Main area — viewer + optional graph panel */}
        <div className="flex flex-1 overflow-hidden">
          {/* Viewer / New note panel */}
          <main className="flex-1 bg-gray-950 overflow-hidden flex flex-col min-w-0">
            {panel === 'new' ? (
              <NewNotePanel
                defaultFolder={folder}
                onSave={handleNoteSaved}
                onCancel={() => setPanel('viewer')}
              />
            ) : selectedNote ? (
              <NoteViewer content={noteContent} slug={selectedNote.slug} />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Select a note</p>
                  <p className="text-xs text-gray-700 mt-1">or press ⌘N to create one</p>
                </div>
              </div>
            )}
          </main>

          {/* Graph panel */}
          {showGraph && (
            <aside className="w-96 bg-gray-950 border-l border-gray-800 flex flex-col shrink-0">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                  Graph
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> wiki
                    <span className="w-2 h-2 rounded-full bg-orange-500 inline-block ml-1" /> raw
                    <span className="w-2 h-2 rounded-full bg-gray-600 inline-block ml-1" /> stub
                  </div>
                  <button
                    onClick={loadGraph}
                    disabled={graphLoading}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
                    title="Refresh graph"
                  >
                    ↻
                  </button>
                </div>
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
                  <GraphView data={graphData} onNodeClick={handleGraphNodeClick} />
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
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
