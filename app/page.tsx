'use client'

import { useState, useEffect, useCallback } from 'react'
import type { NoteMetadata } from '@/lib/vault/VaultAdapter'
import NoteList from '@/components/NoteList'
import NoteViewer from '@/components/NoteViewer'
import NewNotePanel from '@/components/NewNotePanel'

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

  useEffect(() => {
    loadNotes(folder)
    setSelectedNote(null)
    setNoteContent('')
    setPanel('viewer')
  }, [folder, loadNotes])

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
    }
    setDeleteConfirm(null)
  }

  function handleNoteSaved(note: NoteMetadata) {
    loadNotes(folder)
    setPanel('viewer')
    handleSelectNote(note)
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey && e.key === 'n') {
        e.preventDefault()
        setPanel('new')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 h-12 shrink-0">
        <span className="text-sm font-semibold tracking-wide text-gray-100">
          KnowledgeOS
        </span>
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
          <button className="px-2 py-1 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors">
            ⌘G
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-gray-800">
            <h1 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Notes
            </h1>
          </div>

          {/* Folder tabs */}
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

          {/* Notes list */}
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
            />
          )}
        </aside>

        {/* Main area */}
        <main className="flex-1 bg-gray-950 overflow-hidden flex flex-col">
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
      </div>

      {/* Delete confirmation dialog */}
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
