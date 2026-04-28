'use client'

import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { parseNoteFrontmatter } from '@/lib/vault/frontmatter'
import type { BrowserVaultAdapter } from '@/lib/vault/BrowserVaultAdapter'
import RichMarkdownEditor from '@/components/RichMarkdownEditor'

interface NoteViewerProps {
  content: string
  slug: string
  folder?: 'raw' | 'wiki'
  onWikilinkClick?: (slug: string) => void
  onContentSaved?: (newContent: string) => void
  browserAdapter?: BrowserVaultAdapter | null
}

function wikilinkToSlug(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '-')
}

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
            title={'Open: ' + label}
          >
            {part}
          </button>
        )
      }
      return (
        <span
          key={i}
          className="text-blue-400 bg-blue-950/40 px-0.5 rounded cursor-default"
          title={'Wikilink: ' + label}
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

export default function NoteViewer({ content, slug, folder, onWikilinkClick, onContentSaved, browserAdapter }: NoteViewerProps) {
  const [isEditing, setIsEditing] = useState(true)
  const [editContent, setEditContent] = useState(content)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setEditContent(content)
    setSaveError(null)
    setIsEditing(true)
  }, [content, slug])

  const dirty = editContent !== content

  const handleSave = useCallback(async () => {
    if (!folder || !slug) return
    setSaving(true)
    setSaveError(null)
    try {
      if (browserAdapter) {
        await browserAdapter.writeNote(folder + '/' + slug + '.md', editContent)
      } else {
        const res = await fetch('/api/notes/' + encodeURIComponent(slug) + '?folder=' + folder, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: editContent }),
        })
        if (!res.ok) throw new Error('Save failed')
      }
      onContentSaved?.(editContent)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [browserAdapter, editContent, folder, onContentSaved, slug])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSave()
      }
      if (e.key === 'Escape' && dirty) {
        setEditContent(content)
        setSaveError(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [content, dirty, handleSave])

  const components = makeComponents(onWikilinkClick)
  const parsed = parseNoteFrontmatter(isEditing ? editContent : content)

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <div className="shrink-0 border-b border-gray-800 bg-gray-950/95 px-5 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.7)]" />
              <h2 className="truncate text-sm font-semibold text-gray-100">{slug}</h2>
              {dirty && <span className="rounded bg-amber-950 px-1.5 py-0.5 text-[10px] text-amber-300">Unsaved</span>}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-gray-600">
              {folder && <span>{folder} note</span>}
              <span>MDXEditor rich/source surface</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-gray-800 bg-gray-900 p-1 shadow-sm">
              <button
                onClick={() => setIsEditing(true)}
                className={isEditing
                  ? 'rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-blue-50 shadow-sm'
                  : 'rounded-md px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-200'}
              >
                Editor
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className={!isEditing
                  ? 'rounded-md bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-100 shadow-sm'
                  : 'rounded-md px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-200'}
              >
                Read
              </button>
            </div>
            {isEditing && (
              <>
                <button
                  onClick={() => {
                    setEditContent(content)
                    setSaveError(null)
                  }}
                  disabled={!dirty || saving}
                  className="rounded-md px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Reset
                </button>
                <button
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-blue-50 transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>
        {saveError && <div className="mt-2 text-xs text-red-400">{saveError}</div>}
      </div>

      {isEditing ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <RichMarkdownEditor markdown={editContent} onChange={setEditContent} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-4 flex items-center gap-2 text-xs text-gray-500">
            <span className="uppercase tracking-wide text-gray-600">Date</span>
            <span>{parsed.frontmatter.date ?? 'Undated'}</span>
          </div>
          {parsed.frontmatter.tags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {parsed.frontmatter.tags.map((tag) => (
                <span key={tag} className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {parsed.content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  )
}
