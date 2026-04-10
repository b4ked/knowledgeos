'use client'

import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

interface NoteViewerProps {
  content: string
  slug: string
  folder?: 'raw' | 'wiki'
  onWikilinkClick?: (slug: string) => void
  onContentSaved?: (newContent: string) => void
}

function wikilinkToSlug(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '-')
}

// Render [[wikilinks]] as clickable buttons (or styled spans if no handler)
function processWikilinks(text: string, onWikilinkClick?: (slug: string) => void): React.ReactNode[] {
  const parts = text.split(/(\[\[[^\]]+\]\])/g)
  return parts.map((part, i) => {
    const match = part.match(/^\[\[(.+)\]\]$/)
    if (match) {
      const label = match[1]
      const slug = wikilinkToSlug(label)
      if (onWikilinkClick) {
        return (
          <button
            key={i}
            onClick={() => onWikilinkClick(slug)}
            className="text-blue-400 bg-blue-950/40 px-0.5 rounded hover:text-blue-300 hover:bg-blue-900/50 transition-colors"
            title={`Open: ${label}`}
          >
            {part}
          </button>
        )
      }
      return (
        <span
          key={i}
          className="text-blue-400 bg-blue-950/40 px-0.5 rounded cursor-default"
          title={`Wikilink: ${label}`}
        >
          {part}
        </span>
      )
    }
    return part
  })
}

function makeComponents(onWikilinkClick?: (slug: string) => void): Components {
  return {
  p: ({ children }) => (
    <p className="mb-3 leading-relaxed text-gray-300">
      {typeof children === 'string' ? processWikilinks(children, onWikilinkClick) : children}
    </p>
  ),
  h1: ({ children }) => (
    <h1 className="text-xl font-semibold text-gray-100 mt-6 mb-3 border-b border-gray-800 pb-2">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold text-gray-100 mt-5 mb-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-gray-200 mt-4 mb-2">{children}</h3>
  ),
  ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1 text-gray-300">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1 text-gray-300">{children}</ol>,
  li: ({ children }) => <li className="text-gray-300">{children}</li>,
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <pre className="bg-gray-900 rounded p-3 mb-3 overflow-x-auto text-xs text-gray-300">
          <code>{children}</code>
        </pre>
      )
    }
    return <code className="bg-gray-800 text-blue-300 px-1 py-0.5 rounded text-xs">{children}</code>
  },
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gray-700 pl-4 my-3 text-gray-400 italic">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="text-gray-100 font-semibold">{children}</strong>,
  em: ({ children }) => <em className="text-gray-300 italic">{children}</em>,
  hr: () => <hr className="border-gray-800 my-4" />,
  }
}

type SplitMode = 'split' | 'editor'

export default function NoteViewer({ content, slug, folder, onWikilinkClick, onContentSaved }: NoteViewerProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(content)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [splitMode, setSplitMode] = useState<SplitMode>('split')

  // Sync editContent when note changes
  useEffect(() => {
    setEditContent(content)
    setIsEditing(false)
  }, [content])

  const handleSave = useCallback(async () => {
    if (!folder || !slug) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/notes/${encodeURIComponent(slug)}?folder=${folder}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      })
      if (!res.ok) throw new Error('Save failed')
      setIsEditing(false)
      onContentSaved?.(editContent)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [folder, slug, editContent, onContentSaved])

  // Keyboard shortcuts
  useEffect(() => {
    if (!isEditing) return
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      if (e.key === 'Escape') {
        setIsEditing(false)
        setEditContent(content)
        setSaveError(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isEditing, handleSave, content])

  const components = makeComponents(onWikilinkClick)

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-3 border-b border-gray-800 shrink-0 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-400">{slug}</h2>
        <div className="flex items-center gap-2">
          {isEditing && (
            <div className="flex items-center gap-1 mr-2">
              <button
                onClick={() => setSplitMode('split')}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  splitMode === 'split'
                    ? 'bg-gray-700 text-gray-200'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                }`}
              >
                Split
              </button>
              <button
                onClick={() => setSplitMode('editor')}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  splitMode === 'editor'
                    ? 'bg-gray-700 text-gray-200'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                }`}
              >
                Editor only
              </button>
            </div>
          )}
          {folder && (
            <button
              onClick={() => {
                if (isEditing) {
                  setIsEditing(false)
                  setEditContent(content)
                  setSaveError(null)
                } else {
                  setIsEditing(true)
                }
              }}
              className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-800 transition-colors flex items-center gap-1"
              title={isEditing ? 'Back to preview' : 'Edit note'}
            >
              {isEditing ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                  Preview
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Edit
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            {/* Left pane: raw markdown editor */}
            <div className="flex flex-col flex-1 overflow-hidden min-w-0">
              <div className="px-3 py-1.5 bg-gray-900 border-b border-gray-800 shrink-0">
                <span className="text-xs text-gray-500 font-medium">Edit</span>
              </div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 font-mono text-sm bg-gray-950 text-gray-200 p-4 resize-none w-full h-full outline-none border-0 border-r border-gray-800"
                spellCheck={false}
                autoFocus
              />
            </div>

            {/* Right pane: live preview (only shown in split mode) */}
            {splitMode === 'split' && (
              <div className="flex flex-col flex-1 overflow-hidden min-w-0">
                <div className="px-3 py-1.5 bg-gray-900 border-b border-gray-800 shrink-0">
                  <span className="text-xs text-gray-500 font-medium">Preview</span>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                    {editContent}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* Bottom toolbar */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-t border-gray-800 bg-gray-900">
            {saveError && (
              <span className="text-xs text-red-400 flex-1">{saveError}</span>
            )}
            {!saveError && (
              <span className="text-xs text-gray-600 flex-1">⌘S to save · Esc to cancel</span>
            )}
            <button
              onClick={() => {
                setIsEditing(false)
                setEditContent(content)
                setSaveError(null)
              }}
              className="px-3 py-1 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1 text-xs font-medium bg-blue-900 text-blue-200 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  )
}
