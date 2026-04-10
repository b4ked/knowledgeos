'use client'

import { useState } from 'react'
import type { NoteMetadata } from '@/lib/vault/VaultAdapter'

interface FolderTreeProps {
  notes: NoteMetadata[]
  selectedSlug: string | null
  onSelect: (note: NoteMetadata) => void
  onDelete: (note: NoteMetadata) => void
  checkable?: boolean
  checked?: Set<string>
  onCheck?: (slug: string, checked: boolean) => void
  onCreateNote?: (folderPath?: string) => void
  onCreateFolder?: (folderPath: string) => void
}

interface TreeFile {
  kind: 'file'
  note: NoteMetadata
  name: string
}

interface TreeFolder {
  kind: 'folder'
  name: string
  path: string
  children: TreeNode[]
}

type TreeNode = TreeFile | TreeFolder

function buildTree(notes: NoteMetadata[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const note of notes) {
    const parts = note.slug.split('/')
    let nodes = root
    const pathParts: string[] = []

    for (let i = 0; i < parts.length - 1; i++) {
      const dirName = parts[i]
      pathParts.push(dirName)
      let folder = nodes.find((n): n is TreeFolder => n.kind === 'folder' && n.name === dirName)
      if (!folder) {
        folder = { kind: 'folder', name: dirName, path: pathParts.join('/'), children: [] }
        nodes.push(folder)
      }
      nodes = folder.children
    }

    nodes.push({ kind: 'file', note, name: parts[parts.length - 1] })
  }

  return root
}

function FolderNode({
  node,
  depth,
  selectedSlug,
  onSelect,
  onDelete,
  checkable,
  checked,
  onCheck,
  onCreateNote,
  onCreateFolder,
  defaultOpen,
}: {
  node: TreeNode
  depth: number
  selectedSlug: string | null
  onSelect: (note: NoteMetadata) => void
  onDelete: (note: NoteMetadata) => void
  checkable?: boolean
  checked?: Set<string>
  onCheck?: (slug: string, checked: boolean) => void
  onCreateNote?: (folderPath?: string) => void
  onCreateFolder?: (folderPath: string) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? true)
  const indent = depth * 12

  if (node.kind === 'file') {
    const note = node.note
    const isSelected = selectedSlug === note.slug
    return (
      <li className="group relative flex items-center">
        {checkable && (
          <input
            type="checkbox"
            checked={checked?.has(note.slug) ?? false}
            onChange={(e) => onCheck?.(note.slug, e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 accent-blue-500 cursor-pointer"
            style={{ marginLeft: indent + 8 }}
            aria-label={`Select ${note.slug}`}
          />
        )}
        <button
          onClick={() => onSelect(note)}
          className={`flex-1 text-left py-1 text-xs truncate transition-colors flex items-center gap-1 ${
            isSelected
              ? 'bg-gray-700 text-gray-100'
              : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
          }`}
          style={{ paddingLeft: checkable ? 6 : indent + 8 }}
        >
          <span className="text-gray-600 shrink-0">›</span>
          <span className="truncate">{node.name}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(note) }}
          className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center justify-center w-5 h-5 text-gray-500 hover:text-red-400 transition-colors"
          title="Delete note"
        >
          ×
        </button>
      </li>
    )
  }

  return (
    <li>
      <div className="group flex items-center">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-1 text-left py-1 text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
          style={{ paddingLeft: indent + 8 }}
        >
          <span className="shrink-0">{open ? '▾' : '▸'}</span>
          <span className="font-medium">{node.name}</span>
        </button>
        {onCreateNote && (
          <button
            onClick={(e) => { e.stopPropagation(); onCreateNote(node.path) }}
            className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-gray-300 text-xs px-2 py-1 transition-opacity"
            title={`New note in ${node.name}`}
          >
            +
          </button>
        )}
        {onCreateFolder && (
          <button
            onClick={(e) => { e.stopPropagation(); onCreateFolder(node.path) }}
            className="opacity-0 group-hover:opacity-100 text-yellow-700 hover:text-yellow-400 text-xs px-1 py-1 transition-opacity"
            title={`New folder in ${node.name}`}
          >
            ⊕
          </button>
        )}
      </div>
      {open && (
        <ul>
          {node.children.map((child, i) => (
            <FolderNode
              key={child.kind === 'file' ? child.note.path : `${child.name}-${i}`}
              node={child}
              depth={depth + 1}
              selectedSlug={selectedSlug}
              onSelect={onSelect}
              onDelete={onDelete}
              checkable={checkable}
              checked={checked}
              onCheck={onCheck}
              onCreateNote={onCreateNote}
              onCreateFolder={onCreateFolder}
              defaultOpen={true}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function FolderTree({
  notes,
  selectedSlug,
  onSelect,
  onDelete,
  checkable = false,
  checked = new Set(),
  onCheck,
  onCreateNote,
  onCreateFolder,
}: FolderTreeProps) {
  if (notes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-xs text-gray-600">No notes yet</p>
      </div>
    )
  }

  const tree = buildTree(notes)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {onCreateNote && (
        <div className="px-3 py-1.5 border-b border-gray-800 shrink-0">
          <button
            onClick={() => onCreateNote(undefined)}
            className="w-full text-left text-xs text-gray-600 hover:text-gray-300 hover:bg-gray-800 px-2 py-1 rounded transition-colors flex items-center gap-1"
            title="New note"
          >
            <span>+</span>
            <span>New note</span>
          </button>
        </div>
      )}
      <ul className="flex-1 overflow-y-auto py-1">
        {tree.map((node, i) => (
          <FolderNode
            key={node.kind === 'file' ? node.note.path : `${node.name}-${i}`}
            node={node}
            depth={0}
            selectedSlug={selectedSlug}
            onSelect={onSelect}
            onDelete={onDelete}
            checkable={checkable}
            checked={checked}
            onCheck={onCheck}
            onCreateNote={onCreateNote}
            onCreateFolder={onCreateFolder}
            defaultOpen={true}
          />
        ))}
      </ul>
    </div>
  )
}
