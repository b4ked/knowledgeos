'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import type { NoteFolder, NoteMetadata } from '@/lib/vault/VaultAdapter'
import type { GraphData } from '@/lib/graph/parseLinks'
import FolderTree from '@/components/FolderTree'
import NewFolderDialog from '@/components/NewFolderDialog'
import NoteViewer from '@/components/NoteViewer'
import NewNotePanel from '@/components/NewNotePanel'
import GraphView from '@/components/GraphView'
import ChatPanel from '@/components/ChatPanel'
import ConventionsEditor from '@/components/ConventionsEditor'
import SettingsModal from '@/components/SettingsModal'
import VaultModeBanner from '@/components/VaultModeBanner'
import UsageBanner from '@/components/UsageBanner'
import RAGPanel from '@/components/RAGPanel'
import ToastStack from '@/components/ToastStack'
import TagBrowser from '@/components/TagBrowser'
import { useToast } from '@/lib/toast/useToast'
import type { VaultMode } from '@/components/VaultModeBanner'
import {
  BrowserVaultAdapter,
  restoreSavedVaultFolder,
  saveVaultFolderHandle,
} from '@/lib/vault/BrowserVaultAdapter'
import {
  clearLocalRagEntries,
  hashContentInBrowser,
  listLocalRagEntries,
  retrieveLocalRagSlugs,
  upsertLocalRagEntry,
  writeLocalRagEntries,
  writeLocalRagMeta,
} from '@/lib/rag/browserStore'
import { BUILT_IN_PRESETS } from '@/lib/conventions/defaults'
import UserMenu from '@/components/UserMenu'
import FrontmatterPanel from '@/components/FrontmatterPanel'
import { normaliseTagList, parseNoteFrontmatter } from '@/lib/vault/frontmatter'
import GraphQueryBar from '@/components/GraphQueryBar'
import FileImportModal, { type FileImportItem } from '@/components/FileImportModal'
import type { QueryInsights } from '@/components/GraphQueryBar'

type Folder = 'raw' | 'wiki'
type Panel = 'viewer' | 'new'
type Tag = { name: string; count: number }
type TokeniseResult = { indexed: number; skipped: number; total: number; errors: string[] }
const PUBLIC_UPLOAD_URL = process.env.NEXT_PUBLIC_VPS_UPLOAD_URL?.trim() || 'https://api.parrytech.co/knos/api/upload-public'

type ImportedFileResult = {
  clientId: string
  filename: string
  status: 'processing' | 'ready' | 'error'
  error?: string
  rawNote?: NoteMetadata
  rawContent?: string
  mimeType?: string
  preset: string
  tags: string
}

function defaultImportItem(file: File, index: number): ImportedFileResult {
  return {
    clientId: `${Date.now()}-${index}-${file.name}`,
    filename: file.name,
    status: 'processing',
    preset: 'default',
    tags: '',
  }
}

export default function Home() {
  const [folder, setFolder] = useState<Folder>('wiki')
  const [notes, setNotes] = useState<NoteMetadata[]>([])
  const [selectedNote, setSelectedNote] = useState<NoteMetadata | null>(null)
  const [noteContent, setNoteContent] = useState<string>('')
  const [panel, setPanel] = useState<Panel>('viewer')
  const [newNoteFolder, setNewNoteFolder] = useState<string | undefined>(undefined)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderParent, setNewFolderParent] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<NoteMetadata | null>(null)
  const [checkedSlugs, setCheckedSlugs] = useState<Set<string>>(new Set())
  const [compiling, setCompiling] = useState(false)
  const [usageVersion, setUsageVersion] = useState(0)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [showGraph, setShowGraph] = useState(true)
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] })
  const [graphLoading, setGraphLoading] = useState(false)
  const [showChat, setShowChat] = useState(true)
  const [showPresets, setShowPresets] = useState(false)
  const [compilePreset, setCompilePreset] = useState<string>('default')
  const [compilePresetConventions, setCompilePresetConventions] = useState<Record<string, unknown>>({})
  const [sidebarPresets, setSidebarPresets] = useState<string[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [showRAG, setShowRAG] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [queryInsights, setQueryInsights] = useState<QueryInsights | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(256)
  const [vaultMode, setVaultMode] = useState<VaultMode>('remote')
  const [vaultModeLoaded, setVaultModeLoaded] = useState(false)
  const browserAdapterRef = useRef<BrowserVaultAdapter | null>(null)
  const [localHandleMissing, setLocalHandleMissing] = useState(false)
  const [noteTags, setNoteTags] = useState<Record<string, string[]>>({})
  const [localTags, setLocalTags] = useState<Tag[]>([])
  const [highlightedSlugs, setHighlightedSlugs] = useState<Set<string>>(new Set())
  const [chatWidth, setChatWidth] = useState(320)
  const [sidebarDragging, setSidebarDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [importCompiling, setImportCompiling] = useState(false)
  const [importFiles, setImportFiles] = useState<ImportedFileResult[]>([])
  const [showImportModal, setShowImportModal] = useState(false)
  const [sameImportPreset, setSameImportPreset] = useState(true)
  const [sharedImportPreset, setSharedImportPreset] = useState('default')
  const [sameImportTags, setSameImportTags] = useState(true)
  const [sharedImportTags, setSharedImportTags] = useState('')
  const [importCompileError, setImportCompileError] = useState<string | null>(null)
  const sidebarDragCounter = useRef(0)
  const selectAllRef = useRef<HTMLInputElement>(null)
  const graphDataRef = useRef<GraphData>({ nodes: [], edges: [] })
  const loadGraphVersion = useRef(0)
  const isResizingChat = useRef(false)
  const isResizingSidebar = useRef(false)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(320)
  const resizeStartXSidebar = useRef(0)
  const resizeStartWidthSidebar = useRef(256)
  const pageDragCounter = useRef(0)
  const { toasts, addToast, removeToast } = useToast()
  const { status: sessionStatus } = useSession()
  const presetOptions = [...Object.keys(BUILT_IN_PRESETS), ...sidebarPresets]
  const clearVaultVisualState = useCallback((nextFolder: Folder = 'wiki') => {
    loadGraphVersion.current += 1
    setFolder(nextFolder)
    setNotes([])
    setSelectedNote(null)
    setNoteContent('')
    setPanel('viewer')
    setCheckedSlugs(new Set())
    setCompileError(null)
    setQueryInsights(null)
    setHighlightedSlugs(new Set())
    setGraphData({ nodes: [], edges: [] })
    graphDataRef.current = { nodes: [], edges: [] }
    setGraphLoading(false)
    setNoteTags({})
    setLocalTags([])
    setActiveTag(null)
  }, [])

  const resetVaultUi = useCallback((nextFolder: Folder = 'wiki') => {
    clearVaultVisualState(nextFolder)
    setShowImportModal(false)
    setImportFiles([])
    setImportCompileError(null)
    setSameImportPreset(true)
    setSharedImportPreset('default')
    setSameImportTags(true)
    setSharedImportTags('')
    setSidebarDragging(false)
    sidebarDragCounter.current = 0
  }, [clearVaultVisualState])

  const resolvePresetConventions = useCallback(async (preset: string): Promise<Record<string, unknown>> => {
    if (BUILT_IN_PRESETS[preset]) return BUILT_IN_PRESETS[preset]
    const res = await fetch(`/api/presets/${encodeURIComponent(preset)}`)
    if (!res.ok) throw new Error(`Preset not found: ${preset}`)
    return await res.json() as Record<string, unknown>
  }, [])

  const arrayBufferToBase64 = useCallback((buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer)
    const chunkSize = 0x8000
    let binary = ''
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      binary += String.fromCharCode(...chunk)
    }
    return btoa(binary)
  }, [])

  const listVaultNotes = useCallback(async (targetFolder: Folder): Promise<NoteMetadata[]> => {
    if (vaultMode === 'local') {
      const adapter = browserAdapterRef.current
      if (!adapter) throw new Error('Reconnect your local vault folder first')
      return (await adapter.listNotes(targetFolder)).filter(
        (note) => note.filename !== '.keep' && !note.slug.endsWith('/.keep') && note.slug !== '.keep'
      )
    }

    const res = await fetch(`/api/notes?folder=${targetFolder}`)
    if (!res.ok) throw new Error(`Could not load ${targetFolder} notes`)
    return await res.json() as NoteMetadata[]
  }, [vaultMode])

  const writeImportedRawNote = useCallback(async (
    filename: string,
    mimeType: string | undefined,
    markdown: string,
    suggestedSlug: string,
  ): Promise<{ rawNote: NoteMetadata; rawContent: string }> => {
    const safeExt = `.${filename.split('.').pop() ?? ''}`.toLowerCase()
    const displayTitle = safeExt === '.' ? filename : filename.slice(0, -safeExt.length) || filename
    const existingRawNotes = await listVaultNotes('raw')
    const existingSlugs = new Set(existingRawNotes.map((note) => note.slug))
    const baseSuggestedSlug = `${suggestedSlug || 'imported-file'}_raw`
    let slug = baseSuggestedSlug
    let counter = 2
    while (existingSlugs.has(slug)) {
      slug = `${baseSuggestedSlug}_${counter}`
      counter++
    }

    const rawContent = `# ${displayTitle}\n\n*Imported from: ${filename} (${mimeType || 'unknown type'})*\n\n---\n\n${markdown}`
    const rawPath = `raw/${slug}.md` as const

    if (vaultMode === 'local') {
      const adapter = browserAdapterRef.current
      if (!adapter) throw new Error('Reconnect your local vault folder first')
      await adapter.writeNote(rawPath, rawContent)
      return {
        rawNote: {
          slug,
          filename: `${slug}.md`,
          folder: 'raw',
          path: rawPath,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        rawContent,
      }
    }

    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: 'raw', filename: `${slug}.md`, content: rawContent }),
    })
    const data = await res.json() as NoteMetadata & { error?: string }
    if (!res.ok) throw new Error(data.error ?? `Could not save ${filename} to the raw vault`)
    return { rawNote: data, rawContent }
  }, [listVaultNotes, vaultMode])

  async function handleVaultModeChange(mode: VaultMode, adapter?: BrowserVaultAdapter) {
    let nextAdapter = browserAdapterRef.current

    if (mode === 'local') {
      if (adapter) {
        nextAdapter = adapter
      } else if (!nextAdapter) {
        const restored = await restoreSavedVaultFolder({ requestPermission: true }).catch(() => null)
        if (restored) nextAdapter = new BrowserVaultAdapter(restored)
      }
      browserAdapterRef.current = nextAdapter ?? browserAdapterRef.current
    } else if (adapter) {
      browserAdapterRef.current = adapter
    }

    try {
      window.localStorage.setItem('knowledgeos.activeVaultMode', mode)
    } catch {
      // Ignore storage failures
    }

    if (mode === 'local' && nextAdapter) {
      try {
        await saveVaultFolderHandle(nextAdapter.getHandle())
      } catch {
        // Non-fatal — local mode still works for this session
      }
    }
    if (sessionStatus === 'authenticated') {
      await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultMode: mode }),
      }).catch(() => { /* non-fatal */ })
    }

    resetVaultUi('wiki')
    setVaultMode(mode)
    setLocalHandleMissing(mode === 'local' && !nextAdapter)

    if (showGraph) {
      setGraphLoading(true)
      setTimeout(() => { void loadGraph() }, 50)
    }
  }

  // Load vault mode preference for authenticated users
  useEffect(() => {
    if (sessionStatus === 'loading') return

    let cancelled = false

    async function loadInitialVaultMode() {
      let nextMode: VaultMode = 'remote'

      if (sessionStatus === 'authenticated') {
        try {
          const active = window.localStorage.getItem('knowledgeos.activeVaultMode')
          if (active === 'cloud' || active === 'local' || active === 'remote') {
            nextMode = active
          }
        } catch {
          // Ignore storage failures
        }

        try {
          const pending = window.localStorage.getItem('knowledgeos.pendingVaultMode')
          if (pending === 'cloud' || pending === 'local') {
            nextMode = pending
            window.localStorage.removeItem('knowledgeos.pendingVaultMode')
            window.localStorage.setItem('knowledgeos.activeVaultMode', pending)
            fetch('/api/preferences', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ vaultMode: pending }),
            }).catch(() => { /* ignore until authenticated */ })
          }
        } catch {
          // Ignore storage failures
        }

        if (nextMode === 'remote') {
          try {
            const response = await fetch('/api/preferences')
            if (response.ok) {
              const prefs = await response.json() as { vaultMode?: string }
              if (prefs.vaultMode === 'cloud' || prefs.vaultMode === 'local') {
                nextMode = prefs.vaultMode
              }
            }
          } catch {
            // Keep remote default if preferences cannot be loaded
          }
        }
      }

      if (nextMode === 'local') {
        const handle = await restoreSavedVaultFolder().catch(() => null)
        if (!cancelled && handle) {
          browserAdapterRef.current = new BrowserVaultAdapter(handle)
          setLocalHandleMissing(false)
        } else if (!cancelled) {
          setLocalHandleMissing(true)
        }
      } else if (!cancelled) {
        setLocalHandleMissing(false)
      }

      if (!cancelled) {
        setVaultMode(nextMode)
        setVaultModeLoaded(true)
        try {
          window.localStorage.setItem('knowledgeos.activeVaultMode', nextMode)
        } catch {
          // Ignore storage failures
        }
      }
    }

    loadInitialVaultMode()
    return () => {
      cancelled = true
    }
  }, [sessionStatus, resetVaultUi])

  const syncLocalRagNote = useCallback(async (slug: string, content: string) => {
    if (vaultMode !== 'local' || !content.trim()) return
    const adapter = browserAdapterRef.current
    if (!adapter) return

    const res = await fetch('/api/embeddings/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: 'wiki', notes: [{ slug, content }] }),
    })
    const data = await res.json() as {
      entries?: Array<{ slug: string; contentHash: string; embedding: number[]; updatedAt: string }>
      meta?: { provider: string; model: string; updatedAt: string }
      error?: string
    }
    if (!res.ok || !data.entries?.[0] || !data.meta) {
      throw new Error(data.error ?? 'Could not update local RAG index')
    }

    const entry = data.entries[0]
    await upsertLocalRagEntry(adapter, {
      slug: entry.slug,
      contentHash: entry.contentHash,
      embedding: entry.embedding,
      updatedAt: entry.updatedAt,
    })
    await writeLocalRagMeta(adapter, data.meta)
  }, [vaultMode])

  const handleLocalTokenise = useCallback(async (folder: Folder): Promise<TokeniseResult> => {
    const adapter = browserAdapterRef.current
    if (!adapter) {
      throw new Error('Reconnect your local vault folder first')
    }

    const notes = await adapter.listNotes(folder)
    const existing = new Map((await listLocalRagEntries(adapter)).map((entry) => [entry.slug, entry]))
    // Store the full-content hash alongside content so we can persist it correctly.
    // The server only sees truncated content (to keep payloads small), so its returned
    // contentHash would differ from the client's hash of the full content — causing every
    // note to appear changed on every subsequent run. By pre-computing the full-content
    // hash here and using it when writing the index, the skip check always matches.
    const changedNotes: Array<{ slug: string; content: string; fullHash: string }> = []
    let skipped = 0

    for (const note of notes) {
      const content = await adapter.readNote(note.path).catch(() => '')
      if (!content.trim()) {
        skipped++
        continue
      }
      const fullHash = await hashContentInBrowser(content)
      if (existing.get(note.slug)?.contentHash === fullHash) {
        skipped++
        continue
      }
      changedNotes.push({ slug: note.slug, content, fullHash })
    }

    type EmbedEntry = { slug: string; contentHash: string; embedding: number[]; updatedAt: string }
    type EmbedMeta = { provider: string; model: string; updatedAt: string }
    const allEntries: EmbedEntry[] = []
    const allErrors: string[] = []
    let totalIndexed = 0
    let lastMeta: EmbedMeta | undefined

    if (changedNotes.length > 0) {
      // Batch of 2 to keep request + response payloads small (avoids SSL buffer issues on nginx).
      // Content is trimmed to 6000 chars — sufficient context for voyage-3-lite embeddings.
      const BATCH_SIZE = 2
      const MAX_CONTENT = 6000
      for (let i = 0; i < changedNotes.length; i += BATCH_SIZE) {
        const batchSlice = changedNotes.slice(i, i + BATCH_SIZE)
        // Build a slug → fullHash lookup so we can restore it after the server call
        const fullHashBySlug = new Map(batchSlice.map((n) => [n.slug, n.fullHash]))
        const batch = batchSlice.map((n) => ({
          slug: n.slug,
          content: n.content.length > MAX_CONTENT ? n.content.slice(0, MAX_CONTENT) : n.content,
        }))
        const res = await fetch('/api/embeddings/index', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder, notes: batch }),
        })
        const data = await res.json() as {
          indexed?: number
          errors?: string[]
          entries?: EmbedEntry[]
          meta?: EmbedMeta
          error?: string
        }
        if (!res.ok || !data.entries || !data.meta) {
          throw new Error(data.error ?? `Analysis failed (HTTP ${res.status}) — check API key config`)
        }
        // Override the server's contentHash (of truncated content) with the full-content
        // hash computed locally — this is what the skip check reads on the next run.
        allEntries.push(...data.entries.map((e) => ({
          ...e,
          contentHash: fullHashBySlug.get(e.slug) ?? e.contentHash,
        })))
        allErrors.push(...(data.errors ?? []))
        totalIndexed += data.indexed ?? data.entries.length
        lastMeta = data.meta
      }

      await writeLocalRagEntries(
        adapter,
        allEntries.map((entry) => ({
          slug: entry.slug,
          contentHash: entry.contentHash,
          embedding: entry.embedding,
          updatedAt: entry.updatedAt,
        }))
      )
      if (lastMeta) await writeLocalRagMeta(adapter, lastMeta)
    }

    // Rebuild and persist graph analysis (non-fatal)
    ;(async () => {
      try {
        const { parseLinks } = await import('@/lib/graph/parseLinks')
        const { persistLocalGraphInsights } = await import('@/lib/graph/localGraphStore')
        const [wikiMeta, rawMeta] = await Promise.all([
          adapter.listNotes('wiki'),
          adapter.listNotes('raw'),
        ])
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
        const built = parseLinks([...wikiNotes, ...rawNotes])
        graphDataRef.current = built
        setGraphData(built)
        await persistLocalGraphInsights(adapter, built)
      } catch { /* non-fatal */ }
    })()

    return {
      indexed: totalIndexed,
      skipped,
      total: notes.length,
      errors: allErrors,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClearLocalRag = useCallback(async () => {
    const adapter = browserAdapterRef.current
    if (adapter) await clearLocalRagEntries(adapter)
  }, [])

  const getLocalQueryNotes = useCallback(async (question: string) => {
    const adapter = browserAdapterRef.current
    if (!adapter) {
      throw new Error('Reconnect your local vault folder first')
    }

    const embeddingRes = await fetch('/api/embeddings/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    })
    const embeddingData = await embeddingRes.json() as { embedding?: number[]; error?: string }
    if (!embeddingRes.ok || !embeddingData.embedding) {
      throw new Error(embeddingData.error ?? 'Could not search the local RAG index')
    }

    const questionEmbedding = embeddingData.embedding
    const currentGraph = graphDataRef.current

    // Use graph-aware retrieval if graph has edges, otherwise fall back to standard
    let slugs: string[]
    if (currentGraph.edges.length > 0) {
      try {
        const { graphAwareRetrieve } = await import('@/lib/rag/graphAwareRetrieve')
        const entries = await listLocalRagEntries(adapter)
        const results = graphAwareRetrieve(questionEmbedding, entries, currentGraph, {
          topK: 5,
          semanticWeight: 0.7,
          minScore: 0.05,
        })
        slugs = results.map((r) => r.slug)
      } catch {
        // Fall back to standard retrieval
        slugs = await retrieveLocalRagSlugs(adapter, questionEmbedding)
      }
    } else {
      slugs = await retrieveLocalRagSlugs(adapter, questionEmbedding)
    }

    if (slugs.length === 0) {
      throw new Error('Local RAG index is empty. Open Settings and tokenise your wiki notes first.')
    }

    const notes = await Promise.all(
      slugs.map(async (slug) => ({
        slug,
        content: await adapter.readNote(`wiki/${slug}.md`).catch(() => ''),
      }))
    )

    return notes.filter((note) => note.content.trim().length > 0)
  }, [])

  // Load custom presets list for sidebar compile selector
  useEffect(() => {
    fetch('/api/presets').then((r) => r.json())
      .then((d: { names: string[] }) => setSidebarPresets(d.names ?? []))
      .catch(() => { /* silent */ })
  }, [])

  const loadNotes = useCallback(async (f: Folder) => {
    setLoading(true)
    try {
      if (vaultMode === 'local') {
        if (!browserAdapterRef.current) {
          setNotes([])
          return
        }
        const data = (await browserAdapterRef.current.listNotes(f)).filter(
          (note) => note.filename !== '.keep' && !note.slug.endsWith('/.keep') && note.slug !== '.keep'
        )
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
    // Increment version so any in-flight older call can detect it was superseded
    const version = ++loadGraphVersion.current
    setGraphLoading(true)
    // Immediately clear stale data from a previous vault mode
    setGraphData({ nodes: [], edges: [] })
    graphDataRef.current = { nodes: [], edges: [] }
    try {
      if (vaultMode === 'local') {
        const adapter = browserAdapterRef.current
        if (!adapter) return
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
        if (version !== loadGraphVersion.current) return
        const built = parseLinks([...wikiNotes, ...rawNotes])
        setGraphData(built)
        graphDataRef.current = built
        // Persist graph analysis to wiki/.graph-index.json
        import('@/lib/graph/localGraphStore')
          .then(({ persistLocalGraphInsights }) => persistLocalGraphInsights(adapter, built))
          .catch(() => { /* non-fatal */ })
      } else {
        const res = await fetch('/api/graph')
        if (res.ok) {
          const gd = await res.json() as GraphData
          // Discard result if a newer loadGraph call has started
          if (version !== loadGraphVersion.current) return
          setGraphData(gd)
          graphDataRef.current = gd
        }
      }
    } finally {
      if (version === loadGraphVersion.current) setGraphLoading(false)
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
    if (!showGraph) return
    if (sessionStatus === 'loading') return
    if (!vaultModeLoaded) return
    void loadGraph()
  }, [showGraph, loadGraph, sessionStatus, vaultModeLoaded])

  useEffect(() => {
    if (sessionStatus !== 'unauthenticated') return

    browserAdapterRef.current = null
    setLocalHandleMissing(false)
    resetVaultUi('wiki')
    setVaultMode('remote')
  }, [sessionStatus, resetVaultUi])

  useEffect(() => {
    if (!vaultModeLoaded || vaultMode !== 'local' || !localHandleMissing) return
    addToast('Reconnect your local vault folder in Settings to continue using local mode.', 'info')
  }, [vaultModeLoaded, vaultMode, localHandleMissing, addToast])

  useEffect(() => {
    let cancelled = false

    async function loadNoteTags() {
      if (notes.length === 0) {
        if (!cancelled) setNoteTags({})
        return
      }

      const entries = await Promise.all(
        notes.map(async (note) => {
          try {
            const content = vaultMode === 'local' && browserAdapterRef.current
              ? await browserAdapterRef.current.readNote(note.path)
              : await fetch(`/api/notes/${encodeURIComponent(note.slug)}?folder=${note.folder}`)
                  .then(async (res) => (res.ok ? ((await res.json()) as { content: string }).content : ''))
            const { frontmatter } = parseNoteFrontmatter(content)
            return [note.path, frontmatter.tags] as const
          } catch {
            return [note.path, []] as const
          }
        })
      )

      if (!cancelled) {
        setNoteTags(Object.fromEntries(entries))
      }
    }

    loadNoteTags()
    return () => {
      cancelled = true
    }
  }, [notes, vaultMode])

  useEffect(() => {
    let cancelled = false

    async function loadLocalTags() {
      if (vaultMode !== 'local' || !browserAdapterRef.current) {
        if (!cancelled) setLocalTags([])
        return
      }

      const adapter = browserAdapterRef.current
      const [wikiMeta, rawMeta] = await Promise.all([
        adapter.listNotes('wiki'),
        adapter.listNotes('raw'),
      ])
      const tagCounts = new Map<string, number>()

      await Promise.all(
        [...wikiMeta, ...rawMeta].map(async (note) => {
          try {
            const content = await adapter.readNote(note.path)
            const { frontmatter } = parseNoteFrontmatter(content)
            for (const tag of frontmatter.tags) {
              tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
            }
          } catch {
            // Skip unreadable files
          }
        })
      )

      if (!cancelled) {
        setLocalTags(
          Array.from(tagCounts.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        )
      }
    }

    loadLocalTags()
    return () => {
      cancelled = true
    }
  }, [vaultMode, notes])

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
    let ok = false
    if (vaultMode === 'local' && browserAdapterRef.current) {
      await browserAdapterRef.current.deleteNote(deleteConfirm.path).catch(() => {})
      ok = true
    } else {
      const res = await fetch(
        `/api/notes/${deleteConfirm.slug}?folder=${deleteConfirm.folder}`,
        { method: 'DELETE' }
      )
      ok = res.ok || res.status === 204
    }

    if (ok) {
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

  async function handleNoteSaved(note: NoteMetadata) {
    const noteFolder = note.folder as Folder
    if (noteFolder !== folder) setFolder(noteFolder)
    await loadNotes(noteFolder)
    setPanel('viewer')
    setNewNoteFolder(undefined)
    await handleSelectNote(note)
    if (vaultMode === 'local' && note.folder === 'wiki' && browserAdapterRef.current) {
      const content = await browserAdapterRef.current.readNote(note.path).catch(() => '')
      if (content.trim()) {
        await syncLocalRagNote(note.slug, content).catch(() => {})
      }
    }
    if (showGraph) await loadGraph()
    setUsageVersion((v) => v + 1)
    addToast(`Saved & compiled → ${note.slug}`, 'success')
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

    // Resolve conventions for selected compile preset
    let conventions: Record<string, unknown> = compilePresetConventions
    if (!Object.keys(conventions).length) {
      // Built-in preset
      conventions = BUILT_IN_PRESETS[compilePreset] ?? {}
    }

    try {
      if (vaultMode === 'local' && browserAdapterRef.current) {
        const adapter = browserAdapterRef.current
        const sources = await Promise.all(notePaths.map((notePath) => adapter.readNote(notePath)))
        const res = await fetch('/api/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notePaths, sources, conventions }),
        })
        const data = await res.json()
        if (!res.ok) {
          setCompileError(data.error ?? 'Compilation failed')
          return
        }

        await adapter.writeNote(data.outputPath, data.output)
        await syncLocalRagNote(data.slug, data.output).catch(() => {})
        setCheckedSlugs(new Set())
        setFolder('wiki')
        await loadNotes('wiki')
        if (showGraph) loadGraph()
        setUsageVersion((v) => v + 1)
        addToast(`Compiled → ${data.slug}`, 'success')
        setShowGraph(false)
        setSelectedNote({
          slug: data.slug,
          filename: `${data.slug}.md`,
          folder: 'wiki',
          path: data.outputPath,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        setNoteContent(data.output)
        return
      }

      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notePaths, conventions }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCompileError(data.error ?? 'Compilation failed')
        return
      }
      setCheckedSlugs(new Set())
      setFolder('wiki')
      if (showGraph) loadGraph()
      setUsageVersion((v) => v + 1)
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

  async function handleDroppedFiles(fileList: FileList | File[]) {
    const droppedFiles = Array.from(fileList)

    setSidebarDragging(false)
    sidebarDragCounter.current = 0

    if (droppedFiles.length === 0) return
    if (droppedFiles.length > 10) {
      addToast('Drag and drop up to 10 files at a time.', 'error')
      return
    }

    setUploading(true)
    setImportCompileError(null)
    setSameImportPreset(true)
    setShowImportModal(true)
      setImportFiles(droppedFiles.map((file, index) => defaultImportItem(file, index)))
    setSharedImportPreset('default')
    setSameImportTags(true)
    setSharedImportTags('')

    try {
      const uploadedResults: Array<{
        filename: string
        ok: boolean
        error?: string
        markdown?: string
        suggestedSlug?: string
        mimeType?: string
      }> = []

      for (const file of droppedFiles) {
        const arrayBuffer = await file.arrayBuffer()
        const res = await fetch(PUBLIC_UPLOAD_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: [{
              filename: file.name,
              content: arrayBufferToBase64(arrayBuffer),
              mimeType: file.type,
            }],
          }),
        })
        const data = await res.json() as {
          results?: Array<{
            filename: string
            ok: boolean
            error?: string
            markdown?: string
            suggestedSlug?: string
            mimeType?: string
          }>
          error?: string
        }
        if (!res.ok || !Array.isArray(data.results) || data.results.length === 0) {
          throw new Error(data.error ?? `Could not upload ${file.name}`)
        }
        uploadedResults.push(data.results[0])
      }

      const nextFiles: ImportedFileResult[] = []
      for (const [index, result] of uploadedResults.entries()) {
        const clientId = `${Date.now()}-${index}-${result.filename}`
        if (!result.ok || !result.markdown?.trim()) {
          nextFiles.push({
            clientId,
            filename: result.filename,
            status: 'error',
            error: result.error ?? 'Could not extract text from this file.',
            preset: 'default',
            tags: '',
          })
          continue
        }

        try {
          const created = await writeImportedRawNote(
            result.filename,
            result.mimeType,
            result.markdown,
            result.suggestedSlug ?? 'imported-file',
          )
          nextFiles.push({
            clientId,
            filename: result.filename,
            status: 'ready',
            rawNote: created.rawNote,
            rawContent: created.rawContent,
            mimeType: result.mimeType,
            preset: 'default',
            tags: '',
          })
        } catch (err) {
          nextFiles.push({
            clientId,
            filename: result.filename,
            status: 'error',
            error: err instanceof Error ? err.message : 'Could not save this file to the current vault.',
            preset: 'default',
            tags: '',
          })
        }
      }

      setImportFiles(nextFiles)
      setFolder('raw')
      setSelectedNote(null)
      setNoteContent('')
      await loadNotes('raw')
      await loadGraph()

      const okCount = nextFiles.filter((item) => item.status === 'ready').length
      const errorCount = nextFiles.length - okCount
      if (okCount > 0) addToast(`Imported ${okCount} raw file${okCount !== 1 ? 's' : ''}`, 'success')
      if (errorCount > 0) addToast(`${errorCount} file${errorCount !== 1 ? 's' : ''} could not be converted`, 'error')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not upload files', 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleCompileImportedFiles() {
    const readyFiles = importFiles.filter((file) => file.status === 'ready' && file.rawNote)
    if (readyFiles.length === 0) return

    setImportCompiling(true)
    setImportCompileError(null)

    try {
      const presetCache = new Map<string, Record<string, unknown>>()
      const compiled: Array<{ file: ImportedFileResult; output: string; slug: string; outputPath: string }> = []
      const failures: string[] = []

      for (const file of readyFiles) {
        const preset = sameImportPreset ? sharedImportPreset : file.preset
        const selectedTags = normaliseTagList((sameImportTags ? sharedImportTags : file.tags).split(','))
        if (!presetCache.has(preset)) {
          presetCache.set(preset, await resolvePresetConventions(preset))
        }
        const baseConventions = presetCache.get(preset) ?? {}
        const conventions = {
          ...baseConventions,
          tags: normaliseTagList([
            ...(((baseConventions as { tags?: string[] }).tags) ?? []),
            ...selectedTags,
          ]),
        }

        const requestBody = vaultMode === 'local'
          ? {
              notePaths: [file.rawNote!.path],
              sources: [file.rawContent ?? ''],
              conventions,
            }
          : {
              notePaths: [file.rawNote!.path],
              conventions,
            }

        const res = await fetch('/api/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })
        const data = await res.json() as { slug?: string; output?: string; outputPath?: string; error?: string }
        if (!res.ok || !data.slug || !data.output || !data.outputPath) {
          failures.push(`${file.filename}: ${data.error ?? 'Compilation failed'}`)
          continue
        }

        if (vaultMode === 'local') {
          const adapter = browserAdapterRef.current
          if (!adapter) {
            failures.push(`${file.filename}: reconnect your local vault folder first`)
            continue
          }
          await adapter.writeNote(data.outputPath, data.output)
          await syncLocalRagNote(data.slug, data.output).catch(() => {})
        }

        compiled.push({
          file,
          output: data.output,
          slug: data.slug,
          outputPath: data.outputPath,
        })
      }

      if (compiled.length > 0) {
        clearVaultVisualState('wiki')
        await loadNotes('wiki')
        await loadGraph()

        const last = compiled[compiled.length - 1]
        setShowGraph(false)
        setSelectedNote({
          slug: last.slug,
          filename: `${last.slug}.md`,
          folder: 'wiki',
          path: last.outputPath as `wiki/${string}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        setNoteContent(last.output)
        addToast(`Compiled ${compiled.length} file${compiled.length !== 1 ? 's' : ''} into the wiki`, 'success')
        setUsageVersion((v) => v + compiled.length)
      }

      if (failures.length > 0) {
        setImportCompileError(failures.join(' | '))
      } else {
        setShowImportModal(false)
        setImportFiles([])
      }
    } catch (err) {
      setImportCompileError(err instanceof Error ? err.message : 'Could not compile imported files')
    } finally {
      setImportCompiling(false)
    }
  }

  async function handleWikilinkClick(slug: string) {
    setFolder('wiki')
    setShowGraph(false)
    if (vaultMode === 'local' && browserAdapterRef.current) {
      const content = await browserAdapterRef.current.readNote(`wiki/${slug}.md`).catch(() => '')
      if (content) {
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
      return
    }

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
      if (vaultMode === 'local' && browserAdapterRef.current) {
        const content = await browserAdapterRef.current.readNote(`wiki/${slug}.md`).catch(() => '')
        if (!content) return
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
        return
      }

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
      if (vaultMode === 'local' && browserAdapterRef.current) {
        const content = await browserAdapterRef.current.readNote(`${targetFolder}/${nodeId}.md`).catch(() => '')
        if (!content) return
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
        return
      }

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

  const displayedNotes = activeTag
    ? notes.filter((note) => (noteTags[note.path] ?? []).includes(activeTag))
    : notes

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
      if (e.metaKey && e.key === 'n') { e.preventDefault(); setShowGraph(false); setPanel('new') }
      if (e.metaKey && e.key === 'g') { e.preventDefault(); toggleGraph() }
      if (e.metaKey && e.key === '/') { e.preventDefault(); setShowChat((v) => !v) }
      if (e.metaKey && e.key === ',') { e.preventDefault(); setShowPresets((v) => !v) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGraph])

  useEffect(() => {
    function onWindowDragOver(event: DragEvent) {
      event.preventDefault()
    }
    function onWindowDrop(event: DragEvent) {
      event.preventDefault()
    }
    window.addEventListener('dragover', onWindowDragOver)
    window.addEventListener('drop', onWindowDrop)
    return () => {
      window.removeEventListener('dragover', onWindowDragOver)
      window.removeEventListener('drop', onWindowDrop)
    }
  }, [])

  return (
    <div
      className={`flex flex-col h-screen bg-gray-950 text-gray-100 ${sidebarDragging ? 'bg-blue-950/10' : ''}`}
      onDragEnter={(event) => {
        event.preventDefault()
        pageDragCounter.current += 1
        setSidebarDragging(true)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDragLeave={(event) => {
        event.preventDefault()
        pageDragCounter.current = Math.max(0, pageDragCounter.current - 1)
        if (pageDragCounter.current === 0) setSidebarDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        pageDragCounter.current = 0
        void handleDroppedFiles(event.dataTransfer.files)
      }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 h-12 shrink-0">
        <a
          href="https://knoswmba.parrytech.co"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold tracking-wide text-gray-100 hover:text-blue-300 transition-colors"
        >
          KnowledgeOS
        </a>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setShowGraph(false); setPanel('new') }}
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
            onClick={() => setShowPresets((v) => !v)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              showPresets ? 'bg-blue-900 text-blue-200' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
            }`}
            title="Presets (⌘,)"
          >
            Presets
          </button>
          {vaultMode === 'remote' && (
            <button
              onClick={() => setShowRAG(true)}
              className="px-3 py-1 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors"
              title="RAG index"
            >
              RAG
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="px-3 py-1 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors"
            title="Settings"
          >
            Settings
          </button>
          <button
            onClick={() => setShowTags(v => !v)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              showTags ? 'bg-blue-900 text-blue-200' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
            }`}
            title="Browse tags"
          >
            Tags
          </button>
          <button
            onClick={() => setShowHelp(true)}
            className="px-3 py-1 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors"
            title="Help"
          >
            Help
          </button>
          <div className="ml-2 pl-2 border-l border-gray-800">
            <UserMenu />
          </div>
        </div>
      </header>

      <VaultModeBanner
        mode={vaultMode}
        onSwitch={() => setShowSettings(true)}
      />
      <UsageBanner version={usageVersion} />

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
            className={`bg-gray-900 border-r border-gray-800 flex flex-row shrink-0 transition-colors ${
              sidebarDragging ? 'bg-blue-950/30' : ''
            }`}
            style={{ width: sidebarWidth }}
            onDragEnter={(event) => {
              event.preventDefault()
              sidebarDragCounter.current += 1
              setSidebarDragging(true)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              sidebarDragCounter.current = Math.max(0, sidebarDragCounter.current - 1)
              if (sidebarDragCounter.current === 0) setSidebarDragging(false)
            }}
            onDrop={(event) => {
              event.preventDefault()
              void handleDroppedFiles(event.dataTransfer.files)
            }}
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

            <div className={`px-3 py-2 border-b text-xs ${
              sidebarDragging
                ? 'border-blue-900/60 bg-blue-950/30 text-blue-200'
                : 'border-gray-800 bg-gray-900 text-gray-500'
            }`}>
              <p>Drag and drop up to 10 files</p>
            </div>

            {showTags && (
              <div className="border-b border-gray-800 shrink-0" style={{ height: 200, overflow: 'hidden' }}>
                <TagBrowser
                  activeTag={activeTag}
                  onTagSelect={setActiveTag}
                  tags={vaultMode === 'local' ? localTags : undefined}
                />
              </div>
            )}
            {activeTag && (
              <div className="px-3 py-1.5 bg-blue-950/40 border-b border-blue-900 shrink-0 flex items-center justify-between">
                <span className="text-xs text-blue-300">Filter: #{activeTag}</span>
                <button
                  onClick={() => setActiveTag(null)}
                  className="text-xs text-blue-400 hover:text-blue-200"
                >
                  ×
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-gray-600">Loading…</p>
              </div>
            ) : (
              <FolderTree
                notes={displayedNotes}
                selectedSlug={selectedNote?.slug ?? null}
                onSelect={handleSelectNote}
                onDelete={handleDeleteNote}
                checkable={folder === 'raw'}
                checked={checkedSlugs}
                onCheck={handleCheck}
                onCreateNote={(folderPath) => {
                  setNewNoteFolder(folderPath)
                  setShowGraph(false)
                  setPanel('new')
                }}
                onCreateFolder={(folderPath) => {
                  setNewFolderParent(folderPath)
                  setShowNewFolder(true)
                }}
              />
            )}

            {folder === 'raw' && (
              <div className="shrink-0 px-3 py-2 border-t border-gray-800 space-y-2">
                {compileError && (
                  <p className="text-xs text-red-400 truncate" title={compileError}>
                    {compileError}
                  </p>
                )}
                {/* Preset selector */}
                <div className="flex flex-wrap gap-1">
                  {Object.keys(BUILT_IN_PRESETS).map((key) => (
                    <button
                      key={key}
                      onClick={() => { setCompilePreset(key); setCompilePresetConventions({}) }}
                      className={`px-2 py-0.5 text-xs rounded transition-colors capitalize ${
                        compilePreset === key && !sidebarPresets.includes(compilePreset)
                          ? 'bg-blue-700 text-blue-100'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                      }`}
                    >
                      {key === 'default' ? 'Default' : key}
                    </button>
                  ))}
                  {sidebarPresets.map((name) => (
                    <button
                      key={name}
                      onClick={async () => {
                        setCompilePreset(name)
                        const res = await fetch(`/api/presets/${encodeURIComponent(name)}`)
                        if (res.ok) setCompilePresetConventions(await res.json())
                      }}
                      className={`px-2 py-0.5 text-xs rounded transition-colors ${
                        compilePreset === name && sidebarPresets.includes(compilePreset)
                          ? 'bg-amber-700 text-amber-100'
                          : 'bg-gray-800 text-amber-400 hover:bg-gray-700'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
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
                  onSave={handleNoteSaved}
                  onCancel={() => { setPanel('viewer'); setNewNoteFolder(undefined) }}
                  defaultFolderPrefix={newNoteFolder}
                  vaultMode={vaultMode}
                  browserAdapter={vaultMode === 'local' ? browserAdapterRef.current : null}
                />
              ) : selectedNote ? (
                <NoteViewer
                  content={noteContent}
                  slug={selectedNote.slug}
                  folder={folder}
                  onWikilinkClick={handleWikilinkClick}
                  onContentSaved={(newContent) => {
                    setNoteContent(newContent)
                    if (vaultMode === 'local' && folder === 'wiki') {
                      syncLocalRagNote(selectedNote.slug, newContent).catch(() => {})
                    }
                  }}
                  browserAdapter={vaultMode === 'local' ? browserAdapterRef.current : null}
                />
              ) : null}
              {selectedNote && folder === 'wiki' && panel !== 'new' && (
                <FrontmatterPanel
                  content={noteContent}
                  slug={selectedNote.slug}
                  folder={folder}
                  onContentSaved={(newContent) => {
                    setNoteContent(newContent)
                    if (vaultMode === 'local') {
                      syncLocalRagNote(selectedNote.slug, newContent).catch(() => {})
                    }
                  }}
                  browserAdapter={vaultMode === 'local' ? browserAdapterRef.current : null}
                />
              )}
              {!selectedNote && panel !== 'new' ? (
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
              ) : null}
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
              {queryInsights && (
                <GraphQueryBar
                  insights={queryInsights}
                  graphData={graphData}
                  onNodeFocus={(slug) => setHighlightedSlugs(new Set([slug]))}
                  onNoteOpen={handleChatSourceClick}
                  onDismiss={() => setQueryInsights(null)}
                  onGetNoteContent={async (slug) => {
                    if (vaultMode === 'local' && browserAdapterRef.current) {
                      return browserAdapterRef.current.readNote(`wiki/${slug}.md`).catch(() => '')
                    }
                    const res = await fetch(`/api/notes/${slug}?folder=wiki`)
                    if (res.ok) {
                      const data = await res.json() as { content: string }
                      return data.content
                    }
                    return ''
                  }}
                />
              )}
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
                  onQueryInsights={(query, sources) => setQueryInsights({ query, sources })}
                  onQueryComplete={() => setUsageVersion((v) => v + 1)}
                  vaultMode={vaultMode}
                  getLocalNotesForQuery={vaultMode === 'local' ? getLocalQueryNotes : undefined}
                />
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Presets modal */}
      {showPresets && (
        <ConventionsEditor
          onClose={() => setShowPresets(false)}
          onSaved={(msg) => addToast(msg, 'success')}
          onError={(msg) => addToast(msg, 'error')}
        />
      )}

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onSaved={(msg) => addToast(msg, 'success')}
          onError={(msg) => addToast(msg, 'error')}
          vaultMode={vaultMode}
          browserAdapter={browserAdapterRef.current}
          onVaultModeChange={handleVaultModeChange}
          onLocalTokenise={handleLocalTokenise}
          onLocalClearRag={handleClearLocalRag}
        />
      )}

      {/* RAG index panel */}
      {showRAG && <RAGPanel onClose={() => setShowRAG(false)} />}

      {showImportModal && (
        <FileImportModal
          items={importFiles as FileImportItem[]}
          presetOptions={presetOptions}
          samePresetForAll={sameImportPreset}
          sharedPreset={sharedImportPreset}
          sameTagsForAll={sameImportTags}
          sharedTags={sharedImportTags}
          uploading={uploading}
          compiling={importCompiling}
          compileError={importCompileError}
          onClose={() => {
            if (uploading || importCompiling) return
            setShowImportModal(false)
            setImportFiles([])
            setImportCompileError(null)
          }}
          onCompile={() => { void handleCompileImportedFiles() }}
          onSamePresetChange={setSameImportPreset}
          onSharedPresetChange={setSharedImportPreset}
          onSameTagsChange={setSameImportTags}
          onSharedTagsChange={setSharedImportTags}
          onItemPresetChange={(clientId, preset) => {
            setImportFiles((prev) => prev.map((item) => (
              item.clientId === clientId ? { ...item, preset } : item
            )))
          }}
          onItemTagsChange={(clientId, tags) => {
            setImportFiles((prev) => prev.map((item) => (
              item.clientId === clientId ? { ...item, tags } : item
            )))
          }}
        />
      )}

      {/* New Folder dialog */}
      {showNewFolder && (
        <NewFolderDialog
          parentPath={newFolderParent}
          folder={folder}
          onCreated={() => loadNotes(folder)}
          onClose={() => { setShowNewFolder(false); setNewFolderParent(undefined) }}
          browserAdapter={vaultMode === 'local' ? browserAdapterRef.current : null}
        />
      )}

      {/* Footer */}
      <footer className="shrink-0 flex items-center justify-center py-1.5 bg-gray-900 border-t border-gray-800">
        <a
          href="https://parrytech.co"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Powered by ParryTech.co
        </a>
      </footer>

      <ToastStack toasts={toasts} onDismiss={removeToast} />

      {/* Help modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowHelp(false)}>
          <div
            className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-100">How KnowledgeOS works</h2>
              <button
                onClick={() => setShowHelp(false)}
                className="text-gray-500 hover:text-gray-200 transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="space-y-4 text-xs text-gray-400">
              <div>
                <p className="text-gray-200 font-medium mb-1">The basic idea</p>
                <p>KnowledgeOS turns raw research into a structured, queryable knowledge base. You write notes directly or drag documents into the sidebar, extract their text, and compile them into linked wiki notes using AI. Then you can explore your knowledge graph or chat with your vault in plain English.</p>
              </div>
              <div>
                <p className="text-gray-200 font-medium mb-1">Raw notes vs Wiki notes</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li><span className="text-gray-300">Raw</span> — your unprocessed source material. Paste anything here.</li>
                  <li><span className="text-gray-300">Wiki</span> — AI-compiled notes with dates, tags, wikilinks, and structured sections. These are the structured outputs.</li>
                </ul>
              </div>
              <div>
                <p className="text-gray-200 font-medium mb-1">Document import</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Drag and drop up to 10 files into the left sidebar.</li>
                  <li>The app extracts text on the VPS, then saves a separate raw note for each file in your current vault.</li>
                  <li>The import modal opens immediately while extraction runs, then lets you choose one preset and tag set for all files or set them per document.</li>
                  <li>Each imported file compiles into its own wiki note with its own filename.</li>
                </ul>
              </div>
              <div>
                <p className="text-gray-200 font-medium mb-1">How to compile</p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>Switch to the <span className="text-gray-300">Raw</span> folder in the sidebar</li>
                  <li>Tick one or more raw notes using the checkboxes</li>
                  <li>Choose a preset</li>
                  <li>Click <span className="text-blue-400">Compile Selected</span> — the AI generates a structured wiki note in seconds</li>
                </ol>
              </div>
              <div>
                <p className="text-gray-200 font-medium mb-1">Toolbar buttons</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li><span className="text-gray-300">New Note</span> — create a raw note (⌘N)</li>
                  <li><span className="text-gray-300">Chat</span> — toggle the RAG chat panel — ask questions about your vault in plain English (⌘/)</li>
                  <li><span className="text-gray-300">Graph</span> — toggle the knowledge graph — visualise connections between your notes (⌘G)</li>
                  <li><span className="text-gray-300">Tags</span> — browse and filter notes by tags</li>
                  <li><span className="text-gray-300">Presets</span> — create and edit custom cloud presets that control how the AI compiles notes (⌘,)</li>
                  <li><span className="text-gray-300">RAG</span> — manage the search index used for chat</li>
                  <li><span className="text-gray-300">Settings</span> — switch between local, cloud, and demo vaults</li>
                </ul>
              </div>
              <div>
                <p className="text-gray-200 font-medium mb-1">Vault modes</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li><span className="text-gray-300">Cloud</span> — your personal notes stored in the cloud and available in any browser.</li>
                  <li><span className="text-gray-300">Local</span> — points to a folder on your machine. Files never leave your computer. Chrome and Edge only (File System Access API).</li>
                  <li><span className="text-gray-300">Demo</span> — the shared MBA demo vault hosted on the VPS.</li>
                </ul>
              </div>
              <div>
                <p className="text-gray-200 font-medium mb-1">Tags and dates</p>
                <p>Every new or compiled note includes a date. Tags entered in the comma-separated field and inline #tags in the note body are merged together. Preset tags are also added automatically when that preset is used during compilation.</p>
              </div>
              <div>
                <p className="text-gray-200 font-medium mb-1">Obsidian compatible</p>
                <p>All compiled notes are plain markdown with <span className="text-gray-300">[[wikilinks]]</span>. Open your vault in Obsidian at any time — no lock-in.</p>
              </div>
              <div className="pt-2 border-t border-gray-800">
                <p className="text-gray-600">Daily limits apply based on your plan. Chats and compilations share a single combined limit. <a href="https://knoswmba.parrytech.co#pricing" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400">View pricing →</a></p>
              </div>
            </div>
          </div>
        </div>
      )}

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
