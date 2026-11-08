// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One record on the analysis picture, in either of its two sizes (ADR-0032 §8).
 *
 * **Large** is a card for every kind, with its label and three lines of its
 * title: an observation with its impact as a stripe down the left and its count, a
 * cause dashed while assumed and solid once verified, a root cause with the
 * heavier, rounder outline, a solution filled. **Small** is a circle for every
 * kind with the label and a short title under it: an observation filled and
 * sized by its impact, a cause hollow, a root cause with a double ring, a
 * solution a square. Dashed means assumed in both. A bright spot (ADR-0038
 * §6) is outlined and tinted in the success colour in both.
 *
 * Both keep the `?` on a cause that is not a root and that nothing explains —
 * an open end — and a marker where a link leaves the picture: a cause above
 * explaining this one, or causes below that this one explains and that are
 * not drawn.
 *
 * Drawn at the origin of the record's slot; the picture places it.
 */
import { useTheme } from '@mui/material/styles'
import { toneColor } from './ToneBar'
import { toneOf } from '../observation'
import type { Theme } from '@mui/material/styles'
import { useStrings } from '../../i18n'
import type { Language, Translate } from '../../i18n'
import { inSentence } from '../../i18n/languages'
import { inkOn, mix } from '../../widgets'
import { SCALE } from '../../widgets/kit/tokens'
import { PICTURE_SIZE } from '../graph'
import type { PictureNode, PictureSize } from '../graph'
import { causeLabel, formatObservationNumber } from '../observation'
import type { ObservationImpact } from '../observation'
import { PHASE_LABEL, STATE_LABEL } from '../observationScope'
import { formatSolutionNumber } from '../solution'
import { CardFace, shorten } from './ChainMarks'

/** A small mark's radius per impact: the size of an observation is how much it hurts. */
export const DOT: Record<ObservationImpact, number> = { minor: 10, major: 13, critical: 16 }
/** Where a small mark's centre stands in its slot. */
export const SMALL_CENTRE = 20

export function recordLabel(node: PictureNode): string {
  if (node.kind === 'observation') return formatObservationNumber(node.observation.number)
  if (node.kind === 'cause') return causeLabel(node.cause)
  return node.kind === 'solution' ? formatSolutionNumber(node.solution.number) : ''
}

export function recordTitle(node: PictureNode): string {
  if (node.kind === 'more') return ''
  return node.kind === 'observation' ? node.observation.title : node.kind === 'cause' ? node.cause.title : node.solution.title
}

/** What kind of record it is and where it stands, in the words the reader uses. */
export function recordState(node: PictureNode, s: Translate, language: Language): string {
  if (node.kind === 'more') return ''
  if (node.kind === 'observation') return s('observation.seenTimes', { count: node.observation.seen })
  if (node.kind === 'solution') return inSentence(s(PHASE_LABEL[node.solution.state]), language)
  const state = inSentence(s(STATE_LABEL[node.cause.state]), language)
  return node.root ? `${inSentence(s('observation.rootCause'), language)} · ${state}` : state
}

/** How far a small mark reaches from its centre, for where a line meets it. */
function smallReach(node: PictureNode): number {
  if (node.kind === 'observation') return DOT[node.observation.impact]
  if (node.kind === 'solution') return 11
  if (node.kind === 'more') return 12
  return node.root ? 14 : 12
}

/** Where a line leaves a record (`right`) or arrives at one, in the picture's pixels. */
export function anchorOf(node: PictureNode, side: 'left' | 'right', size: PictureSize): { x: number; y: number } {
  const slot = PICTURE_SIZE[size]
  if (size !== 'small') return { x: node.x + (side === 'right' ? slot.width : 0), y: node.y + slot.height / 2 }
  const reach = smallReach(node)
  return { x: node.x + slot.width / 2 + (side === 'right' ? reach : -reach), y: node.y + SMALL_CENTRE }
}

/** The outline a record is drawn with: its colour, its weight, and a dash while it is assumed. */
function outline(theme: Theme, node: PictureNode): { stroke: string; width: number; dash?: string } {
  const { palette } = theme
  if (node.kind === 'more') return { stroke: palette.text.secondary, width: 1, dash: '3 3' }
  if (node.kind === 'observation') return toneOf(node.observation) === 'neutral' ? { stroke: palette.text.secondary, width: 1.2 } : { stroke: toneColor(theme, toneOf(node.observation)), width: 1.8 }
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
  /** The map's zoom: a card far out holds its text's size on screen through it. */
  zoom?: number
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
  if (props.node.kind === 'more') return <MoreMark {...props} />
  return props.size === 'large' ? <LargeMark {...props} /> : props.size === 'far' ? <FarMark {...props} /> : <SmallMark {...props} />
}

/** How many characters a card's line holds: its width less the margins, over what a character takes at the card's type. */
const LARGE_LINE = 30

/** Records not drawn, said as a card: pressing it opens them where they are, or lists them. */
function MoreMark({ node, size, s }: RecordMarkProps) {
  const theme = useTheme()
  if (node.kind !== 'more') return null
  const slot = PICTURE_SIZE[size]
  const fold = node.more === 'fold'
  return (
    <>
      <rect width={slot.width} height={slot.height} rx={6} fill={theme.palette.background.paper} stroke={theme.palette.text.secondary} strokeWidth={1} strokeDasharray="3 3" />
      <text x={12} y={size === 'far' ? slot.height / 2 + 4 : 24} fontSize={size === 'far' ? 14 : 12.5} fontWeight={600} fill={theme.palette.text.primary}>
        {fold ? s('observation.mapMore', { count: node.count }) : s('observation.mapPile', { count: node.count })}
      </text>
      {size !== 'far' && (
        <text x={12} y={42} fontSize={11.5} fill={theme.palette.text.secondary}>
          {fold ? s('observation.mapMoreHint') : s('observation.mapPileHint')}
        </text>
      )}
    </>
  )
}

/** A card far out: one line, the text the size it is at 100% however far out the map is, so it is still read. */
function FarMark({ node, selected, matched, openEnd, zoom = 1, s }: RecordMarkProps) {
  const theme = useTheme()
  const { width, height } = PICTURE_SIZE.far
  const line = outline(theme, node)
  const root = node.kind === 'cause' && node.root
  const fill = node.kind === 'solution' ? mix(theme.palette.primary.main, 0.12, theme.palette.background.paper) : theme.palette.background.paper
  const size = 12.5 / zoom
  return (
    <>
      {(selected || matched) && (
        <rect x={-4} y={-4} width={width + 8} height={height + 8} rx={10} fill="none" stroke={theme.palette.primary.main} strokeWidth={selected ? 2.6 : 2} strokeDasharray={selected ? undefined : '3 3'} data-testid={selected ? undefined : 'picture-match'} />
      )}
      <rect width={width} height={height} rx={root ? 16 : 6} fill={fill} stroke={line.stroke} strokeWidth={root ? line.width * 1.6 : line.width} strokeDasharray={line.dash} />
      <text x={12} y={height / 2 + size / 3} fontSize={size} fill={theme.palette.text.primary}>{shorten(recordTitle(node), Math.floor((width - 24) / (size * 0.5)))}</text>
      {openEnd && <OpenEnd x={width} y={height / 2} r={9} s={s} />}
    </>
  )
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
  const { language } = useStrings()
  const { width, height } = PICTURE_SIZE.large
  const line = outline(theme, node)
  const root = node.kind === 'cause' && node.root
  const fill = node.kind === 'solution' ? mix(theme.palette.primary.main, 0.12, theme.palette.background.paper) : theme.palette.background.paper
  const left = root ? 16 : 13
  // The state only: a root cause says it is one by its outline, and the hover says it in words.
  const state = node.kind === 'cause' ? inSentence(s(STATE_LABEL[node.cause.state]), language) : recordState(node, s, language)
  const meta = `${recordLabel(node)} · ${state}`
  return (
    <>
      {(selected || matched) && (
        <rect x={-5} y={-5} width={width + 10} height={height + 10} rx={12} fill="none" stroke={theme.palette.primary.main} strokeWidth={selected ? 2.6 : 2} strokeDasharray={selected ? undefined : '3 3'} data-testid={selected ? undefined : 'picture-match'} />
      )}
      {/* A link that leaves the picture takes a title line of its own: on the label's line the two overprinted. */}
      <CardFace
        width={width} height={height} rx={root ? 18 : 6} fill={fill} stroke={line.stroke} strokeWidth={line.width} {...(line.dash ? { dash: line.dash } : {})}
        {...(node.kind === 'observation' ? { stripe: impactColour(theme, node.observation.impact) } : {})}
        meta={meta} title={recordTitle(node)} lines={marker ? 2 : 3} left={left}
      >
        {marker && <text x={left} y={height - 9} fill={theme.palette.info.main} data-testid="picture-marker" style={{ fontSize: 'var(--canvas-t-xs)' }}>{shorten(marker, LARGE_LINE + 2)}</text>}
      </CardFace>
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
          <circle cx={cx} cy={cy} r={reach} fill={fill} stroke={toneColor(theme, toneOf(node.observation))} strokeWidth={1.2} />
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
      <text x={cx} y={cy + 32} textAnchor="middle" fontSize={10.5} fontFamily={SCALE['font-mono']} fill={theme.palette.text.secondary}>{recordLabel(node)}</text>
      <text x={cx} y={cy + 47} textAnchor="middle" fontSize={11.5} fill={theme.palette.text.primary}>{shorten(recordTitle(node), 20)}</text>
      {marker && <text x={cx} y={cy - reach - 6} textAnchor="middle" fontSize={9.5} fill={theme.palette.info.main}>{marker}</text>}
    </>
  )
}
