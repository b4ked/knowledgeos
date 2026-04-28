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

function countFiles(nodes: TreeNode[]): number {
  return nodes.reduce((total, node) => total + (node.kind === 'file' ? 1 : countFiles(node.children)), 0)
}

function formatUpdated(value: Date | string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
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
  const indent = depth * 14

  if (node.kind === 'file') {
    const note = node.note
    const isSelected = selectedSlug === note.slug
    return (
      <li className="group px-2 py-0.5">
        <div className="relative flex items-center gap-2">
          {checkable && (
            <input
              type="checkbox"
              checked={checked?.has(note.slug) ?? false}
              onChange={(event) => onCheck?.(note.slug, event.target.checked)}
              onClick={(event) => event.stopPropagation()}
              className="shrink-0 accent-blue-500 cursor-pointer"
              style={{ marginLeft: indent }}
              aria-label={'Select ' + note.slug}
            />
          )}
          <button
            onClick={() => onSelect(note)}
            className={isSelected
              ? 'min-w-0 flex-1 rounded-lg border border-blue-800/80 bg-blue-950/50 px-2.5 py-2 text-left text-blue-50 shadow-[inset_3px_0_0_rgba(96,165,250,0.95)] transition-colors'
              : 'min-w-0 flex-1 rounded-lg border border-transparent px-2.5 py-2 text-left text-gray-400 transition-colors hover:border-gray-800 hover:bg-gray-800/80 hover:text-gray-100'}
            style={{ marginLeft: checkable ? 0 : indent }}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className={isSelected ? 'shrink-0 text-sm text-blue-300' : 'shrink-0 text-sm text-gray-600'}>▰</span>
              <span className="truncate text-xs font-medium">{node.name}</span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2 pl-5 text-[10px] text-gray-600">
              <span className="truncate">{note.slug}</span>
              <span className="shrink-0">{formatUpdated(note.updatedAt)}</span>
            </div>
          </button>
          <button
            onClick={(event) => { event.stopPropagation(); onDelete(note) }}
            className="absolute right-3 top-2 hidden h-6 w-6 items-center justify-center rounded bg-gray-950/80 text-gray-500 transition-colors hover:text-red-300 group-hover:flex"
            title="Delete note"
          >
            ×
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="px-2 py-0.5">
      <div className="group flex items-center gap-1">
        <button
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-gray-500 transition-colors hover:bg-gray-800/80 hover:text-gray-200"
          style={{ marginLeft: indent }}
        >
          <span className="shrink-0 text-gray-600">{open ? '▾' : '▸'}</span>
          <span className="shrink-0 text-amber-500">▣</span>
          <span className="min-w-0 flex-1 truncate font-semibold">{node.name}</span>
          <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500">{countFiles(node.children)}</span>
        </button>
        {onCreateNote && (
          <button
            onClick={(event) => { event.stopPropagation(); onCreateNote(node.path) }}
            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-blue-300 text-xs px-1.5 py-1 transition-opacity"
            title={'New note in ' + node.name}
          >
            +
          </button>
        )}
        {onCreateFolder && (
          <button
            onClick={(event) => { event.stopPropagation(); onCreateFolder(node.path) }}
            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-amber-300 text-xs px-1 py-1 transition-opacity"
            title={'New folder in ' + node.name}
          >
            ⊕
          </button>
        )}
      </div>
      {open && (
        <ul className="mt-0.5">
          {node.children.map((child, i) => (
            <FolderNode
              key={child.kind === 'file' ? child.note.path : child.name + '-' + i}
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
        <div className="rounded-xl border border-dashed border-gray-800 bg-gray-950/60 px-5 py-6 text-center">
          <p className="text-xs font-medium text-gray-500">No notes in this view</p>
          <p className="mt-1 text-[11px] text-gray-700">Create a note or clear the sidebar filters.</p>
        </div>
      </div>
    )
  }

  const tree = buildTree(notes)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {onCreateNote && (
        <div className="px-3 py-2 border-b border-gray-800 shrink-0">
          <button
            onClick={() => onCreateNote(undefined)}
            className="w-full rounded-lg border border-blue-900/60 bg-blue-950/30 px-3 py-2 text-left text-xs font-medium text-blue-200 transition-colors hover:bg-blue-900/50"
            title="New note"
          >
            <span className="mr-2">+</span>
            New note
          </button>
        </div>
      )}
      <ul className="flex-1 overflow-y-auto py-2">
        {tree.map((node, i) => (
          <FolderNode
            key={node.kind === 'file' ? node.note.path : node.name + '-' + i}
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
