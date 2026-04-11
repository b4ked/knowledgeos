'use client'

import { useState, useEffect, useCallback } from 'react'
import type { GraphInsights, NodeDegree, Cluster } from '@/lib/graph/analyze'

interface InsightsPanelProps {
  onClose: () => void
  onNoteClick?: (slug: string) => void
}

interface InsightsResponse {
  insights: GraphInsights
  graphData: { nodeCount: number; edgeCount: number }
  semanticClusters: Array<{ id: number; slugs: string[]; centroid?: string }> | null
  error?: string
}

type Tab = 'overview' | 'hubs' | 'gaps' | 'clusters' | 'semantic'

export default function InsightsPanel({ onClose, onNoteClick }: InsightsPanelProps) {
  const [data, setData] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [semanticLoading, setSemanticLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')

  const fetchInsights = useCallback(async (mode: 'graph' | 'semantic' = 'graph') => {
    if (mode === 'semantic') {
      setSemanticLoading(true)
    } else {
      setLoading(true)
    }
    setError(null)
    try {
      const res = await fetch(`/api/insights?mode=${mode}`)
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? `Request failed: ${res.status}`)
      }
      const json = await res.json() as InsightsResponse
      setData((prev) => prev ? { ...prev, ...json } : json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights')
    } finally {
      setLoading(false)
      setSemanticLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInsights('graph')
  }, [fetchInsights])

  function handleTabChange(next: Tab) {
    setTab(next)
    if (next === 'semantic' && data && !data.semanticClusters) {
      fetchInsights('semantic')
    }
  }

  function handleNoteClick(slug: string) {
    onNoteClick?.(slug)
  }

  const insights = data?.insights

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-100">Vault Insights</h2>
            {insights && (
              <p className="text-xs text-gray-500 mt-0.5">
                {insights.stats.totalNotes} notes · {insights.stats.totalEdges} links · {insights.stats.clusterCount} clusters
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition-colors text-lg leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 shrink-0">
          {(['overview', 'hubs', 'gaps', 'clusters', 'semantic'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`px-4 py-2.5 text-xs font-medium capitalize transition-colors ${
                tab === t
                  ? 'text-blue-300 border-b-2 border-blue-400 -mb-px'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => fetchInsights(tab === 'semantic' ? 'semantic' : 'graph')}
            className="px-3 text-xs text-gray-600 hover:text-gray-400 transition-colors"
            title="Refresh"
          >
            ↻
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs text-gray-600">Analysing vault…</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          ) : !insights ? null : (
            <>
              {tab === 'overview' && <OverviewTab insights={insights} onNoteClick={handleNoteClick} />}
              {tab === 'hubs' && <HubsTab insights={insights} onNoteClick={handleNoteClick} />}
              {tab === 'gaps' && <GapsTab insights={insights} onNoteClick={handleNoteClick} />}
              {tab === 'clusters' && <ClustersTab insights={insights} onNoteClick={handleNoteClick} />}
              {tab === 'semantic' && (
                <SemanticTab
                  clusters={data?.semanticClusters ?? null}
                  loading={semanticLoading}
                  onNoteClick={handleNoteClick}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Tab components ---

function OverviewTab({ insights, onNoteClick }: { insights: GraphInsights; onNoteClick: (slug: string) => void }) {
  const { stats, hubs, orphans, stubs, bridges } = insights
  return (
    <div className="space-y-5">
      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Notes', value: stats.totalNotes },
          { label: 'Links', value: stats.totalEdges },
          { label: 'Avg Connections', value: stats.avgDegree },
          { label: 'Max Connections', value: stats.maxDegree },
          { label: 'Orphaned', value: stats.orphanCount, warn: stats.orphanCount > 0 },
          { label: 'Knowledge Gaps', value: stats.totalStubs, warn: stats.totalStubs > 0 },
        ].map((s) => (
          <div key={s.label} className="bg-gray-800 rounded-lg p-3">
            <p className={`text-xl font-bold ${s.warn ? 'text-amber-400' : 'text-gray-100'}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Top hub */}
      {hubs.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Most Connected Note</p>
          <NoteChip node={hubs[0]} onNoteClick={onNoteClick} accent="blue" />
        </div>
      )}

      {/* Bridge nodes */}
      {bridges.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Key Connectors</p>
          <p className="text-xs text-gray-600 mb-2">Notes that bridge separate clusters — removing these would disconnect your knowledge graph.</p>
          <div className="flex flex-wrap gap-2">
            {bridges.slice(0, 5).map((b) => (
              <NoteChip key={b.slug} node={b} onNoteClick={onNoteClick} accent="purple" />
            ))}
          </div>
        </div>
      )}

      {/* Orphan notice */}
      {orphans.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-900/50 rounded-lg p-3">
          <p className="text-xs font-medium text-amber-400 mb-1">
            {orphans.length} isolated note{orphans.length > 1 ? 's' : ''}
          </p>
          <p className="text-xs text-gray-500">These notes have no links. Consider linking them to related notes.</p>
        </div>
      )}

      {/* Stubs notice */}
      {stubs.length > 0 && (
        <div className="bg-orange-950/30 border border-orange-900/50 rounded-lg p-3">
          <p className="text-xs font-medium text-orange-400 mb-1">
            {stubs.length} knowledge gap{stubs.length > 1 ? 's' : ''}
          </p>
          <p className="text-xs text-gray-500">
            These notes are referenced via wikilinks but haven&apos;t been written yet.
          </p>
        </div>
      )}
    </div>
  )
}

function HubsTab({ insights, onNoteClick }: { insights: GraphInsights; onNoteClick: (slug: string) => void }) {
  const { hubs, allDegrees } = insights
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">Hub Notes</p>
        <p className="text-xs text-gray-600 mb-3">
          The most connected notes in your vault. These are your core knowledge nodes.
        </p>
        {hubs.length === 0 ? (
          <p className="text-xs text-gray-600">No connected notes yet.</p>
        ) : (
          <div className="space-y-2">
            {hubs.map((node, i) => (
              <div
                key={node.slug}
                className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-gray-700 transition-colors"
                onClick={() => onNoteClick(node.slug)}
              >
                <span className="text-xs text-gray-600 w-5 text-right shrink-0">#{i + 1}</span>
                <span className="flex-1 text-sm text-gray-200 truncate">{node.label}</span>
                <div className="flex items-center gap-3 shrink-0 text-xs">
                  <span className="text-green-400" title="In-degree (other notes link to this)">↓{node.inDegree}</span>
                  <span className="text-blue-400" title="Out-degree (this note links out)">↑{node.outDegree}</span>
                  <span className="text-gray-400 font-medium">{node.totalDegree} total</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {allDegrees.filter((d) => d.totalDegree === 0).length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">All Notes — Degree Distribution</p>
          <DegreeBar degrees={allDegrees} />
        </div>
      )}
    </div>
  )
}

function GapsTab({ insights, onNoteClick }: { insights: GraphInsights; onNoteClick: (slug: string) => void }) {
  const { stubs, orphans } = insights
  return (
    <div className="space-y-5">
      {stubs.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">
            Knowledge Gaps ({stubs.length})
          </p>
          <p className="text-xs text-gray-600 mb-3">
            These notes are referenced via <code className="text-gray-400">[[wikilinks]]</code> but have not been created yet.
            Click to begin writing them.
          </p>
          <div className="space-y-1">
            {stubs.map((stub) => (
              <div
                key={stub.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 cursor-pointer transition-colors"
                onClick={() => onNoteClick(stub.id)}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                <span className="text-sm text-orange-300 truncate">{stub.label}</span>
                <span className="text-xs text-gray-600 ml-auto">not created</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {orphans.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">
            Isolated Notes ({orphans.length})
          </p>
          <p className="text-xs text-gray-600 mb-3">
            These notes have no incoming or outgoing links. They exist in isolation — consider linking them to related notes.
          </p>
          <div className="space-y-1">
            {orphans.map((node) => (
              <div
                key={node.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 cursor-pointer transition-colors"
                onClick={() => onNoteClick(node.id)}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="text-sm text-amber-300 truncate">{node.label}</span>
                <span className="text-xs text-gray-600 ml-auto capitalize">{node.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stubs.length === 0 && orphans.length === 0 && (
        <div className="flex items-center justify-center h-24">
          <p className="text-xs text-gray-600">No gaps or isolated notes found. Your vault is well connected.</p>
        </div>
      )}
    </div>
  )
}

function ClustersTab({ insights, onNoteClick }: { insights: GraphInsights; onNoteClick: (slug: string) => void }) {
  const { clusters } = insights
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]))

  function toggleCluster(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-600">
        Connected components of your knowledge graph. Notes within a cluster can all reach each other via links.
      </p>
      {clusters.length === 0 ? (
        <p className="text-xs text-gray-600">No clusters found.</p>
      ) : (
        clusters.map((cluster, i) => (
          <div key={cluster.id} className="bg-gray-800 rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-700 transition-colors text-left"
              onClick={() => toggleCluster(cluster.id)}
            >
              <span className="text-xs text-gray-500">Cluster {i + 1}</span>
              <span className="flex-1 text-xs text-gray-300 font-medium">
                {cluster.labels.slice(0, 3).join(', ')}{cluster.size > 3 ? ` +${cluster.size - 3} more` : ''}
              </span>
              <span className="text-xs text-gray-500">{cluster.size} notes</span>
              <span className="text-xs text-gray-600">{expanded.has(cluster.id) ? '▲' : '▼'}</span>
            </button>
            {expanded.has(cluster.id) && (
              <div className="border-t border-gray-700 px-3 py-2 flex flex-wrap gap-1.5">
                {cluster.slugs.map((slug) => (
                  <button
                    key={slug}
                    onClick={() => onNoteClick(slug)}
                    className="text-xs px-2 py-0.5 bg-gray-700 text-blue-300 hover:bg-gray-600 rounded transition-colors truncate max-w-[180px]"
                    title={slug}
                  >
                    {slug.split('/').pop()}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

function SemanticTab({
  clusters,
  loading,
  onNoteClick,
}: {
  clusters: Array<{ id: number; slugs: string[]; centroid?: string }> | null
  loading: boolean
  onNoteClick: (slug: string) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-xs text-gray-600">Computing semantic clusters…</p>
      </div>
    )
  }

  if (!clusters) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <p className="text-xs text-gray-600">Semantic clustering requires an indexed vault.</p>
        <p className="text-xs text-gray-700">Switch to this tab to trigger analysis.</p>
      </div>
    )
  }

  if (clusters.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-xs text-gray-600">
          Not enough semantic similarity to form clusters, or fewer than 2 notes are indexed.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-600">
        Notes grouped by semantic similarity — what they&apos;re about, not just how they&apos;re linked.
        Groups with threshold ≥ 65% cosine similarity.
      </p>
      {clusters.map((cluster, i) => (
        <div key={cluster.id} className="bg-gray-800 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-400 mb-2">
            Semantic group {i + 1} · {cluster.slugs.length} notes
          </p>
          <div className="flex flex-wrap gap-1.5">
            {cluster.slugs.map((slug) => (
              <button
                key={slug}
                onClick={() => onNoteClick(slug)}
                className="text-xs px-2 py-0.5 bg-gray-700 text-green-300 hover:bg-gray-600 rounded transition-colors truncate max-w-[180px]"
                title={slug}
              >
                {slug.split('/').pop()}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// --- Shared primitives ---

function NoteChip({ node, onNoteClick, accent }: { node: NodeDegree; onNoteClick: (slug: string) => void; accent: 'blue' | 'purple' }) {
  const colorMap = {
    blue: 'bg-blue-900/40 text-blue-300 hover:bg-blue-800/60 border border-blue-800/50',
    purple: 'bg-purple-900/40 text-purple-300 hover:bg-purple-800/60 border border-purple-800/50',
  }
  return (
    <button
      onClick={() => onNoteClick(node.slug)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${colorMap[accent]}`}
    >
      <span className="font-medium truncate max-w-[200px]">{node.label}</span>
      <span className="text-xs opacity-60 shrink-0">{node.totalDegree} links</span>
    </button>
  )
}

function DegreeBar({ degrees }: { degrees: NodeDegree[] }) {
  const max = Math.max(1, degrees[0]?.totalDegree ?? 1)
  return (
    <div className="space-y-1">
      {degrees.slice(0, 15).map((d) => (
        <div key={d.slug} className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-32 truncate shrink-0">{d.label}</span>
          <div className="flex-1 bg-gray-800 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-blue-600"
              style={{ width: `${(d.totalDegree / max) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-600 w-5 text-right shrink-0">{d.totalDegree}</span>
        </div>
      ))}
    </div>
  )
}
