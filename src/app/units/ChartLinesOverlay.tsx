// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The lines over the organisation chart, measured from what the tree laid out
 * and never stored: the connectors that show where a unit sits, always there,
 * and the reporting lines the Lines menu asks for (ADR-0039 §7).
 *
 * **A reporting line joins people**: a holder's name to the name of whoever
 * holds the role at the far end; a role's line where nobody holds it from its
 * row, and a box where the row is not drawn at this level of the People menu or
 * a fold hides it. It runs at right angles along the tree's own gaps
 * (`chartGeometry`) and always ends in an arrowhead, because direction read from
 * a hue is lost to a colour-blind reader and in a greyscale print.
 *
 * **What a line means is said three ways**: the head for which way, solid or
 * dotted for the kind, and a tag in words on anything that is not the plain case:
 * an exception, a role nobody holds, a loop, an end folded away. The legend sits
 * in a corner of its own, so a line appearing moves nothing.
 */
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import type { Translate } from '../../i18n'
import type { ChartShape } from '../../model/orgChart'
import { KeyStrip } from '../../widgets/kit/KeyStrip'
import { arrowAt, Line, LineLabel } from '../../widgets/kit/Line'
import { connectorsOf, middleOf, pathOf, routeBetween } from './chartGeometry'
import type { Point, Rect } from './chartGeometry'
import type { ChartLine, ChartLineEnd } from './chartLines'

export type { Rect }

type Stage = { current: HTMLDivElement | null }
type Anchor = { element: HTMLElement; folded?: string }
type Drawn = {
  key: string; points: readonly Point[]; line: ChartLine
  /** The unit a fold hides the far end in. */
  folded?: string
}

/** A box's measures, relative to the stage and in the stage's own units: it may be zoomed. */
function measurer(root: HTMLElement, zoom: number) {
  const origin = root.getBoundingClientRect()
  return (element: Element): Rect | undefined => {
    const box = element.getBoundingClientRect()
    if (box.width === 0 && box.height === 0) return undefined
    return {
      left: (box.left - origin.left) / zoom, top: (box.top - origin.top) / zoom,
      right: (box.right - origin.left) / zoom, bottom: (box.bottom - origin.top) / zoom,
    }
  }
}

/** Whatever may have moved a box: its size, and whatever `redraw` says changed. */
function useRemeasure(stage: Stage, measure: () => void, redraw: unknown) {
  useLayoutEffect(() => { measure() }, [measure, redraw])
  // Drawn with the page: a child's layout effect runs before the stage's ref is attached, so the first measure is taken again after it.
  useEffect(() => { measure() }, [measure])
  useEffect(() => {
    const root = stage.current
    if (!root || typeof ResizeObserver === 'undefined') return undefined
    const watch = new ResizeObserver(() => measure())
    watch.observe(root)
    return () => watch.disconnect()
  }, [stage, measure, redraw])
}

/** The connectors: every box to the boxes under it, in the shape they are laid out. */
export function ChartConnectors({ stage, zoom, redraw }: { stage: Stage; zoom: number; redraw: unknown }) {
  const [paths, setPaths] = useState<readonly string[]>([])
  const measure = useCallback(() => {
    const root = stage.current
    if (!root) return
    const rectOf = measurer(root, zoom)
    const next: string[] = []
    for (const under of root.querySelectorAll<HTMLElement>('[data-tree-under]')) {
      const owner = root.querySelector(`[data-tree-box="${escaped(under.dataset.treeUnder ?? '')}"]`)
      const parent = owner ? rectOf(owner) : undefined
      if (!parent) continue
      const children = [...under.children].flatMap((branch) => {
        const box = branch.querySelector(':scope > [data-tree-box]')
        const rect = box ? rectOf(box) : undefined
        return rect ? [rect] : []
      })
      next.push(...connectorsOf(parent, children, (under.dataset.shape ?? 'across') as ChartShape))
    }
    setPaths((was) => (same(was, next) ? was : next))
  }, [stage, zoom])
  useRemeasure(stage, measure, redraw)
  return (
    <svg className="org-connectors" aria-hidden="true" data-testid="chart-connectors">
      {paths.map((d, at) => <Line key={at} d={d} ink="quiet" />)}
    </svg>
  )
}

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((one, at) => one === b[at])

/** An id as a quoted attribute value in a selector: an id is whatever a person or a file said. */
const escaped = (id: string) => id.replace(/["\\]/g, '\\$&')

/**
 * What an end of a line is drawn at: the holders it names where they are drawn;
 * whoever holds the role in the unit where it names none; the role's row; and
 * the box itself where neither is drawn, a fold included.
 */
function anchorsOf(boxes: ReadonlyMap<string, HTMLElement>, end: ChartLineEnd): Anchor[] {
  const box = boxes.get(end.unitId)
  if (!box) return []
  const whole = (folded: boolean): Anchor[] => [{ element: box, ...(folded ? { folded: box.dataset.unitName ?? end.unitId } : {}) }]
  if (end.roleId === undefined) return whole(true)
  const chips = [...box.querySelectorAll<HTMLElement>('[data-testid="chart-holder"]')]
  const named = end.holders
  const held = named === undefined
    ? chips.filter((chip) => chip.dataset.roleId === end.roleId)
    : chips.filter((chip) => named.includes(chip.dataset.assignmentId ?? ''))
  if (held.length > 0) return held.map((element) => ({ element }))
  const row = box.querySelector<HTMLElement>(`[data-testid="chart-slot-${escaped(end.roleId)}"]`)
  return row ? [{ element: row }] : whole(false)
}

/** Where each line runs, measured from the names on the stage. */
function useMeasured(stage: Stage, lines: readonly ChartLine[], zoom: number, redraw: unknown): Drawn[] {
  const [drawn, setDrawn] = useState<Drawn[]>([])
  const measure = useCallback(() => {
    const root = stage.current
    if (!root || lines.length === 0) { setDrawn([]); return }
    const rectOf = measurer(root, zoom)
    const boxes = new Map([...root.querySelectorAll<HTMLElement>('[data-testid="chart-unit"]')].map((one) => [one.dataset.elementId ?? '', one]))
    const next: Drawn[] = []
    for (const line of lines) {
      for (const from of anchorsOf(boxes, line.from)) {
        for (const to of anchorsOf(boxes, line.to)) {
          if (from.element === to.element) continue
          const a = rectOf(from.element)
          const b = rectOf(to.element)
          if (!a || !b) continue
          const folded = to.folded ?? from.folded
          next.push({ key: `${line.key}:${next.length}`, points: routeBetween(a, b, line.within === true), line, ...(folded !== undefined ? { folded } : {}) })
        }
      }
    }
    setDrawn(next)
  }, [stage, lines, zoom])
  useRemeasure(stage, measure, redraw)
  return drawn
}

/** The words on a line that is not the plain case. */
function tagOf(line: ChartLine, folded: string | undefined, unitName: (id: string) => string, t: Translate): { words: string; exception?: string } | undefined {
  if (line.tone === 'loop') return { words: t('chart.lineLoop') }
  if (line.tone === 'vacant') return { words: t('chart.lineVacant') }
  if (folded !== undefined) return { words: t('chart.lineFoldedShort', { unit: folded }) }
  if (line.source === 'person') return { words: t('chart.lineOwnPerson') }
  if (line.override) return { words: t('chart.lineOwnUnit', { unit: unitName(line.at.unitId) }) }
  return undefined
}

/** The lines asked for, over the stage they were measured on. `redraw` changes whenever the boxes may have moved. */
export function ChartLinesOverlay({ stage, lines, zoom, redraw, unitName, t }: {
  stage: Stage; lines: readonly ChartLine[]; zoom: number; redraw: unknown; unitName: (id: string) => string; t: Translate
}) {
  const drawn = useMeasured(stage, lines, zoom, redraw)
  const tags = drawn.flatMap((one) => {
    const tag = tagOf(one.line, one.folded, unitName, t)
    return tag ? [{ key: one.key, tag, at: middleOf(one.points) }] : []
  })
  return (
    <>
      <svg className="org-lines" aria-hidden="true" data-testid="chart-lines">
        {drawn.map((one) => {
          const [before, end] = one.points.slice(-2) as [Point, Point]
          return (
            <Line
              key={one.key} d={pathOf(one.points)} className="org-line" ink={one.line.override ? 'exception' : one.line.direction === 'up' ? 'signal' : 'ink'}
              pattern={one.line.kind === 'dotted' ? 'functional' : 'solid'} arrow={arrowAt(before, end)}
              data-testid={`chart-line-${one.line.kind}`} data-tone={one.line.tone} data-direction={one.line.direction}
              data-override={one.line.override ? 'true' : undefined} data-folded={one.folded !== undefined ? 'true' : undefined}
              {...(one.folded !== undefined ? { title: t('chart.lineFolded', { unit: one.folded }) } : {})}
            />
          )
        })}
      </svg>
      {tags.map(({ key, tag, at }) => (
        <div key={key} className="org-line__tag" style={{ left: at.x, top: at.y }} data-testid="chart-line-tag">
          <LineLabel words={tag.words} />
        </div>
      ))}
    </>
  )
}

/** A stretch of line in the legend, drawn by the same component as the real one. */
function Sample({ line, arrow = true }: { line: Pick<ChartLine, 'direction' | 'override' | 'kind'> | undefined; arrow?: boolean }) {
  const end = { x: 28, y: 5 }
  return (
    <svg className="chart-legend__sample" width={30} height={10} aria-hidden="true">
      <Line
        d="M1,5 L28,5" className={line ? 'org-line' : undefined} ink={line ? (line.override ? 'exception' : line.direction === 'up' ? 'signal' : 'ink') : 'quiet'}
        pattern={line?.kind === 'dotted' ? 'functional' : 'solid'} {...(arrow ? { arrow: arrowAt({ x: 1, y: 5 }, end) } : {})}
        {...(line ? { 'data-direction': line.direction, 'data-override': line.override ? 'true' : undefined } : {})}
      />
    </svg>
  )
}

/** What the lines mean: always there, in its own corner. */
export function ChartLinesLegend({ t }: { t: Translate }) {
  return (
    <div className="chart-legend" data-testid="chart-lines-legend" aria-label={t('chart.legend')}>
      <KeyStrip
        values={[
          { id: 'sits', label: t('chart.legendSits'), sample: <Sample line={undefined} arrow={false} /> },
          { id: 'up', label: t('chart.legendReportsTo'), sample: <Sample line={{ direction: 'up', override: false, kind: 'solid' }} /> },
          { id: 'into', label: t('chart.legendReportedBy'), sample: <Sample line={{ direction: 'into', override: false, kind: 'solid' }} /> },
          { id: 'dotted', label: t('chart.legendDotted'), sample: <Sample line={{ direction: 'into', override: false, kind: 'dotted' }} arrow={false} /> },
          { id: 'override', label: t('chart.legendOverride'), sample: <Sample line={{ direction: 'up', override: true, kind: 'dotted' }} /> },
        ]}
      />
    </div>
  )
}
