'use client'

import { useEffect, useRef, useCallback } from 'react'
import * as d3 from 'd3'
import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph/parseLinks'

interface GraphViewProps {
  data: GraphData
  onNodeClick: (nodeId: string, nodeType: 'wiki' | 'raw' | 'stub') => void
}

type SimNode = GraphNode & d3.SimulationNodeDatum
type SimLink = { source: SimNode; target: SimNode }

const NODE_COLOR: Record<GraphNode['type'], string> = {
  wiki: '#3b82f6',   // blue-500
  raw: '#f97316',    // orange-500
  stub: '#4b5563',   // gray-600
}

const NODE_RADIUS: Record<GraphNode['type'], number> = {
  wiki: 9,
  raw: 7,
  stub: 5,
}

export default function GraphView({ data, onNodeClick }: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  const handleClick = useCallback(
    (node: SimNode) => onNodeClick(node.id, node.type),
    [onNodeClick]
  )

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const width = svg.clientWidth || 640
    const height = svg.clientHeight || 480

    const root = d3.select(svg)
    root.selectAll('*').remove()

    if (data.nodes.length === 0) return

    // Container group — receives zoom transforms
    const g = root.append('g')

    // Zoom + pan
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => g.attr('transform', event.transform.toString()))
    root.call(zoom)

    // Deep-clone nodes so D3 can mutate them
    const simNodes: SimNode[] = data.nodes.map((n) => ({ ...n }))
    const idMap = new Map(simNodes.map((n) => [n.id, n]))

    const simLinks: SimLink[] = data.edges
      .map((e: GraphEdge) => {
        const s = idMap.get(e.source)
        const t = idMap.get(e.target)
        if (!s || !t) return null
        return { source: s, target: t }
      })
      .filter((l): l is SimLink => l !== null)

    // Force simulation
    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force('link', d3.forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(90))
      .force('charge', d3.forceManyBody<SimNode>().strength(-250))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimNode>().radius((d) => NODE_RADIUS[d.type] + 6))

    // Edges
    const link = g
      .append('g')
      .attr('stroke-opacity', 0.4)
      .selectAll<SVGLineElement, SimLink>('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', '#374151')
      .attr('stroke-width', 1)

    // Nodes group
    const node = g
      .append('g')
      .selectAll<SVGCircleElement, SimNode>('circle')
      .data(simNodes)
      .join('circle')
      .attr('r', (d) => NODE_RADIUS[d.type])
      .attr('fill', (d) => NODE_COLOR[d.type])
      .attr('stroke', '#111827')
      .attr('stroke-width', 1.5)
      .attr('cursor', (d) => (d.type !== 'stub' ? 'pointer' : 'default'))
      .on('click', (_, d) => {
        if (d.type !== 'stub') handleClick(d)
      })

    // Tooltip title
    node.append('title').text((d) => d.label)

    // Labels for non-stub nodes
    const label = g
      .append('g')
      .selectAll<SVGTextElement, SimNode>('text')
      .data(simNodes.filter((n) => n.type !== 'stub'))
      .join('text')
      .text((d) => d.label)
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .attr('fill', '#9ca3af')
      .attr('pointer-events', 'none')

    // Drag behaviour
    const drag = d3
      .drag<SVGCircleElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })

    node.call(drag)

    // Tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => d.source.x ?? 0)
        .attr('y1', (d) => d.source.y ?? 0)
        .attr('x2', (d) => d.target.x ?? 0)
        .attr('y2', (d) => d.target.y ?? 0)

      node.attr('cx', (d) => d.x ?? 0).attr('cy', (d) => d.y ?? 0)

      label
        .attr('x', (d) => (d.x ?? 0) + NODE_RADIUS[d.type] + 3)
        .attr('y', (d) => (d.y ?? 0) + 3)
    })

    return () => {
      simulation.stop()
    }
  }, [data, handleClick])

  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      style={{ background: 'transparent' }}
    />
  )
}
