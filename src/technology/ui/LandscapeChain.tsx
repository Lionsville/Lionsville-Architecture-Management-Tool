// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The chain: three columns of one-line rows, left standing on right. Each
 * column is the one List, so the keys, the focus and a row's look are the
 * kit's; what is the page's alone is the lines between the columns, measured
 * off the rows and drawn behind them so a line never crosses a name.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, MouseEvent, ReactNode } from 'react'
import type { ElementId } from '../../model'
import type { LandscapeApplication, LandscapeEdge, LandscapePlatform, LandscapeService, NodeKey, TechnologyLandscape } from '../../model/technologyLandscape'
import { nodeKey } from '../../model/technologyLandscape'
import { useStrings } from '../../i18n'
import { IconButton } from '../../widgets/kit/Button'
import { List } from '../../widgets/kit/List'
import type { ListGroup, ListRow } from '../../widgets/kit/List'
import { AddIcon } from '../../widgets/icons'
import { lineKindOf } from './landscapeWords'
import type { LandscapeShowing } from './useLandscapeShowing'

type Drawn = { key: string; d: string; kind: string; strong: boolean; label?: { x: number; y: number; text: string } }

const rowOf = (board: HTMLElement, key: NodeKey) => [...board.querySelectorAll<HTMLElement>('[data-kit-row]')]
  .find((row) => row.dataset.kitRow === `row:${key}` || row.dataset.kitRow === `head:${key}`)

/**
 * Where a line from an application to a platform crosses the services between
 * them: under the column's last row. A straight curve would run behind the rows
 * and show as two stubs that seem to end nowhere.
 */
function channelUnder(board: HTMLElement, origin: DOMRect): { left: number; right: number; y: number } | undefined {
  const rows = [...board.querySelectorAll<HTMLElement>('[data-testid="landscape-band-services"] [data-kit-row]')].map((row) => row.getBoundingClientRect())
  if (rows.length === 0) return undefined
  return {
    left: Math.min(...rows.map((row) => row.left)) - origin.left,
    right: Math.max(...rows.map((row) => row.right)) - origin.left,
    y: Math.max(...rows.map((row) => row.bottom)) - origin.top + 8,
  }
}

const skipsServices = (edge: LandscapeEdge) => !edge.from.startsWith('platform:') && !edge.from.startsWith('service:') && edge.to.startsWith('platform:')

/** A curve from the right edge of the left end to the left edge of the right end, in the gutters. */
export function drawLines(board: HTMLElement, edges: readonly LandscapeEdge[], focus: NodeKey | undefined): Drawn[] {
  const origin = board.getBoundingClientRect()
  const channel = channelUnder(board, origin)
  return edges.flatMap((edge) => {
    const from = rowOf(board, edge.from)?.getBoundingClientRect()
    const to = rowOf(board, edge.to)?.getBoundingClientRect()
    if (!from || !to) return []
    const x1 = from.right - origin.left
    const y1 = from.top + from.height / 2 - origin.top
    const x2 = to.left - origin.left
    const y2 = to.top + to.height / 2 - origin.top
    const bend = Math.max(24, (x2 - x1) / 2)
    const under = channel && skipsServices(edge) && channel.left > x1 && channel.right < x2 ? channel : undefined
    const d = under
      ? `M${x1},${y1} C${(x1 + under.left) / 2},${y1} ${(x1 + under.left) / 2},${under.y} ${under.left},${under.y} L${under.right},${under.y} C${(under.right + x2) / 2},${under.y} ${(under.right + x2) / 2},${y2} ${x2},${y2}`
      : `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`
    return [{
      key: `${edge.from}|${edge.to}|${edge.kind}|${edge.implied ? 'i' : ''}`,
      d,
      kind: lineKindOf(edge),
      strong: edge.from === focus || edge.to === focus,
      ...(edge.count > 1 ? { label: { x: (x1 + x2) / 2, y: (y1 + y2) / 2, text: String(edge.count) } } : {}),
    }]
  })
}

function useLines(board: React.RefObject<HTMLDivElement | null>, edges: readonly LandscapeEdge[], focus: NodeKey | undefined, landscape: unknown, view: unknown) {
  const [paths, setPaths] = useState<Drawn[]>([])
  const measure = useCallback(() => {
    const next = board.current ? drawLines(board.current, edges, focus) : []
    setPaths((was) => (was.length === 0 && next.length === 0 ? was : next))
  }, [board, edges, focus])
  useLayoutEffect(() => { measure() }, [measure, landscape, view])
  useEffect(() => {
    const held = board.current
    if (!held || typeof ResizeObserver === 'undefined') return undefined
    const watcher = new ResizeObserver(() => measure())
    watcher.observe(held)
    return () => watcher.disconnect()
  }, [board, measure])
  return paths
}

const asNode = (rowKey: string | undefined) => rowKey?.slice(rowKey.indexOf(':') + 1) as NodeKey | undefined

export type ChainProps = {
  showing: LandscapeShowing
  landscape: TechnologyLandscape
  /** What a row shows in its mark: the tick while uses are edited, the swatch under a colour. */
  markOf(key: NodeKey): ReactNode
  /** The key strip's value pressed: the rows without it go quiet. */
  quiet(key: NodeKey): boolean
  dropTarget: NodeKey | undefined
  noteOfApplication(app: LandscapeApplication): string
  noteOfService(service: LandscapeService): { note?: string; attention: boolean }
  noteOfPlatform(platform: LandscapePlatform): string
  onPress(key: NodeKey): void
  onOpen(key: NodeKey): void
  onAdd: ((kind: 'platform' | 'platformService', parentId?: ElementId, at?: { x: number; y: number }) => void) | undefined
  onDragStart: ((id: ElementId) => void) | undefined
  onDragOverRow(key: NodeKey | undefined): void
  onDropRow(key: NodeKey): void
  /** An application is being dragged: the lines of what was picked before recede while it is. */
  dragging?: boolean
  groupLabel(key: string, label: string | undefined): string
}

type Flat<T> = { node: T; depth: number }
function flatten<T extends { children: T[] }>(nodes: readonly T[], depth = 0): Flat<T>[] {
  return nodes.flatMap((node) => [{ node, depth }, ...flatten(node.children, depth + 1)])
}

export function LandscapeChain(props: ChainProps) {
  const { showing, landscape, onAdd } = props
  const { t } = useStrings()
  const board = useRef<HTMLDivElement>(null)
  const foldedGroups = useMemo(() => new Set([...showing.folded].map(nodeKey.group)), [showing.folded])
  const paths = useLines(board, showing.edges, showing.focus, landscape, showing.view)

  const stateOf = useCallback((key: NodeKey, extra: readonly (string | false | undefined)[] = []) => {
    const words = [...extra]
    if (showing.touched?.has(key)) words.push('strong')
    else if ((showing.selected !== undefined && showing.touched) || props.quiet(key)) words.push('dim')
    if (props.dropTarget === key) words.push('target')
    return words.filter(Boolean).join(' ') || undefined
  }, [showing.touched, showing.selected, props.quiet, props.dropTarget])
  const hides = useCallback((key: NodeKey) => showing.onlyTouched && showing.selected !== undefined && !showing.touched?.has(key), [showing.onlyTouched, showing.selected, showing.touched])

  const row = (key: NodeKey, text: string, note: string | undefined, depth: number, state: string | undefined): ListRow => {
    const mark = props.markOf(key)
    return {
      id: key, text,
      ...(note ? { note } : {}),
      ...(mark ? { mark } : {}),
      ...(depth ? { depth } : {}),
      ...(state ? { state } : {}),
    }
  }
  const applicationGroups = useMemo<ListGroup[]>(() => {
    const heads = landscape.groups.length > 1
    return landscape.groups.map((group) => ({
      id: nodeKey.group(group.key),
      label: heads ? props.groupLabel(group.key, group.label) : '',
      rows: group.applications.filter((app) => !hides(nodeKey.application(app.id))).map((app) => {
        const key = nodeKey.application(app.id)
        return row(key, app.name, props.noteOfApplication(app), 0, stateOf(key, [!app.known && 'unknown']))
      }),
    }))
  }, [landscape.groups, hides, stateOf, props.markOf, props.noteOfApplication, props.groupLabel])

  const ownServices = flatten(landscape.services.filter((one) => one.where === undefined))
  const sharedServices = landscape.services.filter((one) => one.where !== undefined)
  const serviceRow = ({ node, depth }: Flat<LandscapeService>): ListRow => {
    const key = nodeKey.service(node.id)
    const said = props.noteOfService(node)
    return row(key, node.name, said.note, depth, stateOf(key, [said.attention && 'attention', node.where !== undefined && node.consumers === 0 && 'ghost']))
  }
  const platformRows = flatten(landscape.platforms).filter(({ node }) => !hides(nodeKey.platform(node.id))).map(({ node, depth }) => {
    const key = nodeKey.platform(node.id)
    return row(key, node.name, props.noteOfPlatform(node), depth, stateOf(key, [node.outside && 'outside']))
  })

  const onHover = (event: MouseEvent) => {
    const key = asNode((event.target as HTMLElement).closest<HTMLElement>('[data-kit-row]')?.dataset.kitRow)
    if (showing.hovered !== key) showing.setHovered(key)
  }
  const onDouble = (event: MouseEvent) => {
    const key = asNode((event.target as HTMLElement).closest<HTMLElement>('[data-kit-row]')?.dataset.kitRow)
    if (key) props.onOpen(key)
  }
  const targetOf = (event: DragEvent) => {
    const key = asNode((event.target as HTMLElement).closest<HTMLElement>('[data-kit-row]')?.dataset.kitRow)
    return key && (key.startsWith('service:') || key.startsWith('platform:')) ? key : undefined
  }

  const selectedId = showing.selected ?? null
  const press = (id: string) => props.onPress(id as NodeKey)
  const addButton = (kind: 'platform' | 'platformService', label: string, testId: string) => (onAdd ? (
    <IconButton size="small" label={label} data-testid={testId} data-sheet-add onClick={(event) => { const box = event.currentTarget.getBoundingClientRect(); onAdd(kind, undefined, { x: box.left, y: box.bottom }) }}><AddIcon /></IconButton>
  ) : null)
  return (
    <div
      ref={board}
      className="tl-board"
      data-columns={showing.services ? 3 : 2}
      data-testid="landscape-board"
      data-dragging={props.dragging || undefined}
      onMouseOver={onHover}
      onMouseLeave={() => showing.setHovered(undefined)}
      onDoubleClick={onDouble}
      onDragOver={props.onDragStart ? (event) => { const key = targetOf(event); if (key) event.preventDefault(); props.onDragOverRow(key) } : undefined}
      onDrop={props.onDragStart ? (event) => { const key = targetOf(event); if (key) { event.preventDefault(); props.onDropRow(key) } } : undefined}
    >
      <svg className="tl-lines" data-testid="landscape-lines" aria-hidden="true">
        {paths.map((one) => (
          <g key={one.key}>
            <path className="tl-line" d={one.d} data-kind={one.kind} data-strong={one.strong || undefined} />
            {one.label && <text x={one.label.x} y={one.label.y} textAnchor="middle">{one.label.text}</text>}
          </g>
        ))}
      </svg>
      <section className="tl-column" data-testid="landscape-applications" aria-label={t('landscape.applications')}>
        <div className="tl-columnHead"><div><h3>{t('landscape.applications')}</h3><p>{t('landscape.applicationsNote')}</p></div></div>
        <List
          label={t('landscape.applications')} density="compact" groups={applicationGroups} selectedId={selectedId} onOpen={press}
          folded={foldedGroups} onFold={(id, to) => showing.fold(id.slice('group:'.length), to)} onOpenGroup={press}
          {...(props.onDragStart ? { onRowDragStart: (id: string, event: DragEvent<HTMLDivElement>) => { const held = id.slice('application:'.length); event.dataTransfer?.setData('text/plain', held); props.onDragStart!(held) } } : {})}
          empty={<p className="tl-columnNote">{t('landscape.noApplications')}</p>} rowGuide="landscape.row"
        />
      </section>
      {showing.services && (
        <section className="tl-column" data-testid="landscape-band-services" data-guide="landscape.servicesBand" aria-label={t('landscape.services')}>
          <div className="tl-columnHead">
            <div><h3>{t('landscape.services')}</h3><p>{t('landscape.servicesNote')}</p></div>
            {addButton('platformService', t('landscape.addService'), 'landscape-add-service')}
          </div>
          <List
            label={t('landscape.services')} density="compact" selectedId={selectedId} onOpen={press}
            groups={[{ id: 'own', label: '', rows: ownServices.filter(({ node }) => !hides(nodeKey.service(node.id))).map(serviceRow) }]}
            empty={sharedServices.length === 0 ? <p className="tl-columnNote">{t('landscape.noServices')}</p> : null} rowGuide="landscape.row"
          />
          {sharedServices.length > 0 && showing.showShared && (
            <div className="tl-shared" data-testid="landscape-shared-row">
              <div className="tl-sharedHead">{t('landscape.showShared')}</div>
              <List
                label={t('landscape.showShared')} density="compact" selectedId={selectedId} onOpen={press} dataGuide="landscape.sharedRow" rowGuide="landscape.row"
                groups={[{ id: 'shared', label: '', rows: sharedServices.map((node) => serviceRow({ node, depth: 0 })) }]}
              />
            </div>
          )}
        </section>
      )}
      <section className="tl-column" data-testid="landscape-band-platforms" aria-label={t('landscape.platforms')}>
        <div className="tl-columnHead">
          <div><h3>{t('landscape.platforms')}</h3><p>{t('landscape.platformsNote')}</p></div>
          {addButton('platform', t('landscape.addPlatform'), 'landscape-add-platform')}
        </div>
        <List
          label={t('landscape.platforms')} density="compact" selectedId={selectedId} onOpen={press}
          groups={[{ id: 'platforms', label: '', rows: platformRows }]}
          empty={<p className="tl-columnNote">{t('landscape.noPlatforms')}</p>} rowGuide="landscape.row"
        />
      </section>
    </div>
  )
}
