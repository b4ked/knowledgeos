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

/** Extract meaningful keywords from a query string */
function extractKeywords(query: string): string[] {
  return [...new Set(
    query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  )].slice(0, 8)
}

/** Count how many graph nodes (non-stub) have labels containing a keyword */
function keywordMentions(keyword: string, graphData: GraphData): string[] {
  const kw = keyword.toLowerCase()
  return graphData.nodes
    .filter((n) => n.type !== 'stub' && n.label.toLowerCase().includes(kw))
    .map((n) => n.id)
}

/** Get degree (total connections) for a slug from graphData */
function getNodeDegree(slug: string, graphData: GraphData): number {
  return graphData.edges.filter((e) => e.source === slug || e.target === slug).length
}

/** Get node type from graphData */
function getNodeType(slug: string, graphData: GraphData): 'wiki' | 'raw' | 'stub' | null {
  return graphData.nodes.find((n) => n.id === slug)?.type ?? null
}

/** Get display label for a slug */
function getLabel(slug: string, graphData: GraphData): string {
  return graphData.nodes.find((n) => n.id === slug)?.label ?? slug.split('/').pop() ?? slug
}

/** Get 1-hop neighbors of a set of slugs, excluding those already in the set */
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
  return Array.from(neighbors).slice(0, 10)
}

/** How many distinct clusters (connected components) the sources span */
function countClustersTouched(slugs: string[], graphData: GraphData): number {
  // BFS to find component ID for each source slug
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

const TYPE_COLOR: Record<string, string> = {
  wiki: 'bg-blue-500',
  raw: 'bg-red-500',
  stub: 'bg-gray-500',
}

const TYPE_LABEL: Record<string, string> = {
  wiki: 'wiki',
  raw: 'raw',
}

export default function GraphQueryBar({
  insights,
  graphData,
  onNodeFocus,
  onNoteOpen,
  onDismiss,
}: GraphQueryBarProps) {
  const { query, sources } = insights
  const [focusedSlug, setFocusedSlug] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  // Animate in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30)
    return () => clearTimeout(t)
  }, [])

  const keywords = useMemo(() => extractKeywords(query), [query])
  const neighbors = useMemo(() => getNeighbors(sources, graphData), [sources, graphData])
  const clusterCount = useMemo(() => countClustersTouched(sources, graphData), [sources, graphData])
  const maxDegree = useMemo(
    () => Math.max(1, ...sources.map((s) => getNodeDegree(s, graphData))),
    [sources, graphData]
  )

  function handleNodeFocus(slug: string) {
    setFocusedSlug(slug)
    onNodeFocus(slug)
  }

  return (
    <div
      ref={barRef}
      className={`shrink-0 border-t border-gray-800 bg-gray-950/95 transition-all duration-300 ${
        visible ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
      }`}
    >
      <div className="flex items-start gap-0 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 h-full">

        {/* Query + keywords */}
        <div className="shrink-0 px-4 py-3 border-r border-gray-800 min-w-[180px] max-w-[220px]">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Query</p>
          <p className="text-xs text-gray-300 leading-snug line-clamp-2 mb-2" title={query}>{query}</p>
          <div className="flex flex-wrap gap-1">
            {keywords.map((kw) => {
              const hits = keywordMentions(kw, graphData)
              return (
                <button
                  key={kw}
                  onClick={() => hits.length > 0 && handleNodeFocus(hits[0])}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    hits.length > 0
                      ? 'bg-blue-900/60 text-blue-300 hover:bg-blue-800/80 border border-blue-800/40'
                      : 'bg-gray-800 text-gray-500 border border-gray-700/40 cursor-default'
                  }`}
                  title={hits.length > 0 ? `Found in: ${hits.join(', ')}` : 'Not found in any node'}
                >
                  {kw}
                  {hits.length > 0 && (
                    <span className="ml-1 opacity-60">{hits.length}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Source nodes */}
        <div className="shrink-0 px-4 py-3 border-r border-gray-800">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
            Sources <span className="text-gray-600 font-normal normal-case">({sources.length})</span>
          </p>
          <div className="flex gap-2">
            {sources.length === 0 ? (
              <p className="text-xs text-gray-700">No sources found</p>
            ) : (
              sources.map((slug) => {
                const degree = getNodeDegree(slug, graphData)
                const type = getNodeType(slug, graphData)
                const label = getLabel(slug, graphData)
                const isFocused = focusedSlug === slug
                return (
                  <div
                    key={slug}
                    className={`group flex flex-col gap-1.5 p-2.5 rounded-lg border cursor-pointer transition-all min-w-[110px] max-w-[140px] ${
                      isFocused
                        ? 'bg-blue-900/40 border-blue-600/60'
                        : 'bg-gray-900 border-gray-700/50 hover:border-gray-500/60 hover:bg-gray-800/60'
                    }`}
                    onClick={() => handleNodeFocus(slug)}
                  >
                    {/* Node type + label */}
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${TYPE_COLOR[type ?? 'stub']}`} />
                      <span className="text-xs text-gray-200 truncate font-medium flex-1" title={slug}>
                        {label}
                      </span>
                    </div>

                    {/* Degree bar */}
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-600">connections</span>
                        <span className="text-[10px] text-gray-400 font-medium">{degree}</span>
                      </div>
                      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-1 rounded-full transition-all ${isFocused ? 'bg-blue-400' : 'bg-blue-600'}`}
                          style={{ width: `${Math.max(8, (degree / maxDegree) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Type badge + action buttons */}
                    <div className="flex items-center gap-1">
                      {type && TYPE_LABEL[type] && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-gray-800 text-gray-500 uppercase tracking-wide">
                          {TYPE_LABEL[type]}
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onNoteOpen(slug) }}
                        className="ml-auto text-[10px] text-gray-600 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Open note"
                      >
                        ↗
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Connected neighbors */}
        {neighbors.length > 0 && (
          <div className="shrink-0 px-4 py-3 border-r border-gray-800">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
              Connected <span className="text-gray-600 font-normal normal-case">({neighbors.length})</span>
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
                    className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 transition-all text-left group"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 opacity-60 ${TYPE_COLOR[type ?? 'stub']}`} />
                    <span className="text-xs text-gray-400 group-hover:text-gray-200 truncate flex-1 transition-colors" title={slug}>
                      {label}
                    </span>
                    <span className="text-[10px] text-gray-700 shrink-0">{degree}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Summary stats */}
        <div className="shrink-0 px-4 py-3 min-w-[140px]">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Stats</p>
          <div className="space-y-2">
            <StatRow
              icon="◉"
              label="sources"
              value={sources.length}
              color="text-blue-400"
            />
            <StatRow
              icon="⬡"
              label="clusters"
              value={clusterCount}
              color="text-purple-400"
            />
            <StatRow
              icon="⇌"
              label="neighbors"
              value={neighbors.length}
              color="text-green-400"
            />
            {sources.length > 0 && (
              <StatRow
                icon="↕"
                label="max degree"
                value={maxDegree}
                color="text-amber-400"
              />
            )}
          </div>
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
    </div>
  )
}

function StatRow({
  icon,
  label,
  value,
  color,
}: {
  icon: string
  label: string
  value: number
  color: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[11px] ${color}`}>{icon}</span>
      <span className="text-xs text-gray-600 flex-1">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  )
}
