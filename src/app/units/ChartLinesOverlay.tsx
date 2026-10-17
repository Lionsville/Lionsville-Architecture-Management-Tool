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
 * in the warning colour where nobody holds the role it lands on and the error
 * colour where it is part of a loop. Where it runs is measured from the chips
 * as they ended up, after every layout and again when the stage changes size,
 * and never stored.
 */
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import { useStrings } from '../../i18n'
import type { ChartLine, ChartLineEnd, ChartPosition } from './chartLines'

/** A measured rectangle, relative to the stage. */
export type Rect = { left: number; top: number; right: number; bottom: number }

type Anchor = { element: HTMLElement; folded?: string }
type Drawn = {
  key: string; d: string; kind: ChartLine['kind']; tone: ChartLine['tone']; x: number; y: number
  /** The unit a fold hides the far end in, said in the tooltip. */
  folded?: string
}

/** The rows and the name row of a box: its own, not those of the units drawn inside it. */
const childrenOf = (box: HTMLElement) => [...box.children] as HTMLElement[]

/**
 * The chips an end of a line is drawn at: the chip of the person picked where
 * the end is theirs; else the chips of whoever holds the role in the unit;
 * else the role's name in its row; and where a fold hides the unit, the
 * folded unit's name.
 */
function anchorsOf(boxes: ReadonlyMap<string, HTMLElement>, end: ChartLineEnd, chosen: string | undefined, isChosen: boolean): Anchor[] {
  const box = boxes.get(end.unitId)
  if (!box) return []
  const head = () => {
    const name = childrenOf(box)[0]?.querySelector<HTMLElement>('[data-testid="chart-unit-open"]') ?? childrenOf(box)[0]
    return name ? [{ element: name, folded: box.dataset.unitName ?? end.unitId }] : []
  }
  if (end.roleId === undefined) return head()
  const row = childrenOf(box).find((child) => child.dataset.testid === `chart-slot-${end.roleId}`)
  if (!row) return []
  const holders = childrenOf(row).filter((child) => child.dataset.testid === 'chart-holder')
  const mine = isChosen ? holders.filter((chip) => chip.dataset.assignmentId === chosen) : []
  if (mine.length > 0) return mine.map((element) => ({ element }))
  if (holders.length > 0) return holders.map((element) => ({ element }))
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

const samePlace = (one: ChartPosition, other: ChartPosition | undefined) => other !== undefined && one.unitId === other.unitId && one.roleId === other.roleId

/** Where each line runs, measured from the chips on the stage. */
function useMeasured(stage: { current: HTMLDivElement | null }, lines: readonly ChartLine[], chosen: Chosen | undefined, redraw: unknown): Drawn[] {
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
      const froms = anchorsOf(boxes, line.from, chosen?.id, samePlace(line.at, chosen?.place))
      const tos = anchorsOf(boxes, line.to, chosen?.id, samePlace(line.lands, chosen?.place))
      for (const from of froms) {
        for (const to of tos) {
          if (from.element === to.element) continue
          const a = rectOf(from.element)
          const b = rectOf(to.element)
          if (!a || !b) continue
          const path = chipLinePath(a, b, line.within === true)
          const folded = to.folded ?? from.folded
          next.push({
            key: `${line.key}:${next.length}`, d: path.d, kind: line.kind, tone: line.tone, x: path.x2, y: path.y2,
            ...(folded !== undefined ? { folded } : {}),
          })
        }
      }
    }
    setDrawn(next)
  }, [stage, lines, chosen])
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

/** The person picked: their assignment, and the role in a unit it is. */
type Chosen = { id: string; place: ChartPosition }

/** The lines of the person picked, over the stage they were measured on. `redraw` changes whenever the boxes may have moved. */
export function ChartLinesOverlay({ stage, lines, redraw, chosen }: {
  stage: { current: HTMLDivElement | null }; lines: readonly ChartLine[]; redraw: unknown; chosen: Chosen | undefined
}) {
  const theme = useTheme()
  const { t } = useStrings()
  const drawn = useMeasured(stage, lines, chosen, redraw)
  const stroke = (tone: Drawn['tone']) => (tone === 'loop' ? theme.palette.error.main : tone === 'vacant' ? theme.palette.warning.main : theme.palette.primary.main)
  return (
    <Box component="svg" aria-hidden data-testid="chart-lines" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
      {drawn.map((line) => (
        <g key={line.key} data-testid={`chart-line-${line.kind}`} data-tone={line.tone} data-folded={line.folded !== undefined ? 'true' : undefined}>
          {line.folded !== undefined && <title>{t('chart.lineFolded', { unit: line.folded })}</title>}
          <path d={line.d} fill="none" stroke={stroke(line.tone)} strokeWidth={2} strokeDasharray={line.kind === 'dotted' ? '2 3' : undefined}
            style={line.folded !== undefined ? { pointerEvents: 'visibleStroke' } : undefined} />
          <circle cx={line.x} cy={line.y} r={3.5} fill={stroke(line.tone)} />
        </g>
      ))}
    </Box>
  )
}
