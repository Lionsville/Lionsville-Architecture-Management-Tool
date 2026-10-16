// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The *Reporting lines* overlay over the organisation chart (ADR-0039 §7):
 * each line drawn from the row of its role to the row it lands on, solid or
 * dotted (`2 3`, as the Conway map draws a line that is only said), in the
 * warning colour where nobody holds the role it lands on and the error colour
 * where it is part of a loop. Where it runs is measured from the boxes as
 * they ended up, after every layout and again when the stage changes size —
 * the Conway map's way (`ConwayPage.useMeasuredLines`) — and never stored.
 */
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import type { ChartLine, ChartLineEnd } from './chartLines'

type Drawn = { key: string; d: string; kind: ChartLine['kind']; tone: ChartLine['tone']; x: number; y: number }

/** Where an end is on the page: the row of its role in its box, else the box's name row. */
function anchorOf(boxes: ReadonlyMap<string, HTMLElement>, end: ChartLineEnd): HTMLElement | undefined {
  const box = boxes.get(end.unitId)
  if (!box) return undefined
  const children = [...box.children] as HTMLElement[]
  const row = end.roleId === undefined ? undefined : children.find((child) => child.dataset.testid === `chart-slot-${end.roleId}`)
  return row ?? children[0] ?? box
}

/** Where each line runs, measured from the boxes on the stage. */
function useMeasured(stage: { current: HTMLDivElement | null }, lines: readonly ChartLine[], redraw: unknown): Drawn[] {
  const [drawn, setDrawn] = useState<Drawn[]>([])
  const measure = useCallback(() => {
    const root = stage.current
    if (!root || lines.length === 0) { setDrawn([]); return }
    const box = root.getBoundingClientRect()
    const boxes = new Map([...root.querySelectorAll<HTMLElement>('[data-testid="chart-unit"]')].map((one) => [one.dataset.elementId ?? '', one]))
    const next: Drawn[] = []
    for (const line of lines) {
      const a = anchorOf(boxes, line.from)?.getBoundingClientRect()
      const b = anchorOf(boxes, line.to)?.getBoundingClientRect()
      if (!a || !b || (a.width === 0 && b.width === 0)) continue
      const apart = b.left >= a.right || a.left >= b.right
      const forward = b.left >= a.left
      // Beside each other: across, from the near edges. Above each other: out of the right edges and back.
      const x1 = (apart ? (forward ? a.right : a.left) : a.right) - box.left
      const x2 = (apart ? (forward ? b.left : b.right) : b.right) - box.left
      const y1 = a.top + a.height / 2 - box.top
      const y2 = b.top + b.height / 2 - box.top
      const bend = apart ? (x1 + x2) / 2 : Math.max(x1, x2) + 36
      next.push({ key: line.key, d: `M${x1},${y1} C${bend},${y1} ${bend},${y2} ${x2},${y2}`, kind: line.kind, tone: line.tone, x: x2, y: y2 })
    }
    setDrawn(next)
  }, [stage, lines])
  useLayoutEffect(() => { measure() }, [measure, redraw])
  useEffect(() => {
    const root = stage.current
    if (!root || typeof ResizeObserver === 'undefined') return undefined
    const watch = new ResizeObserver(() => measure())
    watch.observe(root)
    return () => watch.disconnect()
  }, [stage, measure])
  return drawn
}

/** The lines, over the stage they were measured on. `redraw` changes whenever the boxes may have moved. */
export function ChartLinesOverlay({ stage, lines, redraw }: { stage: { current: HTMLDivElement | null }; lines: readonly ChartLine[]; redraw: unknown }) {
  const theme = useTheme()
  const drawn = useMeasured(stage, lines, redraw)
  const stroke = (tone: Drawn['tone']) => (tone === 'loop' ? theme.palette.error.main : tone === 'vacant' ? theme.palette.warning.main : theme.palette.primary.main)
  return (
    <Box component="svg" aria-hidden data-testid="chart-lines" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
      {drawn.map((line) => (
        <g key={line.key} data-testid={`chart-line-${line.kind}`} data-tone={line.tone}>
          <path d={line.d} fill="none" stroke={stroke(line.tone)} strokeWidth={1.5} strokeDasharray={line.kind === 'dotted' ? '2 3' : undefined} />
          <circle cx={line.x} cy={line.y} r={3} fill={stroke(line.tone)} />
        </g>
      ))}
    </Box>
  )
}
