// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The *Reporting lines* overlay over the organisation chart (ADR-0039 §7,
 * amended 17 October 2026): the lines of the person picked, and no others —
 * from their chip to the chip of whoever holds the role they report to, and
 * from the chips of the people who report to them to theirs. A line joins
 * the named chips themselves, never a box's edge: where nobody holds the
 * role at the far end, it ends at the role's name in its row, and where a
 * fold hides the far end, at the folded unit's name, which its tooltip says.
 * Solid or dotted (`2 3`, as the Conway map draws a line that is only said),
 * and in one of three colours (`reportingLineColours`): the accent for a line
 * the person reports along, teal for one reporting into them, and magenta for
 * an exception to the model whichever way it runs, its end dot saying where
 * it lands — and in the warning colour where nobody holds what it lands on and
 * the error colour where it is part of a loop, which win. `ChartLinesLegend`
 * says which is which. Where it runs is measured from the chips
 * as they ended up, after every layout and again when the stage changes size,
 * and never stored.
 */
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { reportingLineColours } from '../theme'
import type { ChartLine, ChartLineEnd } from './chartLines'

/** A measured rectangle, relative to the stage. */
export type Rect = { left: number; top: number; right: number; bottom: number }

type Anchor = { element: HTMLElement; folded?: string }
type Drawn = {
  key: string; d: string; kind: ChartLine['kind']; tone: ChartLine['tone']; direction: ChartLine['direction']; override: boolean; x: number; y: number
  /** The unit a fold hides the far end in, said in the tooltip. */
  folded?: string
}

/** The rows and the name row of a box: its own, not those of the units drawn inside it. */
const childrenOf = (box: HTMLElement) => [...box.children] as HTMLElement[]

/**
 * The chips an end of a line is drawn at: the chips of the holders it names,
 * in the role's row or among the people a unit holds outside its slots; the
 * chips of whoever holds the role in the unit where it names none; else the
 * role's name in its row; and where a fold hides the unit, the folded unit's
 * name.
 */
function anchorsOf(boxes: ReadonlyMap<string, HTMLElement>, end: ChartLineEnd): Anchor[] {
  const box = boxes.get(end.unitId)
  if (!box) return []
  const head = () => {
    const name = childrenOf(box)[0]?.querySelector<HTMLElement>('[data-testid="chart-unit-open"]') ?? childrenOf(box)[0]
    return name ? [{ element: name, folded: box.dataset.unitName ?? end.unitId }] : []
  }
  if (end.roleId === undefined) return head()
  const named = end.holders
  const row = childrenOf(box).find((child) => child.dataset.testid === `chart-slot-${end.roleId}`)
  if (!row) {
    // A role held outside the unit's slots has no row: its holders' chips are among the others.
    const others = childrenOf(box).find((child) => child.dataset.testid === 'chart-others')
    const chips = others ? childrenOf(others).filter((chip) => named?.includes(chip.dataset.assignmentId ?? '') ?? chip.dataset.roleId === end.roleId) : []
    return chips.map((element) => ({ element }))
  }
  const holders = childrenOf(row).filter((child) => child.dataset.testid === 'chart-holder')
  const shown = named === undefined ? holders : holders.filter((chip) => named.includes(chip.dataset.assignmentId ?? ''))
  if (shown.length > 0) return shown.map((element) => ({ element }))
  const name = row.querySelector<HTMLElement>('[data-testid="chart-role-name"]')
  return name ? [{ element: name }] : []
}

/**
 * A line between two chips, from the edge of the one to the edge of the
 * other. Within one box: a hook out of the left of the two chips, from the
 * one to the other. Beside each other: across, from the near edges. Above
 * each other: out of the right edges and back.
 */
export function chipLinePath(a: Rect, b: Rect, within: boolean): { d: string; x1: number; y1: number; x2: number; y2: number } {
  const y1 = (a.top + a.bottom) / 2
  const y2 = (b.top + b.bottom) / 2
  if (within) {
    const bend = Math.min(a.left, b.left) - 14
    return { d: `M${a.left},${y1} C${bend},${y1} ${bend},${y2} ${b.left},${y2}`, x1: a.left, y1, x2: b.left, y2 }
  }
  const apart = b.left >= a.right || a.left >= b.right
  const forward = b.left >= a.left
  const x1 = apart ? (forward ? a.right : a.left) : a.right
  const x2 = apart ? (forward ? b.left : b.right) : b.right
  const bend = apart ? (x1 + x2) / 2 : Math.max(x1, x2) + 36
  return { d: `M${x1},${y1} C${bend},${y1} ${bend},${y2} ${x2},${y2}`, x1, y1, x2, y2 }
}

/** Where each line runs, measured from the chips on the stage. */
function useMeasured(stage: { current: HTMLDivElement | null }, lines: readonly ChartLine[], redraw: unknown): Drawn[] {
  const [drawn, setDrawn] = useState<Drawn[]>([])
  const measure = useCallback(() => {
    const root = stage.current
    if (!root || lines.length === 0) { setDrawn([]); return }
    const origin = root.getBoundingClientRect()
    const rectOf = (element: HTMLElement): Rect | undefined => {
      const box = element.getBoundingClientRect()
      if (box.width === 0 && box.height === 0) return undefined
      return { left: box.left - origin.left, top: box.top - origin.top, right: box.right - origin.left, bottom: box.bottom - origin.top }
    }
    const boxes = new Map([...root.querySelectorAll<HTMLElement>('[data-testid="chart-unit"]')].map((one) => [one.dataset.elementId ?? '', one]))
    const next: Drawn[] = []
    for (const line of lines) {
      const froms = anchorsOf(boxes, line.from)
      const tos = anchorsOf(boxes, line.to)
      for (const from of froms) {
        for (const to of tos) {
          if (from.element === to.element) continue
          const a = rectOf(from.element)
          const b = rectOf(to.element)
          if (!a || !b) continue
          const path = chipLinePath(a, b, line.within === true)
          const folded = to.folded ?? from.folded
          next.push({
            key: `${line.key}:${next.length}`, d: path.d, kind: line.kind, tone: line.tone, direction: line.direction, override: line.override,
            x: path.x2, y: path.y2,
            ...(folded !== undefined ? { folded } : {}),
          })
        }
      }
    }
    setDrawn(next)
  }, [stage, lines])
  useLayoutEffect(() => { measure() }, [measure, redraw])
  // Drawn with the page: a child's layout effect runs before the stage's ref is attached, so the first measure is taken again after it.
  useEffect(() => { measure() }, [measure])
  useEffect(() => {
    const root = stage.current
    if (!root || typeof ResizeObserver === 'undefined') return undefined
    const watch = new ResizeObserver(() => measure())
    watch.observe(root)
    for (const box of root.querySelectorAll('[data-testid="chart-unit"]')) watch.observe(box)
    return () => watch.disconnect()
  }, [stage, measure, redraw])
  return drawn
}

/** The lines of the person picked, over the stage they were measured on. `redraw` changes whenever the boxes may have moved. */
export function ChartLinesOverlay({ stage, lines, redraw }: {
  stage: { current: HTMLDivElement | null }; lines: readonly ChartLine[]; redraw: unknown
}) {
  const theme = useTheme()
  const { t } = useStrings()
  const drawn = useMeasured(stage, lines, redraw)
  const colours = reportingLineColours(theme)
  const stroke = (line: Pick<Drawn, 'tone' | 'override' | 'direction'>) => {
    if (line.tone === 'loop') return theme.palette.error.main
    if (line.tone === 'vacant') return theme.palette.warning.main
    return line.override ? colours.override : line.direction === 'up' ? colours.reportsTo : colours.reportedBy
  }
  return (
    <Box component="svg" aria-hidden data-testid="chart-lines" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
      {drawn.map((line) => (
        <g
          key={line.key} data-testid={`chart-line-${line.kind}`} data-tone={line.tone} data-direction={line.direction}
          data-override={line.override ? 'true' : undefined} data-folded={line.folded !== undefined ? 'true' : undefined}
        >
          {line.folded !== undefined && <title>{t('chart.lineFolded', { unit: line.folded })}</title>}
          <path d={line.d} fill="none" stroke={stroke(line)} strokeWidth={2} strokeDasharray={line.kind === 'dotted' ? '2 3' : undefined}
            style={line.folded !== undefined ? { pointerEvents: 'visibleStroke' } : undefined} />
          <circle cx={line.x} cy={line.y} r={3.5} fill={stroke(line)} />
        </g>
      ))}
    </Box>
  )
}

/** One swatch of the legend: a short stretch of line in its colour, solid or dotted. */
function Swatch({ colour, dotted }: { colour: string; dotted?: boolean }) {
  return (
    <Box component="svg" aria-hidden width={22} height={8} sx={{ flex: 'none' }}>
      <line x1={1} y1={4} x2={21} y2={4} stroke={colour} strokeWidth={2} strokeDasharray={dotted ? '2 3' : undefined} />
    </Box>
  )
}

/**
 * What the chart's lines mean, said beside them while any are drawn: the
 * three colours, and that a dotted line is a functional one. The vacant and
 * loop tones are said where they are drawn, on the line's own finding.
 */
export function ChartLinesLegend({ t }: { t: Translate }) {
  const theme = useTheme()
  const colours = reportingLineColours(theme)
  const items: { key: string; colour: string; dotted?: boolean; text: string }[] = [
    { key: 'up', colour: colours.reportsTo, text: t('chart.legendReportsTo') },
    { key: 'into', colour: colours.reportedBy, text: t('chart.legendReportedBy') },
    { key: 'override', colour: colours.override, text: t('chart.legendOverride') },
    { key: 'dotted', colour: theme.palette.text.secondary, dotted: true, text: t('chart.legendDotted') },
  ]
  return (
    <Box
      component="ul" data-testid="chart-lines-legend" aria-label={t('chart.legend')}
      sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, listStyle: 'none', m: 0, mb: 1, p: 0 }}
    >
      {items.map((item) => (
        <Box component="li" key={item.key} data-testid={`chart-legend-${item.key}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Swatch colour={item.colour} dotted={item.dotted} />
          <Typography component="span" sx={{ fontSize: 11.5, color: 'text.secondary' }}>{item.text}</Typography>
        </Box>
      ))}
    </Box>
  )
}
