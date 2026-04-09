'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph/parseLinks'

interface GraphViewProps {
  data: GraphData
  onNodeClick: (nodeId: string, nodeType: 'wiki' | 'raw' | 'stub') => void
  highlightedSlugs?: Set<string>
}

type NodeType = 'wiki' | 'raw' | 'stub'
type SimNode = GraphNode & d3.SimulationNodeDatum
type SimLink = { source: SimNode; target: SimNode; label: string }

const NODE_COLOR: Record<NodeType, string> = {
  wiki: '#3b82f6',   // blue-500
  raw: '#ef4444',    // red-500
  stub: '#e5e7eb',   // gray-200
}

const NODE_RADIUS: Record<NodeType, number> = {
  wiki: 9,
  raw: 7,
  stub: 5,
}

const TYPE_LABELS: Record<NodeType, string> = {
  wiki: 'wiki',
  raw: 'raw',
  stub: 'stubs',
}

export default function GraphView({ data, onNodeClick, highlightedSlugs }: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  // Stable ref for the click handler — never a dep of simulation effects
  const onClickRef = useRef(onNodeClick)
  useEffect(() => { onClickRef.current = onNodeClick }, [onNodeClick])

  // Simulation ref — persists across re-renders
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null)

  // Dimensions ref — kept up to date by ResizeObserver
  const dimensionsRef = useRef({ width: 640, height: 480 })

  // Center strength ref — needed in ResizeObserver closure
  const centerStrengthRef = useRef(0.15)

  const [visibleTypes, setVisibleTypes] = useState<Set<NodeType>>(
    new Set(['wiki', 'stub'])
  )
  const [centerStrength, setCenterStrength] = useState(0.25)

  // Keep centerStrengthRef in sync
  useEffect(() => { centerStrengthRef.current = centerStrength }, [centerStrength])

  function toggleType(type: NodeType) {
    setVisibleTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  // ── ResizeObserver ──────────────────────────────────────────────────────────
  // Updates the center force position when the SVG resizes (sidebar/chat toggle).
  // Does NOT restart the simulation — nodes drift naturally to the new center.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const observer = new ResizeObserver(() => {
      const w = svg.clientWidth || 640
      const h = svg.clientHeight || 480
      dimensionsRef.current = { width: w, height: h }
      const sim = simulationRef.current
      if (sim) {
        const s = centerStrengthRef.current * 0.4
        sim.force('x', d3.forceX(w / 2).strength(s))
        sim.force('y', d3.forceY(h / 2).strength(s))
        sim.alpha(Math.min(sim.alpha() + 0.05, 0.3)).restart()
      }
    })
    observer.observe(svg)
    return () => observer.disconnect()
  }, []) // set up once only

  // ── Main simulation effect ──────────────────────────────────────────────────
  // Runs ONLY when data (new notes) or visible filter types change.
  // Does NOT depend on onNodeClick or highlightedSlugs.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const width = svg.clientWidth || 640
    const height = svg.clientHeight || 480
    dimensionsRef.current = { width, height }

    // Stop any previous simulation
    simulationRef.current?.stop()

    const root = d3.select(svg)
    root.selectAll('*').remove()

    // SVG glow filter for highlighted nodes
    const defs = root.append('defs')
    const filter = defs.append('filter')
      .attr('id', 'highlight-glow')
      .attr('x', '-60%').attr('y', '-60%')
      .attr('width', '220%').attr('height', '220%')
    filter.append('feGaussianBlur')
      .attr('in', 'SourceGraphic').attr('stdDeviation', '5').attr('result', 'blur')
    const merge = filter.append('feMerge')
    merge.append('feMergeNode').attr('in', 'blur')
    merge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Filter nodes
    const filteredNodes = data.nodes.filter((n) => visibleTypes.has(n.type))
    const visibleIds = new Set(filteredNodes.map((n) => n.id))
    const filteredEdges = data.edges.filter(
      (e: GraphEdge) => visibleIds.has(e.source) && visibleIds.has(e.target)
    )

    if (filteredNodes.length === 0) {
      root.append('text')
        .attr('x', width / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#4b5563').attr('font-size', '12px')
        .text('No nodes match the current filter')
      return
    }

    const g = root.append('g')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 6])
      .on('zoom', (event) => g.attr('transform', event.transform.toString()))
    root.call(zoom)

    const simNodes: SimNode[] = filteredNodes.map((n) => ({ ...n }))
    const idMap = new Map(simNodes.map((n) => [n.id, n]))

    const simLinks: SimLink[] = filteredEdges
      .map((e: GraphEdge) => {
        const s = idMap.get(e.source)
        const t = idMap.get(e.target)
        if (!s || !t) return null
        return { source: s, target: t, label: e.label }
      })
      .filter((l): l is SimLink => l !== null)

    const s = centerStrengthRef.current * 0.4
    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force('link', d3.forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(90))
      .force('charge', d3.forceManyBody<SimNode>().strength(-250))
      .force('x', d3.forceX(width / 2).strength(s))
      .force('y', d3.forceY(height / 2).strength(s))
      .force('collision', d3.forceCollide<SimNode>().radius((d) => NODE_RADIUS[d.type] + 6))

    simulationRef.current = simulation

    // Edges
    const link = g.append('g')
      .attr('stroke-opacity', 0.5)
      .selectAll<SVGLineElement, SimLink>('line')
      .data(simLinks).join('line')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1)

    // Edge labels — only on non-stub edges to avoid text clutter around stub nodes
    const edgeLabel = g.append('g')
      .selectAll<SVGTextElement, SimLink>('text')
      .data(simLinks.filter(l => l.source.type !== 'stub' && l.target.type !== 'stub'))
      .join('text')
      .text((d) => d.label)
      .attr('font-size', '7px').attr('font-family', 'monospace')
      .attr('fill', 'rgba(255,255,255,0.4)')
      .attr('text-anchor', 'middle').attr('pointer-events', 'none')

    // Nodes — use onClickRef so click handler never triggers a re-render
    const node = g.append('g')
      .selectAll<SVGCircleElement, SimNode>('circle')
      .data(simNodes).join('circle')
      .attr('r', (d) => NODE_RADIUS[d.type])
      .attr('fill', (d) => NODE_COLOR[d.type])
      .attr('stroke', '#111827').attr('stroke-width', 1.5)
      .attr('cursor', (d) => (d.type !== 'stub' ? 'pointer' : 'default'))
      .on('click', (_, d) => {
        if (d.type !== 'stub') onClickRef.current(d.id, d.type)
      })

    node.append('title').text((d) => d.label)

    const label = g.append('g')
      .selectAll<SVGTextElement, SimNode>('text')
      .data(simNodes).join('text')
      .text((d) => d.label)
      .attr('font-size', '9px').attr('font-family', 'monospace')
      .attr('fill', '#ffffff').attr('pointer-events', 'none')

    const drag = d3.drag<SVGCircleElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x; d.fy = d.y
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null; d.fy = null
      })
    node.call(drag)

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => d.source.x ?? 0).attr('y1', (d) => d.source.y ?? 0)
        .attr('x2', (d) => d.target.x ?? 0).attr('y2', (d) => d.target.y ?? 0)
      edgeLabel
        .attr('x', (d) => ((d.source.x ?? 0) + (d.target.x ?? 0)) / 2)
        .attr('y', (d) => ((d.source.y ?? 0) + (d.target.y ?? 0)) / 2 - 3)
      node.attr('cx', (d) => d.x ?? 0).attr('cy', (d) => d.y ?? 0)
      label
        .attr('x', (d) => (d.x ?? 0) + NODE_RADIUS[d.type] + 3)
        .attr('y', (d) => (d.y ?? 0) + 3)
    })

    // Auto-fit to show ~90% of the graph once the simulation settles
    simulation.on('end', () => {
      const { width: W, height: H } = dimensionsRef.current
      const xs = simNodes.map((d) => d.x ?? 0)
      const ys = simNodes.map((d) => d.y ?? 0)
      const xMin = Math.min(...xs), xMax = Math.max(...xs)
      const yMin = Math.min(...ys), yMax = Math.max(...ys)
      const pad = 60
      const graphW = xMax - xMin + pad * 2
      const graphH = yMax - yMin + pad * 2
      const scale = Math.min((W / graphW) * 0.9, (H / graphH) * 0.9, 1.5)
      const tx = W / 2 - scale * ((xMin + xMax) / 2)
      const ty = H / 2 - scale * ((yMin + yMax) / 2)
      root.transition().duration(600).call(
        zoom.transform,
        d3.zoomIdentity.translate(tx, ty).scale(scale)
      )
    })

    return () => { simulation.stop() }
  }, [data, visibleTypes]) // ← only data + filter; NOT onNodeClick, NOT highlightedSlugs

  // ── Center gravity effect ───────────────────────────────────────────────────
  // forceX/Y pull each node individually — isolated strays are kept in.
  // Slider maps 0→1 to strength 0→0.4 (halfway = 0.2, full = 0.4).
  useEffect(() => {
    const sim = simulationRef.current
    if (!sim) return
    const { width, height } = dimensionsRef.current
    const s = centerStrength * 0.4
    sim.force('x', d3.forceX(width / 2).strength(s))
    sim.force('y', d3.forceY(height / 2).strength(s))
    sim.alpha(0.3).restart()
  }, [centerStrength])

  // ── Highlight effect ────────────────────────────────────────────────────────
  // Purely visual — fills nodes yellow, no simulation touch.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    d3.select(svg)
      .selectAll<SVGCircleElement, SimNode>('circle')
      .attr('fill', (d) =>
        highlightedSlugs?.has(d.id) ? '#fbbf24' : NODE_COLOR[d.type]
      )
      .attr('stroke', (d) =>
        highlightedSlugs?.has(d.id) ? '#fbbf24' : '#111827'
      )
      .attr('stroke-width', (d) =>
        highlightedSlugs?.has(d.id) ? 3 : 1.5
      )
      .attr('filter', (d) =>
        highlightedSlugs?.has(d.id) ? 'url(#highlight-glow)' : null
      )
  }, [highlightedSlugs])

  return (
    <div className="flex flex-col h-full">
      {/* Filter + gravity bar */}
      <div className="px-3 py-2 border-b border-gray-800 flex items-center gap-4 shrink-0">
        {(['wiki', 'raw', 'stub'] as NodeType[]).map((type) => (
          <label key={type} className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={visibleTypes.has(type)}
              onChange={() => toggleType(type)}
              className="w-3 h-3 accent-gray-400"
            />
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ background: NODE_COLOR[type] }}
            />
            <span className="text-xs text-gray-400">{TYPE_LABELS[type]}</span>
          </label>
        ))}

        {/* Gravity slider */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-500 select-none">gravity</span>
          <input
            type="range"
            min={0.01}
            max={1.0}
            step={0.01}
            value={centerStrength}
            onChange={(e) => setCenterStrength(parseFloat(e.target.value))}
            className="w-24 accent-gray-400"
            title={`Center gravity: ${centerStrength.toFixed(2)}`}
          />
          <span className="text-xs text-gray-600 w-7 tabular-nums">
            {centerStrength.toFixed(2)}
          </span>
        </div>

        {highlightedSlugs && highlightedSlugs.size > 0 && (
          <span className="text-xs text-amber-400 flex items-center gap-1 shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            {highlightedSlugs.size} source{highlightedSlugs.size > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <svg
        ref={svgRef}
        className="flex-1 w-full"
        style={{ background: 'transparent' }}
      />
    </div>
  )
}
