// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The Conway map's second reading: each unit a column in the chart's order, its
 * applications under it, and the interfaces between them (`conwayRoutes`, never
 * over a name). Heavy and dashed where the two have said nothing; thin where
 * they agree; those to an application nobody owns only when asked for, because
 * they outweigh what can be judged. And one pair of it, drawn under the grid.
 *
 * The one piece of geometry on the page, measured from where the cards ended up
 * and never stored. Pressing a line or a card chooses it in the reader, and
 * leaves nothing.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import type { Translate } from '../../i18n'
import { plural } from '../../i18n/strings'
import type { ConwayLine, ConwayMap } from '../../model/conway'
import type { ElementId } from '../../model/types'
import { Button } from '../../widgets/kit/Button'
import { Card } from '../../widgets/kit/Card'
import { Line, LineLabel } from '../../widgets/kit/Line'
import type { LineInk, LinePattern } from '../../widgets/kit/Line'
import { MenuButton } from '../../widgets/kit/Menu'
import { lanesOf, LANE_STEP, routeOf } from './conwayRoutes'
import type { RouteBox, RouteLine } from './conwayRoutes'


const GUTTER = 44
const LANES_TOP = 6

export type ConwayShow = 'all' | 'unsaid'

const LOOK: Record<ConwayLine['status'], { ink: LineInk; pattern: LinePattern }> = {
  undeclared: { ink: 'signal', pattern: 'planned' },
  declared: { ink: 'quiet', pattern: 'solid' },
  unowned: { ink: 'quiet', pattern: 'implied' },
  inside: { ink: 'quiet', pattern: 'solid' },
}

function boxIn(root: DOMRect, node: Element): RouteBox {
  const box = node.getBoundingClientRect()
  return { left: box.left - root.left, right: box.right - root.left, top: box.top - root.top, bottom: box.bottom - root.top }
}

type Drawn = { key: string; d: string; line: ConwayLine }

function useRoutes(stage: { current: HTMLDivElement | null }, drawn: readonly ConwayLine[], groups: readonly (ElementId | undefined)[]) {
  const [routes, setRoutes] = useState<Drawn[]>([])
  const columnOf = useCallback((id: ElementId | undefined) => groups.indexOf(id), [groups])
  const asRoute = useCallback((line: ConwayLine): RouteLine => ({ key: line.flow.id, from: columnOf(line.from), to: columnOf(line.to) }), [columnOf])
  const laneCount = lanesOf(drawn.map(asRoute)).count
  const measure = useCallback(() => {
    const root = stage.current
    if (!root) { setRoutes([]); return }
    const box = root.getBoundingClientRect()
    const columns = [...root.querySelectorAll('[data-conway-column]')].map((node) => boxIn(box, node))
    const cards = new Map([...root.querySelectorAll<HTMLElement>('[data-app]')].map((card) => [card.dataset.app, boxIn(box, card)]))
    const lines = drawn.map(asRoute)
    const { lane } = lanesOf(lines)
    const used = new Map<string, number>()
    const next: Drawn[] = []
    drawn.forEach((line, at) => {
      const route = lines[at]
      const [source, target] = [cards.get(line.flow.sourceId), cards.get(line.flow.targetId)]
      if (!route || !source || !target || route.from < 0 || route.to < 0) return
      // Lines leaving one column take the next place in its gutter, so they do not lie on each other.
      const gutter = `${Math.min(route.from, route.to)}`
      const track = used.get(gutter) ?? 0
      used.set(gutter, (track + 1) % 6)
      next.push({ key: route.key, line, d: routeOf(route, source, target, columns, { lane: lane.get(route.key), laneTop: LANES_TOP, track }) })
    })
    setRoutes(next)
  }, [stage, drawn, asRoute])
  useLayoutEffect(() => { measure() }, [measure])
  useEffect(() => {
    const root = stage.current
    if (!root || typeof ResizeObserver === 'undefined') return undefined
    const watch = new ResizeObserver(() => measure())
    watch.observe(root)
    return () => watch.disconnect()
  }, [stage, measure])
  return { routes, laneCount }
}

/** A press or Enter or Space, for what is not a button in the markup. */
function pressing(run: () => void) {
  return {
    role: 'button', tabIndex: 0, onClick: run,
    onKeyDown: (event: KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); run() } },
  }
}

export function ConwayColumn({ unitId, apps, kind, name, marked, picked, pickedApp, grouped, nameOf, onUnit, onApp }: {
  unitId: ElementId | undefined
  apps: ConwayMap['groups'][number]['applications']
  kind?: string | undefined
  name: string
  marked: ReadonlySet<string>
  picked: boolean
  pickedApp: ElementId | undefined
  grouped: boolean
  nameOf: (id: ElementId) => string
  onUnit: (id: ElementId) => void
  onApp: (id: ElementId) => void
}) {
  return (
    <div className="conway__column" data-conway-column="" data-testid="conway-column" data-element-id={unitId} data-picked={picked || undefined}>
      <button type="button" className="conway__columnHead" disabled={unitId === undefined} onClick={() => { if (unitId !== undefined) onUnit(unitId) }} data-testid="conway-unit-open">
        {kind && <span className="conway__columnType" data-testid="conway-unit-kind">{kind}</span>}
        {name}
      </button>
      {apps.map((app) => (
        <Card
          key={app.id} name={app.name} selected={pickedApp === app.id} className="conway__appCard" data-testid="conway-app" data-app={app.id} data-element-id={app.id}
          data-marked={marked.has(app.id) || undefined} aria-label={app.name}
          {...(grouped && app.partyId !== undefined && app.partyId !== unitId ? { sub: nameOf(app.partyId) } : {})}
          {...pressing(() => onApp(app.id))}
        />
      ))}
    </div>
  )
}

/** The lines as they are drawn: pressable by whoever can reach them, named in words. */
function LinePaths({ routes, picked, nameOf, onLine, t }: {
  routes: readonly Drawn[]; picked: ReadonlySet<string>; nameOf: (id: ElementId) => string; onLine: (line: ConwayLine) => void; t: Translate
}) {
  return (
    <svg aria-hidden={routes.length === 0 || undefined}>
      {routes.map(({ key, d, line }) => (
        <Line
          key={key} d={d} ink={LOOK[line.status].ink} pattern={LOOK[line.status].pattern} state={picked.has(key) ? 'picked' : 'rest'}
          data-testid={`conway-line-${line.status}`}
          aria-label={t('conway.lineLabel', { source: nameOf(line.flow.sourceId), target: nameOf(line.flow.targetId) })}
          {...pressing(() => onLine(line))}
        />
      ))}
    </svg>
  )
}

export function ConwayLines({ map, kindOf, nameOf, show, onShow, showUnowned, onShowUnowned, chosenLines, pickedUnit, pickedApp, grouped, onUnit, onApp, onLine, t }: {
  map: Pick<ConwayMap, 'groups' | 'lines'>
  kindOf: (id: ElementId) => string | undefined
  nameOf: (id: ElementId) => string
  show: ConwayShow
  onShow: (show: ConwayShow) => void
  showUnowned: boolean
  onShowUnowned: (on: boolean) => void
  chosenLines: readonly ConwayLine[]
  pickedUnit: ElementId | undefined
  pickedApp: ElementId | undefined
  grouped: boolean
  onUnit: (id: ElementId) => void
  onApp: (id: ElementId) => void
  onLine: (line: ConwayLine) => void
  t: Translate
}) {
  const stage = useRef<HTMLDivElement | null>(null)
  const noOwner = map.groups.find((group) => group.unitId === undefined)
  const groups = useMemo(() => map.groups.filter((group) => group.unitId !== undefined || showUnowned), [map.groups, showUnowned])
  const ids = useMemo(() => groups.map((group) => group.unitId), [groups])
  const drawn = useMemo(() => map.lines.filter((line) => {
    if (line.status === 'inside') return false
    if (line.status === 'unowned') return showUnowned && line.from !== line.to
    return show === 'all' || line.status === 'undeclared'
  }), [map.lines, show, showUnowned])
  const { routes, laneCount } = useRoutes(stage, drawn, ids)
  const unowned = map.lines.filter((line) => line.status === 'unowned').length
  const marked = new Set(chosenLines.flatMap((line) => [line.flow.sourceId, line.flow.targetId]))
  const picked = new Set(chosenLines.map((line) => line.flow.id))
  const words: Record<ConwayShow, string> = { all: t('conway.showAll'), unsaid: t('conway.showUnsaid') }
  return (
    <>
      <div className="conway__showRow">
        <MenuButton
          variant="plain" label={t('conway.show', { what: words[show] })} menuLabel={t('conway.showLabel')} data-guide="conway.show"
          items={(['all', 'unsaid'] as const).map((one) => ({ label: words[one], checked: one === show, onSelect: () => onShow(one) }))}
        />
      </div>
      <div className="conway__lines" data-testid="conway-lines">
        <div
          ref={stage} className="conway__stage"
          style={{ '--conway-gutter': `${GUTTER}px`, paddingTop: LANES_TOP + laneCount * LANE_STEP + 10 } as CSSProperties}
        >
          {groups.map((group) => (
            <ConwayColumn
              key={group.unitId ?? ''} unitId={group.unitId} apps={group.applications}
              kind={group.unitId === undefined ? undefined : kindOf(group.unitId)}
              name={group.unitId === undefined ? t('conway.noOwnerRow') : nameOf(group.unitId)}
              marked={marked} picked={group.unitId !== undefined && group.unitId === pickedUnit} pickedApp={pickedApp} grouped={grouped}
              nameOf={nameOf} onUnit={onUnit} onApp={onApp}
            />
          ))}
          <LinePaths routes={routes} picked={picked} nameOf={nameOf} onLine={onLine} t={t} />
        </div>
      </div>
      {noOwner && (
        <div className="conway__strip" data-testid="conway-strip">
          <span className="conway__stripWords">
            {plural(t, { one: 'conway.stripApps.one', other: 'conway.stripApps.other' }, noOwner.applications.length)}
            {' '}
            {showUnowned ? '' : plural(t, { one: 'conway.stripLines.one', other: 'conway.stripLines.other' }, unowned)}
          </span>
          <Button variant="plain" size="small" onClick={() => onShowUnowned(!showUnowned)} data-testid="conway-show-unowned" data-guide="conway.showUnowned">
            {t(showUnowned ? 'conway.hideTheirLines' : 'conway.showTheirLines')}
          </Button>
        </div>
      )}
      <div className="conway__key">
        <span>{t('conway.keyHeavy')}</span><span>{t('conway.keyThin')}</span>{showUnowned && <span>{t('conway.keyDotted')}</span>}<span>{t('conway.keyPress')}</span>
      </div>
    </>
  )
}

/** One pair under the grid: the two units, the applications the interfaces join marked, and the interfaces between them. */
export function ConwayPairDrawing({ a, b, lines, kindOf, nameOf, pickedApp, grouped, onUnit, onApp, onLine, t }: {
  a: { unitId: ElementId | undefined; apps: ConwayMap['groups'][number]['applications'] }
  b: { unitId: ElementId | undefined; apps: ConwayMap['groups'][number]['applications'] }
  lines: readonly ConwayLine[]
  kindOf: (id: ElementId) => string | undefined
  nameOf: (id: ElementId) => string
  pickedApp: ElementId | undefined
  grouped: boolean
  onUnit: (id: ElementId) => void
  onApp: (id: ElementId) => void
  onLine: (line: ConwayLine) => void
  t: Translate
}) {
  const stage = useRef<HTMLDivElement | null>(null)
  const [routes, setRoutes] = useState<Drawn[]>([])
  const measure = useCallback(() => {
    const root = stage.current
    if (!root) return
    const box = root.getBoundingClientRect()
    const cards = new Map([...root.querySelectorAll<HTMLElement>('[data-app]')].map((card) => [card.dataset.app, boxIn(box, card)]))
    const next = lines.flatMap((line): Drawn[] => {
      const [source, target] = [cards.get(line.flow.sourceId), cards.get(line.flow.targetId)]
      if (!source || !target) return []
      const [left, right] = source.left < target.left ? [source, target] : [target, source]
      const [y1, y2] = [(left.top + left.bottom) / 2, (right.top + right.bottom) / 2]
      const middle = (left.right + right.left) / 2
      // At right angles, as the Lines reading and the chart draw theirs: one way of drawing a line on these pages.
      return [{ key: line.flow.id, line, d: `M${left.right},${y1} H${middle} V${y2} H${right.left}` }]
    })
    setRoutes(next)
  }, [lines])
  useLayoutEffect(() => { measure() }, [measure])
  const marked = new Set(lines.flatMap((line) => [line.flow.sourceId, line.flow.targetId]))
  const column = (side: typeof a) => (
    <ConwayColumn
      unitId={side.unitId} apps={side.apps} kind={side.unitId === undefined ? undefined : kindOf(side.unitId)}
      name={side.unitId === undefined ? t('conway.noOwnerRow') : nameOf(side.unitId)}
      marked={marked} picked={false} pickedApp={pickedApp} grouped={grouped} nameOf={nameOf} onUnit={onUnit} onApp={onApp}
    />
  )
  return (
    <div ref={stage} className="conway__pair" data-testid="conway-pair-drawing">
      {column(a)}
      <div className="conway__pairWords">
        {lines.slice(0, 4).map((line) => (
          <LineLabel key={line.flow.id} words={`${nameOf(line.flow.sourceId)} → ${nameOf(line.flow.targetId)}`} />
        ))}
        {lines.length > 4 && <span className="conway__quiet">{t('conway.moreLines', { count: lines.length - 4 })}</span>}
      </div>
      {column(b)}
      <LinePaths routes={routes} picked={new Set()} nameOf={nameOf} onLine={onLine} t={t} />
    </div>
  )
}
