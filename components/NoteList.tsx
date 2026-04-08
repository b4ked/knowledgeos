'use client'

import type { NoteMetadata } from '@/lib/vault/VaultAdapter'

interface NoteListProps {
  notes: NoteMetadata[]
  selectedSlug: string | null
  onSelect: (note: NoteMetadata) => void
  onDelete: (note: NoteMetadata) => void
  checkable?: boolean
  checked?: Set<string>
  onCheck?: (slug: string, checked: boolean) => void
}

export default function NoteList({
  notes,
  selectedSlug,
  onSelect,
  onDelete,
  checkable = false,
  checked = new Set(),
  onCheck,
}: NoteListProps) {
  if (notes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-xs text-gray-600">No notes yet</p>
      </div>
    )
  }

  return (
    <ul className="flex-1 overflow-y-auto py-1">
      {notes.map((note) => (
        <li key={note.path} className="group relative flex items-center">
          {checkable && (
            <input
              type="checkbox"
              checked={checked.has(note.slug)}
              onChange={(e) => onCheck?.(note.slug, e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="ml-3 shrink-0 accent-blue-500 cursor-pointer"
              aria-label={`Select ${note.slug} for compilation`}
            />
          )}
          <button
            onClick={() => onSelect(note)}
            className={`flex-1 text-left px-3 py-2 text-xs truncate transition-colors ${
              selectedSlug === note.slug
                ? 'bg-gray-700 text-gray-100'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
            } ${checkable ? '' : 'px-4'}`}
          >
            {note.slug}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(note)
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center justify-center w-5 h-5 text-gray-500 hover:text-red-400 transition-colors"
            title="Delete note"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}
