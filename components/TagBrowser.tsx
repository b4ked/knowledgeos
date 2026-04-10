'use client'

import { useState, useEffect } from 'react'

interface Tag { name: string; count: number }

interface TagBrowserProps {
  activeTag: string | null
  onTagSelect: (tag: string | null) => void
}

export default function TagBrowser({ activeTag, onTagSelect }: TagBrowserProps) {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch('/api/tags')
      .then(r => r.json())
      .then((d: { tags: Tag[] }) => setTags(d.tags ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-800 shrink-0">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Tags</h2>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-gray-600">Loading…</p>
        </div>
      ) : tags.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-xs text-gray-600">No tags found</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-wrap gap-1.5 content-start">
          {activeTag && (
            <button
              onClick={() => onTagSelect(null)}
              className="px-2 py-0.5 text-xs rounded bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
            >
              × Clear
            </button>
          )}
          {tags.map(tag => (
            <button
              key={tag.name}
              onClick={() => onTagSelect(activeTag === tag.name ? null : tag.name)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                activeTag === tag.name
                  ? 'bg-blue-700 text-blue-100'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-gray-100'
              }`}
            >
              #{tag.name}
              <span className="ml-1 text-gray-500">{tag.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
