'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import type { GraphData } from '@/lib/graph/parseLinks'

export interface QueryInsights {
  query: string
  sources: string[]
}

interface GraphQueryBarProps {
  insights: QueryInsights
  graphData: GraphData
  onNodeFocus: (slug: string) => void
  onNoteOpen: (slug: string) => void
  onDismiss: () => void
  onGetNoteContent: (slug: string) => Promise<string>
}

// Common English stop words to strip from keyword extraction
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
  'from','is','are','was','were','be','been','being','have','has','had','do',
  'does','did','will','would','could','should','may','might','shall','can',
  'not','no','nor','so','yet','both','either','neither','just','also','very',
  'what','which','who','whom','this','that','these','those','my','your','his',
  'her','its','our','their','how','when','where','why','all','each','every',
  'about','up','out','as','if','then','than','too','any','some','more','most',
  'i','we','you','he','she','they','it','me','us','him','them','there',
])

function extractKeywords(query: string): string[] {
  return [...new Set(
    query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  )].slice(0, 8)
}

function keywordMentions(keyword: string, graphData: GraphData): string[] {
  const kw = keyword.toLowerCase()
  return graphData.nodes
    .filter((n) => n.type !== 'stub' && n.label.toLowerCase().includes(kw))
    .map((n) => n.id)
}

function getNodeDegree(slug: string, graphData: GraphData): number {
  return graphData.edges.filter((e) => e.source === slug || e.target === slug).length
}

function getNodeType(slug: string, graphData: GraphData): 'wiki' | 'raw' | 'stub' | null {
  return graphData.nodes.find((n) => n.id === slug)?.type ?? null
}

function getLabel(slug: string, graphData: GraphData): string {
  return graphData.nodes.find((n) => n.id === slug)?.label ?? slug.split('/').pop() ?? slug
}

function getNeighbors(slugs: string[], graphData: GraphData): string[] {
  const sourceSet = new Set(slugs)
  const neighbors = new Set<string>()
  for (const edge of graphData.edges) {
    if (sourceSet.has(edge.source) && !sourceSet.has(edge.target)) {
      const node = graphData.nodes.find((n) => n.id === edge.target)
      if (node && node.type !== 'stub') neighbors.add(edge.target)
    }
    if (sourceSet.has(edge.target) && !sourceSet.has(edge.source)) {
      const node = graphData.nodes.find((n) => n.id === edge.source)
      if (node && node.type !== 'stub') neighbors.add(edge.source)
    }
  }
  return Array.from(neighbors).slice(0, 8)
}

function countClustersTouched(slugs: string[], graphData: GraphData): number {
  const visited = new Map<string, number>()
  const realNodes = graphData.nodes.filter((n) => n.type !== 'stub')
  const adj = new Map<string, string[]>()
  for (const n of realNodes) adj.set(n.id, [])
  for (const e of graphData.edges) {
    adj.get(e.source)?.push(e.target)
    adj.get(e.target)?.push(e.source)
  }
  let componentId = 0
  for (const n of realNodes) {
    if (visited.has(n.id)) continue
    const queue = [n.id]
    while (queue.length) {
      const cur = queue.pop()!
      if (visited.has(cur)) continue
      visited.set(cur, componentId)
      for (const nb of adj.get(cur) ?? []) if (!visited.has(nb)) queue.push(nb)
    }
    componentId++
  }
  const ids = new Set(slugs.map((s) => visited.get(s)).filter((id): id is number => id !== undefined))
  return ids.size
}

/** Extract sentences/lines from note content most relevant to query keywords */
function extractRelevantPassages(content: string, keywords: string[], max = 3): Array<{ text: string; score: number }> {
  const lines = content
    .split('\n')
    .map((l) => l.replace(/^#{1,6}\s+/, '').trim())
    .filter((l) => l.length > 30)

  return lines
    .map((line) => ({
      text: line.length > 140 ? line.slice(0, 140) + '…' : line,
      score: keywords.filter((kw) => line.toLowerCase().includes(kw)).length,
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
}

const TYPE_DOT: Record<string, string> = {
  wiki: 'bg-blue-400',
  raw: 'bg-red-400',
  stub: 'bg-gray-600',
}

const TYPE_RING: Record<string, string> = {
  wiki: 'ring-blue-500/40',
  raw: 'ring-red-500/40',
  stub: 'ring-gray-600/40',
}

const TYPE_BADGE: Record<string, string> = {
  wiki: 'bg-blue-900/60 text-blue-300',
  raw: 'bg-red-900/60 text-red-300',
}

export default function GraphQueryBar({
  insights,
  graphData,
  onNodeFocus,
  onNoteOpen,
  onDismiss,
  onGetNoteContent,
}: GraphQueryBarProps) {
  const { query, sources } = insights
  const [focusedSlug, setFocusedSlug] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const [noteContent, setNoteContent] = useState<string>('')
  const [loadingContent, setLoadingContent] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30)
    return () => clearTimeout(t)
  }, [])

  // Load note content when a source card is focused
  useEffect(() => {
    if (!focusedSlug) {
      setNoteContent('')
      return
    }
    setLoadingContent(true)
    onGetNoteContent(focusedSlug)
      .then((content) => setNoteContent(content))
      .catch(() => setNoteContent(''))
      .finally(() => setLoadingContent(false))
  }, [focusedSlug, onGetNoteContent])

  const keywords = useMemo(() => extractKeywords(query), [query])
  const neighbors = useMemo(() => getNeighbors(sources, graphData), [sources, graphData])
  const clusterCount = useMemo(() => countClustersTouched(sources, graphData), [sources, graphData])
  const maxDegree = useMemo(
    () => Math.max(1, ...sources.map((s) => getNodeDegree(s, graphData))),
    [sources, graphData]
  )
  const totalEdges = useMemo(() => graphData.edges.length, [graphData])

  const relevantPassages = useMemo(
    () => noteContent ? extractRelevantPassages(noteContent, keywords) : [],
    [noteContent, keywords]
  )

  function handleNodeFocus(slug: string) {
    setFocusedSlug(slug === focusedSlug ? null : slug)
    onNodeFocus(slug)
  }

  return (
    <div
      ref={barRef}
      className={`shrink-0 border-t border-gray-800 bg-gray-950/98 transition-all duration-300 ${
        visible ? 'max-h-72 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
      }`}
    >
      <div className="flex flex-col h-full">

        {/* Main row */}
        <div className="flex items-stretch gap-0 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 min-h-0 flex-1">

          {/* Query + keywords */}
          <div className="shrink-0 px-4 py-3 border-r border-gray-800 min-w-[190px] max-w-[230px] flex flex-col gap-2">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Query</p>
              <p className="text-xs text-gray-300 leading-snug line-clamp-2" title={query}>{query}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-600 mb-1">Keywords</p>
              <div className="flex flex-wrap gap-1">
                {keywords.map((kw) => {
                  const hits = keywordMentions(kw, graphData)
                  return (
                    <button
                      key={kw}
                      onClick={() => hits.length > 0 && handleNodeFocus(hits[0])}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        hits.length > 0
                          ? 'bg-indigo-900/60 text-indigo-300 hover:bg-indigo-800/80 border border-indigo-700/40'
                          : 'bg-gray-800/80 text-gray-600 border border-gray-700/30 cursor-default'
                      }`}
                      title={hits.length > 0 ? `In: ${hits.join(', ')}` : 'Not found in graph'}
                    >
                      {kw}
                      {hits.length > 0 && (
                        <span className="ml-1 opacity-50 text-[9px]">{hits.length}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Source nodes */}
          <div className="shrink-0 px-3 py-3 border-r border-gray-800 flex flex-col gap-2 min-w-[300px]">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
              Sources <span className="text-gray-600 font-normal normal-case ml-1">{sources.length}</span>
            </p>
            <div className="flex gap-2 flex-1 items-start">
              {sources.length === 0 ? (
                <p className="text-xs text-gray-700 mt-2">No sources</p>
              ) : (
                sources.map((slug) => {
                  const degree = getNodeDegree(slug, graphData)
                  const type = getNodeType(slug, graphData)
                  const label = getLabel(slug, graphData)
                  const isFocused = focusedSlug === slug
                  const pct = Math.max(6, (degree / maxDegree) * 100)
                  return (
                    <div
                      key={slug}
                      onClick={() => handleNodeFocus(slug)}
                      className={`group flex flex-col gap-1.5 p-2.5 rounded-lg border cursor-pointer transition-all shrink-0 min-w-[120px] max-w-[150px] ${
                        isFocused
                          ? `bg-blue-950/50 border-blue-600/60 ring-1 ${TYPE_RING[type ?? 'stub']}`
                          : 'bg-gray-900/80 border-gray-700/40 hover:border-gray-500/50 hover:bg-gray-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${TYPE_DOT[type ?? 'stub']}`} />
                        <span className="text-xs text-gray-200 truncate font-medium flex-1" title={slug}>
                          {label}
                        </span>
                      </div>

                      {/* Degree mini bar */}
                      <div className="space-y-0.5">
                        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-1 rounded-full transition-all duration-500 ${isFocused ? 'bg-blue-400' : 'bg-blue-700'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-gray-700">{degree} links</span>
                          {type && TYPE_BADGE[type] && (
                            <span className={`text-[9px] px-1 rounded ${TYPE_BADGE[type]}`}>{type}</span>
                          )}
                        </div>
                      </div>

                      {/* Open note button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onNoteOpen(slug) }}
                        className="text-[10px] text-gray-700 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100 text-right"
                        title="Open note"
                      >
                        ↗ open
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Connected neighbors */}
          {neighbors.length > 0 && (
            <div className="shrink-0 px-3 py-3 border-r border-gray-800 min-w-[160px]">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                Connected <span className="text-gray-600 font-normal normal-case">{neighbors.length}</span>
              </p>
              <div className="flex flex-col gap-1">
                {neighbors.map((slug) => {
                  const type = getNodeType(slug, graphData)
                  const label = getLabel(slug, graphData)
                  const degree = getNodeDegree(slug, graphData)
                  return (
                    <button
                      key={slug}
                      onClick={() => handleNodeFocus(slug)}
                      className="flex items-center gap-2 px-2 py-1 rounded bg-gray-900/60 hover:bg-gray-800 border border-gray-800/80 hover:border-gray-700 transition-all text-left group"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 opacity-50 ${TYPE_DOT[type ?? 'stub']}`} />
                      <span className="text-[11px] text-gray-500 group-hover:text-gray-200 truncate flex-1 transition-colors" title={slug}>
                        {label}
                      </span>
                      <span className="text-[9px] text-gray-700 shrink-0 tabular-nums">{degree}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="shrink-0 px-4 py-3 min-w-[160px] flex flex-col gap-2">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Coverage</p>

            {/* Visual stat grid */}
            <div className="grid grid-cols-2 gap-2">
              <StatCard value={sources.length} label="sources" color="blue" icon="◉" />
              <StatCard value={clusterCount} label="clusters" color="purple" icon="⬡" />
              <StatCard value={neighbors.length} label="neighbors" color="green" icon="⇌" />
              <StatCard value={maxDegree} label="max links" color="amber" icon="↕" />
            </div>

            {/* Coverage bar */}
            {totalEdges > 0 && (
              <div className="mt-1 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-gray-700">graph coverage</span>
                  <span className="text-[9px] text-gray-500 tabular-nums">
                    {Math.min(100, Math.round(((sources.length + neighbors.length) / Math.max(1, graphData.nodes.filter(n => n.type !== 'stub').length)) * 100))}%
                  </span>
                </div>
                <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.round(((sources.length + neighbors.length) / Math.max(1, graphData.nodes.filter(n => n.type !== 'stub').length)) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Dismiss */}
          <div className="ml-auto shrink-0 px-3 py-3">
            <button
              onClick={onDismiss}
              className="text-gray-700 hover:text-gray-400 transition-colors text-base leading-none"
              title="Dismiss"
            >
              ×
            </button>
          </div>

        </div>

        {/* Passages row — shown when a source is focused */}
        {focusedSlug && (
          <div className="border-t border-gray-800 px-4 py-2 bg-gray-900/40 flex gap-4 items-start min-h-0">
            <div className="shrink-0">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
                Top passages
                <span className="text-gray-700 font-normal normal-case ml-1">from {getLabel(focusedSlug, graphData)}</span>
              </p>
            </div>
            {loadingContent ? (
              <p className="text-[11px] text-gray-700 italic mt-0.5">Loading…</p>
            ) : relevantPassages.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto flex-1">
                {relevantPassages.map((p, i) => (
                  <div
                    key={i}
                    className="shrink-0 max-w-[260px] bg-gray-900 border border-gray-800 rounded px-2.5 py-1.5"
                  >
                    <p className="text-[11px] text-gray-400 leading-relaxed">{p.text}</p>
                    <div className="flex gap-0.5 mt-1">
                      {Array.from({ length: Math.min(p.score, 5) }).map((_, j) => (
                        <span key={j} className="w-1 h-1 rounded-full bg-indigo-500/60" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : noteContent ? (
              <p className="text-[11px] text-gray-700 italic mt-0.5">No strong keyword matches in this note</p>
            ) : (
              <p className="text-[11px] text-gray-700 italic mt-0.5">Could not load note content</p>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

function StatCard({
  value,
  label,
  color,
  icon,
}: {
  value: number
  label: string
  color: 'blue' | 'purple' | 'green' | 'amber'
  icon: string
}) {
  const colorMap = {
    blue: { text: 'text-blue-400', bg: 'bg-blue-900/30', border: 'border-blue-800/30' },
    purple: { text: 'text-purple-400', bg: 'bg-purple-900/30', border: 'border-purple-800/30' },
    green: { text: 'text-green-400', bg: 'bg-green-900/30', border: 'border-green-800/30' },
    amber: { text: 'text-amber-400', bg: 'bg-amber-900/30', border: 'border-amber-800/30' },
  }
  const c = colorMap[color]
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg p-1.5 border ${c.bg} ${c.border}`}>
      <span className={`text-sm font-bold tabular-nums ${c.text}`}>{value}</span>
      <span className="text-[9px] text-gray-600 mt-0.5">{label}</span>
    </div>
  )
}
