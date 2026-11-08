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
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { toneColor } from './ToneBar'
import { toneOf } from '../observation'
import type { ObservationTone } from '../observation'
import { useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { inSentence } from '../../i18n/languages'
import { inkOn, mix } from '../../widgets'
import { SCALE } from '../../widgets/kit/tokens'
import type { GraphNode } from '../graph'
import { causeLabel, formatObservationNumber } from '../observation'
import type { CauseStrength, ObservationImpact } from '../observation'
import { STATE_LABEL } from '../observationScope'

/** A lane holds the Why map's card and the air between two of them, and a row its height and the same air. */
export const LANE_WIDTH = 324
export const ROW_HEIGHT = 112
/** The Why map's card, which the Solve map draws its records on too. */
export const BOX = { width: 276, height: 98 }
export const RADIUS: Record<ObservationImpact, number> = { minor: 12, major: 17, critical: 23 }
/**
 * What a trace or a filter leaves of the records off it: the kit's one dimming, so the maps
 * recede as far as a board does and no further. 0.25 and 0.35 of their own measured 1.67:1.
 */
export const DIMMED = { opacity: 'var(--dim-opacity)' } as const

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
export function seenTint(theme: Theme, seen: number, maxSeen: number, tone: ObservationTone | boolean = 'neutral'): string {
  const share = maxSeen <= 1 ? 1 : (seen - 1) / (maxSeen - 1)
  // Tinted by its tone (ADR-0038, amended): the register's stripe colours.
  const said: ObservationTone = tone === true ? 'bright' : tone === false ? 'neutral' : tone
  return mix(toneColor(theme, said), 0.25 + share * 0.75, theme.palette.background.paper)
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
      <g {...(dim ? { style: DIMMED } : {})}>
        <title>{`${formatObservationNumber(node.observation.number)} ${node.observation.title}`}</title>
        <circle
          r={r}
          fill={fill}
          stroke={selected ? theme.palette.secondary.main : toneColor(theme, toneOf(node.observation))}
          strokeWidth={selected ? 3 : 1.5}
        />
        {seen > 1 && (
          <text textAnchor="middle" dy="0.35em" fontSize={11} fontWeight={600} fill={inkOn(theme, fill)}>{seen}×</text>
        )}
        <text textAnchor="middle" y={r + 15} fontFamily={SCALE['font-mono']} fill={theme.palette.text.secondary} style={{ fontSize: 'var(--canvas-t-xs)' }}>
          {formatObservationNumber(node.observation.number)}{node.scope !== undefined ? ' ↑' : ''}
        </text>
        {wrapTitle(node.observation.title, lineOf(BOX.width, 12), 2).map((text, index) => (
          <text key={index} textAnchor="middle" y={r + 31 + index * 16} fill={theme.palette.text.primary} style={{ fontSize: 'var(--canvas-t-sm)' }}>{text}</text>
        ))}
      </g>
    </g>
  )
}

/** A cause: the Why map's card, dashed while assumed, with the heavier rounded outline for a root. */
export function CauseMark(props: MarkProps<Extract<GraphNode, { kind: 'cause' }>> & { s: Translate; flag?: string }) {
  const theme = useTheme()
  const { node, x, y, selected, s, flag, dim, ...rest } = props
  const { language } = useStrings()
  const rootStroke = node.root ? theme.palette.secondary.main : node.cause.state === 'verified' ? theme.palette.success.main : theme.palette.warning.main
  const rx = node.root ? 18 : 6
  return (
    <g transform={`translate(${x - BOX.width / 2},${y - BOX.height / 2})`} {...rest} data-key={node.key} data-root={node.root ? 'true' : undefined}>
      <rect width={BOX.width} height={BOX.height} rx={rx} fill={theme.palette.background.paper} />
      <g {...(dim ? { style: DIMMED } : {})}>
        <title>{`${causeLabel(node.cause)} ${node.cause.title}`}</title>
        <CardFace
          width={BOX.width} height={BOX.height} rx={rx} fill={theme.palette.background.paper}
          stroke={selected ? theme.palette.secondary.main : rootStroke} strokeWidth={selected ? 3 : node.root ? 2.6 : 1.4}
          {...(node.cause.state === 'assumed' ? { dash: '5 4' } : {})}
          // The state only: a root cause says it is one by its outline, and the hover says it in words, as on the Why map.
          meta={`${causeLabel(node.cause)} · ${inSentence(s(STATE_LABEL[node.cause.state]), language)}`}
          title={node.cause.title} left={node.root ? 16 : 13}
        />
        {flag && <Flag x={BOX.width} y={0} title={flag} />}
      </g>
    </g>
  )
}

/** How many characters a card's line holds at the card's type: its width less the margins, over what a character takes. */
export function lineOf(width: number, left: number): number {
  return Math.floor((width - left - 12) / 7.8)
}

/**
 * A record as a card, drawn at its slot's corner: its label and state in the
 * mono line, then up to three lines of its title, words kept whole, in the
 * kit's canvas type. The Why map's records and the Solve map's are this card.
 */
export function CardFace(props: {
  width: number
  height: number
  rx: number
  fill: string
  stroke: string
  strokeWidth: number
  dash?: string
  /** A band down the left edge: an observation's impact, an experiment's outcome. */
  stripe?: string
  meta: string
  title: string
  /** Fewer title lines, where something else takes the card's last line. */
  lines?: number
  left?: number
  ink?: { meta: string; title: string }
  struck?: boolean
  children?: ReactNode
}) {
  const theme = useTheme()
  const { width, height, left = 13, lines = 3 } = props
  const ink = props.ink ?? { meta: theme.palette.text.secondary, title: theme.palette.text.primary }
  return (
    <>
      <rect width={width} height={height} rx={props.rx} fill={props.fill} stroke={props.stroke} strokeWidth={props.strokeWidth} strokeDasharray={props.dash} />
      {props.stripe && <rect x={0} y={0} width={4} height={height} rx={2} fill={props.stripe} />}
      <text x={left} y={21} fontFamily={SCALE['font-mono']} fill={ink.meta} style={{ fontSize: 'var(--canvas-t-sm)' }}>{props.meta}</text>
      {wrapTitle(props.title, lineOf(width, left), lines).map((text, index) => (
        <text key={index} x={left} y={44 + index * 20} fill={ink.title} textDecoration={props.struck ? 'line-through' : undefined} style={{ fontSize: 'var(--canvas-t-lg)' }}>{text}</text>
      ))}
      {props.children}
    </>
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

/**
 * A title in lines for a card: words kept whole where they fit, the last line
 * cut with an ellipsis. A median title is a sentence of a hundred characters, so a
 * card that cuts it to twenty-five says nothing.
 */
export function wrapTitle(title: string, perLine: number, lines: number): string[] {
  const out: string[] = []
  let line = ''
  const words = title.trim().split(/\s+/)
  for (let at = 0; at < words.length; at += 1) {
    const word = words[at]
    const next = line ? `${line} ${word}` : word
    if (next.length <= perLine) { line = next; continue }
    if (out.length === lines - 1) return [...out, shorten(next, perLine)]
    if (line) out.push(line)
    line = word.length > perLine ? shorten(word, perLine) : word
  }
  return line ? [...out, line] : out
}
