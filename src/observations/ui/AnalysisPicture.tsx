// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The analysis drawn: observations on the left as circles, the causes they
 * were analysed into in the lanes to the right, root causes last (ADR-0021).
 *
 * Plain SVG over `analysisGraph` and `placeGraph`: no canvas, no library,
 * nothing dragged. A mark's size is the observation's impact, its tint how
 * often it was seen; a cause is a box with a dashed outline while assumed and
 * a solid one once verified, and a root cause is drawn with the heavier
 * outline. A line is thick, ordinary or dotted for a strong, normal or weak
 * link. Clicking anything selects it, which is how the team walks the picture
 * while analysing; a right-click on a node or a line asks the page what can be
 * done with it (`PictureMenu`).
 */
import { useMemo, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import type { Translate } from '../../i18n'
import { analysisGraph, placeGraph } from '../graph'
import type { GraphNode } from '../graph'
import { formatCauseNumber, formatObservationNumber } from '../observation'
import type { Analysis, CauseStrength, ObservationImpact, SharedObservation } from '../observation'
import { STATE_LABEL } from '../observationScope'
import type { PictureMenuHandler } from './PictureMenu'

export const LANE_WIDTH = 260
export const ROW_HEIGHT = 84
export const BOX = { width: 180, height: 44 }
export const RADIUS: Record<ObservationImpact, number> = { minor: 12, major: 17, critical: 23 }
export const STROKE: Record<CauseStrength, { width: number; dash?: string }> = {
  strong: { width: 3.5 },
  normal: { width: 1.6 },
  weak: { width: 1.4, dash: '3 4' },
}

export type AnalysisPictureProps = {
  analysis: Analysis
  shared: readonly SharedObservation[]
  selectedKey?: string
  onSelect: (key: string) => void
  /** A right-click on a node or a line; absent, the browser's own menu. */
  onMenu?: PictureMenuHandler
  s: Translate
}

/** The invisible band along a line that takes the right-click, so a thin line is not a one-pixel target. */
export const LINE_HIT_WIDTH = 12

export function AnalysisPicture({ analysis, shared, selectedKey, onSelect, onMenu, s }: AnalysisPictureProps) {
  const theme = useTheme()
  const graph = useMemo(() => analysisGraph(analysis, shared), [analysis, shared])
  const placed = useMemo(() => placeGraph(graph, { laneWidth: LANE_WIDTH, rowHeight: ROW_HEIGHT, top: 36, left: 0 }), [graph])
  const at = useMemo(() => new Map(placed.map((one) => [one.key, one])), [placed])
  const rows = Math.max(1, ...graph.nodes.map((node) => node.row + 1))
  const width = graph.lanes * LANE_WIDTH
  const height = 36 + rows * ROW_HEIGHT + 16
  const maxSeen = Math.max(1, ...graph.nodes.map((node) => (node.kind === 'observation' ? node.observation.seen : 1)))
  const tint = (seen: number) => {
    // Once is the palest; the most-seen is the full colour.
    const share = maxSeen === 1 ? 1 : (seen - 1) / (maxSeen - 1)
    return `color-mix(in srgb, ${theme.palette.primary.main} ${Math.round(25 + share * 75)}%, ${theme.palette.background.paper})`
  }
  const laneTitle = (lane: number) => (
    lane === 0 ? s('observation.laneObservations') : lane === graph.lanes - 1 && graph.lanes > 1 ? s('observation.laneRoots') : s('observation.laneCauses')
  )

  if (graph.nodes.length === 0) {
    return (
      <Box sx={{ p: 5, color: 'text.secondary' }}>
        <Typography>{s('observation.graphEmpty')}</Typography>
      </Box>
    )
  }

  const line = theme.palette.text.secondary
  const nodeOf = (key: string): GraphNode | undefined => graph.nodes.find((node) => node.key === key)

  return (
    <Box sx={{ overflow: 'auto', flex: 1, minHeight: 0, bgcolor: 'background.default' }}>
      <svg
        width={Math.max(width, 3 * LANE_WIDTH)}
        height={height}
        role="img"
        aria-label={s('observation.tabAnalysis')}
        data-testid="analysis-picture"
        style={{ display: 'block', fontFamily: theme.typography.fontFamily }}
      >
        {/* lane headings */}
        {Array.from({ length: graph.lanes }, (_, lane) => (
          <text
            key={lane}
            x={lane * LANE_WIDTH + LANE_WIDTH / 2}
            y={18}
            textAnchor="middle"
            fontSize={11}
            fill={theme.palette.text.secondary}
            style={{ textTransform: 'uppercase', letterSpacing: '.05em' }}
          >
            {laneTitle(lane)}
          </text>
        ))}

        {/* links: from what is explained to the cause that explains it */}
        {graph.edges.map((edge) => {
          const from = at.get(edge.from)
          const to = at.get(edge.to)
          if (!from || !to) return null
          const fromNode = nodeOf(edge.from)
          const startX = from.x + (fromNode?.kind === 'observation' ? RADIUS[fromNode.observation.impact] : BOX.width / 2)
          const endX = to.x - BOX.width / 2
          const mid = (startX + endX) / 2
          const stroke = STROKE[edge.strength]
          const dim = selectedKey !== undefined && edge.from !== selectedKey && edge.to !== selectedKey
          const d = `M${startX},${from.y} C${mid},${from.y} ${mid},${to.y} ${endX},${to.y}`
          const explained = fromNode
          const cause = nodeOf(edge.to)
          return (
            <g key={`${edge.from}->${edge.to}`}>
              <path
                d={d}
                fill="none"
                stroke={line}
                strokeWidth={stroke.width}
                strokeDasharray={stroke.dash}
                strokeOpacity={dim ? 0.2 : 0.75}
                data-testid="analysis-link"
                data-strength={edge.strength}
              />
              {onMenu && explained && cause && (
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={LINE_HIT_WIDTH}
                  pointerEvents="stroke"
                  data-testid="analysis-link-hit"
                  onContextMenu={(event) => {
                    event.preventDefault()
                    onMenu({
                      kind: 'explains', causeId: cause.id, id: explained.id,
                      ...(explained.kind === 'observation' && explained.scope !== undefined ? { scope: explained.scope } : {}),
                      strength: edge.strength,
                    }, { x: event.clientX, y: event.clientY })
                  }}
                />
              )}
            </g>
          )
        })}

        {/* nodes */}
        {graph.nodes.map((node) => {
          const spot = at.get(node.key)
          if (!spot) return null
          const selected = node.key === selectedKey
          const common = {
            cursor: 'pointer' as const,
            onClick: () => onSelect(node.key),
            onContextMenu: onMenu ? (event: ReactMouseEvent) => {
              event.preventDefault()
              onMenu({ kind: 'node', key: node.key }, { x: event.clientX, y: event.clientY })
            } : undefined,
            'data-testid': node.kind === 'observation' ? 'analysis-observation' : 'analysis-cause',
          }
          if (node.kind === 'observation') {
            return <ObservationMark key={node.key} node={node} x={spot.x} y={spot.y} selected={selected} fill={tint(node.observation.seen)} {...common} />
          }
          return <CauseMark key={node.key} node={node} x={spot.x} y={spot.y} selected={selected} s={s} {...common} />
        })}
      </svg>
    </Box>
  )
}

type MarkProps<N> = {
  node: N
  x: number
  y: number
  selected: boolean
  onClick: () => void
  onContextMenu?: (event: ReactMouseEvent) => void
  cursor: 'pointer'
  'data-testid': string
  dim?: boolean
}

/** An observation: a circle sized by its impact, tinted by how often it was seen. */
export function ObservationMark(props: MarkProps<Extract<GraphNode, { kind: 'observation' }>> & { fill: string }) {
  const theme = useTheme()
  const { node, x, y, selected, fill, dim, ...rest } = props
  const r = RADIUS[node.observation.impact]
  const seen = node.observation.seen
  return (
    <g transform={`translate(${x},${y})`} {...rest} data-key={node.key}>
      {/* An opaque backing, so a dimmed mark still hides the lines behind it. */}
      <circle r={r} fill={theme.palette.background.default} />
      <g opacity={dim ? 0.35 : 1}>
        <title>{`${formatObservationNumber(node.observation.number)} ${node.observation.title}`}</title>
        <circle
          r={r}
          fill={fill}
          stroke={selected ? theme.palette.secondary.main : theme.palette.primary.main}
          strokeWidth={selected ? 3 : 1.5}
        />
        {seen > 1 && (
          <text textAnchor="middle" dy="0.35em" fontSize={11} fontWeight={600} fill={theme.palette.text.primary}>{seen}×</text>
        )}
        <text textAnchor="middle" y={r + 13} fontSize={10} fill={theme.palette.text.secondary}>
          {formatObservationNumber(node.observation.number)}{node.scope !== undefined ? ' ↑' : ''}
        </text>
        <text textAnchor="middle" y={r + 25} fontSize={10} fill={theme.palette.text.primary}>
          {shorten(node.observation.title, 34)}
        </text>
      </g>
    </g>
  )
}

/** A cause: a box, dashed while assumed, with the heavier rounded outline for a root. */
export function CauseMark(props: MarkProps<Extract<GraphNode, { kind: 'cause' }>> & { s: Translate; flag?: string }) {
  const theme = useTheme()
  const { node, x, y, selected, s, flag, dim, ...rest } = props
  const rootStroke = node.root ? theme.palette.secondary.main : node.cause.state === 'verified' ? theme.palette.success.main : theme.palette.warning.main
  return (
    <g transform={`translate(${x},${y})`} {...rest} data-key={node.key} data-root={node.root ? 'true' : undefined}>
      <rect x={-BOX.width / 2} y={-BOX.height / 2} width={BOX.width} height={BOX.height} rx={node.root ? BOX.height / 2 : 5} fill={theme.palette.background.paper} />
      <g opacity={dim ? 0.35 : 1}>
        <title>{`${formatCauseNumber(node.cause.number)} ${node.cause.title}`}</title>
        <rect
          x={-BOX.width / 2}
          y={-BOX.height / 2}
          width={BOX.width}
          height={BOX.height}
          rx={node.root ? BOX.height / 2 : 5}
          fill={theme.palette.background.paper}
          stroke={selected ? theme.palette.secondary.main : rootStroke}
          strokeWidth={selected ? 3 : node.root ? 2.5 : 1.8}
          strokeDasharray={node.cause.state === 'assumed' ? '5 3' : undefined}
        />
        <text textAnchor="middle" dy="-0.15em" fontSize={11} fill={theme.palette.text.primary}>
          {shorten(node.cause.title, 28)}
        </text>
        <text textAnchor="middle" dy="1.05em" fontSize={10} fill={theme.palette.text.secondary}>
          {formatCauseNumber(node.cause.number)} · {s(STATE_LABEL[node.cause.state]).toLowerCase()}{node.root ? ` · ${s('observation.rootCause').toLowerCase()}` : ''}
        </text>
        {flag && <Flag x={BOX.width / 2} y={-BOX.height / 2} title={flag} />}
      </g>
    </g>
  )
}

/** The small mark on a node that asks for attention, with the reason as its title. */
export function Flag({ x, y, title, strong = false }: { x: number; y: number; title: string; strong?: boolean }) {
  const theme = useTheme()
  return (
    <g transform={`translate(${x},${y})`} data-testid="picture-flag">
      <title>{title}</title>
      <circle r={8} fill={strong ? theme.palette.error.main : theme.palette.warning.main} />
      <text textAnchor="middle" dy="0.35em" fontSize={11} fontWeight={700} fill={theme.palette.background.paper}>!</text>
    </g>
  )
}

export function shorten(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/** What the marks mean, said once under the picture. */
export function PictureLegend({ s }: { s: Translate }) {
  const theme = useTheme()
  const row = (glyph: ReactNode, text: string) => (
    <Box key={text} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <svg width={34} height={14} aria-hidden>{glyph}</svg>
      <Typography variant="caption" color="text.secondary">{text}</Typography>
    </Box>
  )
  return (
    <Box data-testid="analysis-legend" sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, px: 2, py: 1, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      {row(<><circle cx={8} cy={7} r={4} fill="none" stroke={theme.palette.primary.main} /><circle cx={22} cy={7} r={6.5} fill="none" stroke={theme.palette.primary.main} /></>, s('observation.legendImpact'))}
      {row(<><circle cx={6} cy={7} r={5} fill={theme.palette.primary.main} fillOpacity={0.25} /><circle cx={17} cy={7} r={5} fill={theme.palette.primary.main} fillOpacity={0.6} /><circle cx={28} cy={7} r={5} fill={theme.palette.primary.main} /></>, s('observation.legendSeen'))}
      {row(<rect x={2} y={3} width={30} height={8} rx={2} fill="none" stroke={theme.palette.warning.main} strokeDasharray="3 2" />, s('observation.legendAssumed'))}
      {row(<rect x={2} y={3} width={30} height={8} rx={2} fill="none" stroke={theme.palette.success.main} />, s('observation.legendVerified'))}
      {row(<rect x={2} y={3} width={30} height={8} rx={4} fill="none" stroke={theme.palette.secondary.main} strokeWidth={2} />, s('observation.legendRoot'))}
      {row(<><line x1={2} y1={3} x2={32} y2={3} stroke={theme.palette.text.secondary} strokeWidth={3} /><line x1={2} y1={8} x2={32} y2={8} stroke={theme.palette.text.secondary} strokeWidth={1.5} /><line x1={2} y1={12} x2={32} y2={12} stroke={theme.palette.text.secondary} strokeDasharray="3 3" /></>, s('observation.legendStrength'))}
    </Box>
  )
}
