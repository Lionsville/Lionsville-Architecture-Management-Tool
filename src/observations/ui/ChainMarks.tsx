// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The marks the Solutions tab draws its chain with (ADR-0021, ADR-0026): an
 * observation as a circle sized by its impact and tinted by how often it was
 * seen, a cause as a box — dashed while assumed, solid once verified, the
 * heavier rounded outline for a root cause — and the small flag that asks for
 * attention. The Analysis tab draws its own two sizes (`PictureMarks`), and
 * shares the tint.
 */
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import type { Translate } from '../../i18n'
import { inkOn, mix } from '../../widgets'
import type { GraphNode } from '../graph'
import { causeLabel, formatObservationNumber } from '../observation'
import type { CauseStrength, ObservationImpact } from '../observation'
import { STATE_LABEL } from '../observationScope'

export const LANE_WIDTH = 260
export const ROW_HEIGHT = 84
export const BOX = { width: 180, height: 44 }
export const RADIUS: Record<ObservationImpact, number> = { minor: 12, major: 17, critical: 23 }
export const STROKE: Record<CauseStrength, { width: number; dash?: string }> = {
  strong: { width: 3.5 },
  normal: { width: 1.6 },
  weak: { width: 1.4, dash: '3 4' },
}

/** The invisible band along a line that takes the right-click, so a thin line is not a one-pixel target. */
export const LINE_HIT_WIDTH = 12

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

/**
 * How an observation seen `seen` times is tinted, among marks the most-seen of
 * which was seen `maxSeen` times: once is the palest, a quarter of the accent
 * over the paper, and the most-seen is the full accent.
 *
 * Worked out here rather than left to CSS's `color-mix`, because the count
 * drawn on the circle has to be lettered against this colour: the page's ink
 * on the full accent was 2.2:1 in the dark mode and 3.5:1 in the light
 * (`inkOn`).
 */
export function seenTint(theme: Theme, seen: number, maxSeen: number): string {
  const share = maxSeen <= 1 ? 1 : (seen - 1) / (maxSeen - 1)
  return mix(theme.palette.primary.main, 0.25 + share * 0.75, theme.palette.background.paper)
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
          <text textAnchor="middle" dy="0.35em" fontSize={11} fontWeight={600} fill={inkOn(theme, fill)}>{seen}×</text>
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
        <title>{`${causeLabel(node.cause)} ${node.cause.title}`}</title>
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
          {causeLabel(node.cause)} · {s(STATE_LABEL[node.cause.state]).toLowerCase()}{node.root ? ` · ${s('observation.rootCause').toLowerCase()}` : ''}
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
