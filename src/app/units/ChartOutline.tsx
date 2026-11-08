// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation chart's outline (ADR-0036, amended 11 October 2026): the
 * units of the chart as a tree beside it, in the chart's own order, with the
 * find on top of it and the unit's order at its foot, each in a place that does
 * not move.
 *
 * **It leads the chart** (3.7.3). Unfolding a unit here, or picking it, unfolds
 * it on the chart too, with every unit above it, scrolls the chart to it, rings
 * it and picks it there. Folding here folds the outline alone: the two keep their
 * folds apart, for the session (`useChartFolds`).
 *
 * **It is a tree to the keyboard as it is to the eye**: up and down walk the rows
 * drawn, right opens or goes in, left closes or goes out, Home and End go to the
 * ends and Enter picks. One row is in the tab order.
 *
 * **Its width is the person's** (3.7.3): a seam on its right drags it, or the
 * arrow keys on the seam, kept with the editor's panel widths where the workspace
 * hands it one. On a narrow window the outline sits over the chart, the window's
 * width, and has no seam.
 *
 * **Order among siblings** is moved at its foot: the unit picked, one place up or
 * down among the units of its type under the same parent (`useSiblingOrder`).
 * Every list of units follows it. Beside them, *Move to…* puts it anywhere in the
 * organisation (`useMoveUnit`).
 */
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { Translate } from '../../i18n'
import type { ChartUnit, OrgChart } from '../../model/orgChart'
import type { ElementId } from '../../model/types'
import { OUTLINE_LIMITS } from '../../editor/panels'
import { textScale } from '../../platform/textSize'
import { CaretIcon } from '../../widgets/icons'
import { Button } from '../../widgets/kit/Button'
import { SeamResizer } from '../../widgets/SeamResizer'
import { locatedSelector } from '../../widgets/useLocated'
import type { SiblingOrder } from './useSiblingOrder'

export type ChartOutlineProps = {
  chart: OrgChart
  /** The units it lists: the chart's, or under a focus the one focused on. */
  units: readonly ChartUnit[]
  /** The outline's own folds. */
  folded: ReadonlySet<ElementId>
  /** Fold or unfold a unit here; unfolding one also leads the chart to it (`onPick`). */
  onToggle: (id: ElementId) => void
  /** The unit gone to: picked here, found, or chosen on the chart. */
  current: ElementId | undefined
  /** Lead the chart to a unit: it and the units above it unfolded there, scrolled to and picked. */
  onPick: (id: ElementId) => void
  /** Its width and where a new one goes; absent, it keeps its own while it is up. */
  width?: { width: number; onWidth(next: number): void } | undefined
  /** The box that finds a unit or a person, on top of it. */
  find?: ReactNode
  /** The current unit's place among its siblings; absent where it has none of its type or may not be moved here. */
  order: SiblingOrder | undefined
  /** *Move to…* the current unit, beside *Up* and *Down*; absent where nothing may be moved here or none is current. */
  moveTo?: (() => void) | undefined
  /** Whether the chart may be reordered at all: its foot stays in place while nothing is picked, so it moves nothing when something is. */
  canMove?: boolean
  t: Translate
}

/** The attribute a row carries its unit's id in: not the chart's own, so a ring on the chart never lands here. */
const ROW = 'data-outline-id'

/** The rows drawn, top to bottom. */
function rowsDrawn(units: readonly ChartUnit[], folded: ReadonlySet<ElementId>): ChartUnit[] {
  return units.flatMap((unit) => [unit, ...(folded.has(unit.id) ? [] : rowsDrawn(unit.children, folded))])
}

/** The unit a row sits in, among those drawn. */
function parentOf(units: readonly ChartUnit[], id: ElementId): ChartUnit | undefined {
  for (const unit of units) {
    if (unit.children.some((child) => child.id === id)) return unit
    const found = parentOf(unit.children, id)
    if (found) return found
  }
  return undefined
}

export function ChartOutline({ units, folded, onToggle, current, onPick, order, find, moveTo, canMove, width, t }: ChartOutlineProps) {
  const box = useRef<HTMLElement | null>(null)
  const [own, setOwn] = useState<number>(OUTLINE_LIMITS.default)
  // Kept in pixels at the default text size and drawn in rem, so the foot's three
  // buttons that fit on one line at 100% (Verschieben…, Verplaatsen naar…) fit at 150%.
  const scale = textScale()
  const wide = (width?.width ?? own) * scale
  const onWidth = (next: number) => (width?.onWidth ?? setOwn)(Math.round(next / scale))
  const [focusedRow, setFocusedRow] = useState<ElementId | undefined>(undefined)
  const drawn = rowsDrawn(units, folded)
  const rover = [focusedRow, current].find((id) => id !== undefined && drawn.some((row) => row.id === id)) ?? drawn[0]?.id
  // The unit gone to is brought on screen here too: the way to it is opened in
  // the same render, and a fold turned elsewhere in the outline leaves the
  // outline where the person put it.
  useEffect(() => {
    if (current === undefined) return
    box.current?.querySelector<HTMLElement>(locatedSelector(current, ROW))?.scrollIntoView?.({ block: 'nearest' })
  }, [current])
  const focusRow = (id: ElementId | undefined) => {
    if (id === undefined) return
    setFocusedRow(id)
    box.current?.querySelector<HTMLElement>(`${locatedSelector(id, ROW)} [data-testid="chart-outline-unit"]`)?.focus()
  }
  const onKeyDown = (event: KeyboardEvent, unit: ChartUnit) => {
    const at = drawn.findIndex((row) => row.id === unit.id)
    const hasUnits = unit.children.length > 0
    const shut = folded.has(unit.id)
    const moves: Record<string, () => void> = {
      ArrowDown: () => focusRow(drawn[at + 1]?.id),
      ArrowUp: () => focusRow(drawn[at - 1]?.id),
      Home: () => focusRow(drawn[0]?.id),
      End: () => focusRow(drawn.at(-1)?.id),
      ArrowRight: () => { if (hasUnits && shut) onToggle(unit.id); else if (hasUnits) focusRow(unit.children[0]?.id) },
      ArrowLeft: () => { if (hasUnits && !shut) onToggle(unit.id); else focusRow(parentOf(units, unit.id)?.id) },
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    move()
  }
  return (
    <>
      <nav ref={box} className="chart-outline" style={{ width: wide }} aria-label={t('chart.outline')} data-testid="chart-outline" data-guide="chart.outline">
        {find}
        {units.length === 0
          ? <p className="chart-outline__empty">{t('chart.outlineEmpty')}</p>
          : (
            <ul className="chart-outline__tree" role="tree" aria-label={t('chart.outline')}>
              <Rows units={units} depth={0} folded={folded} onToggle={onToggle} current={current} onPick={onPick} rover={rover} onKeyDown={onKeyDown} onFocusRow={setFocusedRow} t={t} />
            </ul>
          )}
        {(canMove || order || moveTo) && <OrderFoot order={order} moveTo={moveTo} t={t} />}
      </nav>
      <div data-testid="chart-outline-seam" className="chart-outline__seam">
        <SeamResizer
          orientation="vertical" region="before" value={wide} min={Math.round(OUTLINE_LIMITS.min * scale)} max={Math.round(OUTLINE_LIMITS.max * scale)}
          defaultValue={Math.round(OUTLINE_LIMITS.default * scale)} onChange={onWidth} label={t('chart.resizeOutline')}
        />
      </div>
    </>
  )
}

type RowsProps = Pick<ChartOutlineProps, 'folded' | 'onToggle' | 'current' | 'onPick' | 't'> & {
  units: readonly ChartUnit[]; depth: number; rover: ElementId | undefined
  onKeyDown: (event: KeyboardEvent, unit: ChartUnit) => void
  onFocusRow: (id: ElementId) => void
}

function Rows({ units, depth, ...props }: RowsProps) {
  const { folded, onToggle, current, onPick, rover, onKeyDown, onFocusRow, t } = props
  return (
    <>
      {units.map((unit) => {
        const hasUnits = unit.children.length > 0
        const shut = folded.has(unit.id)
        const on = current === unit.id
        return (
          <li key={unit.id} role="treeitem" aria-selected={on} {...(hasUnits ? { 'aria-expanded': !shut } : {})}>
            <div className="chart-outline__row" data-on={on || undefined} {...{ [ROW]: unit.id }} style={{ paddingInlineStart: depth * 14 }}>
              {hasUnits ? (
                <button
                  type="button" className="chart-outline__caret" data-shut={shut || undefined} tabIndex={-1} aria-label={t(shut ? 'chart.unfold' : 'chart.fold', { name: unit.name })}
                  onClick={() => { onToggle(unit.id); if (shut) onPick(unit.id) }} data-testid="chart-outline-fold"
                >
                  <CaretIcon />
                </button>
              ) : <span className="chart-outline__gap" />}
              <button
                type="button" className="chart-outline__name" onClick={() => onPick(unit.id)} onFocus={() => onFocusRow(unit.id)} onKeyDown={(event) => onKeyDown(event, unit)}
                aria-current={on ? 'true' : undefined} tabIndex={rover === unit.id ? 0 : -1} title={unit.name}
                data-testid="chart-outline-unit" data-unit-id={unit.id}
              >
                {unit.name}
              </button>
              {hasUnits && shut && <span className="chart-outline__count" aria-hidden="true">{unit.children.length}</span>}
            </div>
            {hasUnits && !shut && <ul role="group"><Rows {...props} units={unit.children} depth={depth + 1} /></ul>}
          </li>
        )
      })}
    </>
  )
}

/**
 * The unit picked: one place up or down among the units of its type beside it,
 * one step in each scope that keeps one of them, and *Move to…*. In a foot that
 * does not appear and vanish with the pick, because that moved the rows above it.
 */
function OrderFoot({ order, moveTo, t }: { order: SiblingOrder | undefined; moveTo: (() => void) | undefined; t: Translate }) {
  const none = t('chart.orderNone')
  return (
    <div className="chart-outline__foot" data-testid="chart-order" title={t('chart.orderHint')}>
      {order && (
        <div className="chart-outline__of" data-testid="chart-order-of">
          {order.parent !== undefined ? t('chart.orderIn', { type: order.type, unit: order.parent }) : t('chart.orderAtTop', { type: order.type })}
        </div>
      )}
      <div className="chart-outline__foot-row">
        <Button size="small" reason={order ? (order.at <= 0 ? t('chart.orderFirst') : undefined) : none} working={order?.writing} onClick={() => order?.move(-1)} data-testid="chart-order-up">{t('chart.moveUp')}</Button>
        <Button size="small" reason={order ? (order.at >= order.of - 1 ? t('chart.orderLast') : undefined) : none} working={order?.writing} onClick={() => order?.move(1)} data-testid="chart-order-down">{t('chart.moveDown')}</Button>
        <Button size="small" reason={moveTo ? undefined : none} onClick={moveTo} data-testid="chart-outline-move-to" data-guide="chart.outlineMoveTo">{t('unitMove.open')}</Button>
      </div>
      {order?.said && <div role="status" className="chart-outline__said" data-tone={order.said.tone} data-testid="chart-order-said">{order.said.text}</div>}
    </div>
  )
}
