// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One record on the analysis picture, in either of its two sizes (ADR-0032 §8).
 *
 * **Large** is a card for every kind, with its label and title: an
 * observation with its impact as a stripe down the left and its count, a
 * cause dashed while assumed and solid once verified, a root cause with the
 * heavier, rounder outline, a solution filled. **Small** is a circle for every
 * kind with the label and a short title under it: an observation filled and
 * sized by its impact, a cause hollow, a root cause with a double ring, a
 * solution a square. Dashed means assumed in both.
 *
 * Both keep the `?` on a cause that is not a root and that nothing explains —
 * an open end — and a marker where a link leaves the picture: a cause above
 * explaining this one, or causes below that this one explains and that are
 * not drawn.
 *
 * Drawn at the origin of the record's slot; the picture places it.
 */
import { useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import type { Translate } from '../../i18n'
import { inkOn, mix } from '../../widgets'
import { PICTURE_SIZE } from '../graph'
import type { PictureNode, PictureSize } from '../graph'
import { causeLabel, formatObservationNumber } from '../observation'
import type { ObservationImpact } from '../observation'
import { PHASE_LABEL, STATE_LABEL } from '../observationScope'
import { formatSolutionNumber } from '../solution'
import { shorten } from './ChainMarks'

/** A small mark's radius per impact: the size of an observation is how much it hurts. */
export const DOT: Record<ObservationImpact, number> = { minor: 10, major: 13, critical: 16 }
/** Where a small mark's centre stands in its slot. */
export const SMALL_CENTRE = 20

export function recordLabel(node: PictureNode): string {
  if (node.kind === 'observation') return formatObservationNumber(node.observation.number)
  if (node.kind === 'cause') return causeLabel(node.cause)
  return formatSolutionNumber(node.solution.number)
}

export function recordTitle(node: PictureNode): string {
  return node.kind === 'observation' ? node.observation.title : node.kind === 'cause' ? node.cause.title : node.solution.title
}

/** What kind of record it is and where it stands, in the words the reader uses. */
export function recordState(node: PictureNode, s: Translate): string {
  if (node.kind === 'observation') return s('observation.seenTimes', { count: node.observation.seen })
  if (node.kind === 'solution') return s(PHASE_LABEL[node.solution.state]).toLowerCase()
  const state = s(STATE_LABEL[node.cause.state]).toLowerCase()
  return node.root ? `${s('observation.rootCause').toLowerCase()} · ${state}` : state
}

/** How far a small mark reaches from its centre, for where a line meets it. */
function smallReach(node: PictureNode): number {
  if (node.kind === 'observation') return DOT[node.observation.impact]
  if (node.kind === 'solution') return 11
  return node.root ? 14 : 12
}

/** Where a line leaves a record (`right`) or arrives at one, in the picture's pixels. */
export function anchorOf(node: PictureNode, side: 'left' | 'right', size: PictureSize): { x: number; y: number } {
  const slot = PICTURE_SIZE[size]
  if (size === 'large') return { x: node.x + (side === 'right' ? slot.width : 0), y: node.y + slot.height / 2 }
  const reach = smallReach(node)
  return { x: node.x + slot.width / 2 + (side === 'right' ? reach : -reach), y: node.y + SMALL_CENTRE }
}

/** The outline a record is drawn with: its colour, its weight, and a dash while it is assumed. */
function outline(theme: Theme, node: PictureNode): { stroke: string; width: number; dash?: string } {
  const { palette } = theme
  if (node.kind === 'observation') return { stroke: palette.text.secondary, width: 1.2 }
  if (node.kind === 'solution') return { stroke: palette.primary.main, width: 1.4 }
  const dash = node.cause.state === 'assumed' ? '5 4' : undefined
  if (node.root) return { stroke: palette.secondary.main, width: 2.6, ...(dash ? { dash } : {}) }
  return { stroke: node.cause.state === 'verified' ? palette.success.main : palette.warning.main, width: 1.4, ...(dash ? { dash } : {}) }
}

function impactColour(theme: Theme, impact: ObservationImpact): string {
  return impact === 'critical' ? theme.palette.error.main : impact === 'major' ? theme.palette.warning.main : theme.palette.text.secondary
}

export type RecordMarkProps = {
  node: PictureNode
  size: PictureSize
  selected: boolean
  matched: boolean
  openEnd: boolean
  /** A short marker for a link that leaves the picture. */
  marker?: string
  /** The tint an observation's small mark is filled with (`seenTint`). */
  fill: string
  s: Translate
}

export function RecordMark(props: RecordMarkProps) {
  return props.size === 'large' ? <LargeMark {...props} /> : <SmallMark {...props} />
}

function OpenEnd({ x, y, r, s }: { x: number; y: number; r: number; s: Translate }) {
  const theme = useTheme()
  return (
    <g data-testid="picture-open-end">
      <title>{s('observation.pictureOpenEnd')}</title>
      <circle cx={x} cy={y} r={r} fill={theme.palette.background.paper} stroke={theme.palette.warning.main} strokeWidth={1.2} />
      <text x={x} y={y} dy="0.35em" textAnchor="middle" fontSize={10} fontWeight={700} fill={theme.palette.warning.main}>?</text>
    </g>
  )
}

function LargeMark({ node, selected, matched, openEnd, marker, s }: RecordMarkProps) {
  const theme = useTheme()
  const { width, height } = PICTURE_SIZE.large
  const line = outline(theme, node)
  const root = node.kind === 'cause' && node.root
  const fill = node.kind === 'solution' ? mix(theme.palette.primary.main, 0.12, theme.palette.background.paper) : theme.palette.background.paper
  const left = root ? 16 : 13
  // The state only: a root cause says it is one by its outline, and the hover says it in words.
  const state = node.kind === 'cause' ? s(STATE_LABEL[node.cause.state]).toLowerCase() : recordState(node, s)
  const meta = node.kind === 'observation' ? recordLabel(node) : `${recordLabel(node)} · ${state}`
  return (
    <>
      {(selected || matched) && (
        <rect x={-5} y={-5} width={width + 10} height={height + 10} rx={12} fill="none" stroke={theme.palette.primary.main} strokeWidth={selected ? 2.6 : 2} strokeDasharray={selected ? undefined : '3 3'} data-testid={selected ? undefined : 'picture-match'} />
      )}
      <rect width={width} height={height} rx={root ? 18 : 8} fill={fill} stroke={line.stroke} strokeWidth={line.width} strokeDasharray={line.dash} />
      {node.kind === 'observation' && (
        <>
          <rect x={0} y={0} width={5} height={height} rx={2} fill={impactColour(theme, node.observation.impact)} />
          <text x={width - 10} y={18} textAnchor="end" fontSize={10.5} fontWeight={700} fill={theme.palette.text.secondary}>
            {s('observation.seenTimes', { count: node.observation.seen })}
          </text>
        </>
      )}
      <text x={left} y={19} fontSize={10.5} fontFamily="ui-monospace, Menlo, monospace" fill={theme.palette.text.secondary}>{meta}</text>
      <text x={left} y={38} fontSize={12.5} fontWeight={500} fill={theme.palette.text.primary}>{shorten(recordTitle(node), 26)}</text>
      {marker && <text x={width - 10} y={19} textAnchor="end" fontSize={10} fontWeight={500} fill={theme.palette.info.main}>{marker}</text>}
      {openEnd && <OpenEnd x={width} y={height / 2} r={8} s={s} />}
    </>
  )
}

function SmallMark({ node, selected, matched, openEnd, marker, fill, s }: RecordMarkProps) {
  const theme = useTheme()
  const cx = PICTURE_SIZE.small.width / 2
  const cy = SMALL_CENTRE
  const line = outline(theme, node)
  const reach = smallReach(node)
  const paper = theme.palette.background.paper
  return (
    <>
      {(selected || matched) && (
        <circle cx={cx} cy={cy} r={reach + 6} fill="none" stroke={theme.palette.primary.main} strokeWidth={selected ? 2.6 : 2} strokeDasharray={selected ? undefined : '3 3'} data-testid={selected ? undefined : 'picture-match'} />
      )}
      {node.kind === 'observation' && (
        <>
          <circle cx={cx} cy={cy} r={reach} fill={fill} stroke={theme.palette.primary.main} strokeWidth={1.2} />
          {reach >= 13 && (
            <text x={cx} y={cy} dy="0.35em" textAnchor="middle" fontSize={10} fontWeight={700} fill={inkOn(theme, fill)}>
              {s('observation.seenTimes', { count: node.observation.seen })}
            </text>
          )}
        </>
      )}
      {node.kind === 'cause' && (
        <>
          <circle cx={cx} cy={cy} r={reach} fill={paper} stroke={line.stroke} strokeWidth={line.width} strokeDasharray={line.dash} />
          {node.root && <circle cx={cx} cy={cy} r={8.5} fill="none" stroke={line.stroke} strokeWidth={1.2} />}
        </>
      )}
      {node.kind === 'solution' && (
        <rect x={cx - 11} y={cy - 11} width={22} height={22} rx={5} fill={mix(theme.palette.primary.main, 0.12, paper)} stroke={line.stroke} strokeWidth={line.width} />
      )}
      {openEnd && <OpenEnd x={cx + 14} y={cy - 11} r={6.5} s={s} />}
      <text x={cx} y={cy + 32} textAnchor="middle" fontSize={10.5} fontFamily="ui-monospace, Menlo, monospace" fill={theme.palette.text.secondary}>{recordLabel(node)}</text>
      <text x={cx} y={cy + 47} textAnchor="middle" fontSize={11.5} fill={theme.palette.text.primary}>{shorten(recordTitle(node), 20)}</text>
      {marker && <text x={cx} y={cy - reach - 6} textAnchor="middle" fontSize={9.5} fill={theme.palette.info.main}>{marker}</text>}
    </>
  )
}
