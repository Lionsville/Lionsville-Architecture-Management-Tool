// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The analysis drawn (ADR-0021, ADR-0032 §8): observations on the left, the
 * causes they were analysed into in the lanes to the right, root causes, and
 * the solutions that address them last — and, with the scopes below on, each
 * scope below in a boundary of its own to the left, nested as the tree
 * nests, with the lines that cross a boundary drawn apart.
 *
 * Plain SVG over `analysisPicture` (`graph.ts`): no canvas library, nothing
 * dragged, the same records in the same place every time. Each record is one
 * of two sizes (`PictureMarks`), and a card drops to one line of the same size on
 * screen under 80%. **It opens readable**: at 100%, on what `chain.ts` says weighs
 * most, and offers the rest, instead of fitting everything until nothing can be
 * read. The dock and ⌘ or Ctrl with + − 0, the wheel or a pinch zoom it, down to
 * the floor (`widgets/kit/zoom`), and a drag on the background pans it. Hovering a record — or focusing it from the
 * keyboard — traces its chain both ways and dims the rest, and shows its full
 * title, label and scope beside it, so a title cut short on a card is always
 * one hover from whole.
 *
 * Clicking anything selects it; Enter or Space does the same from the
 * keyboard. A right-click on a record or a line asks the page what can be
 * done with it (`PictureMenu`); a line offers its menu only where the link is
 * this scope's to change.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { useStrings } from '../../i18n'
import { stepZoom } from '../../widgets/kit/zoom'
import { toneOf } from '../observation'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import type { Translate } from '../../i18n'
import { analysisPicture, brightChains, FAR_BELOW, fitZoom, openEnds, pictureKey, traceChain, PICTURE_SIZE } from '../graph'
import type { PictureEdge, PictureLane, PictureNode, PictureSize, SectionedPicture } from '../graph'
import { causeLabel } from '../observation'
import type { CauseAbove, ScopeAnalysis } from '../observation'
import type { FilterResult } from '../filter'
import type { MapWindow } from '../chain'
import { DIMMED, LINE_HIT_WIDTH, STROKE, seenTint } from './ChainMarks'
import type { PictureMenuHandler } from './PictureMenu'
import { RecordMark, anchorOf, recordLabel, recordState, recordTitle } from './PictureMarks'
import { clampZoom } from './usePictureFilters'
import type { PictureView } from './usePictureFilters'
import { steppedZoomTarget, useCanvasZoom } from '../../widgets/kit/useCanvasZoom'
import { CanvasDock } from '../../widgets/kit/CanvasDock'
import { PageState } from '../../widgets/kit/PageState'

export type AnalysisPictureProps = {
  /** The scopes in view: this one first, then those below while View local is on. */
  scopes: readonly ScopeAnalysis[]
  here: string
  /** What the filters left, and what they matched themselves, which is outlined. */
  filter?: Pick<FilterResult, 'filtering' | 'visible' | 'matched'>
  /**
   * The causes above a scope that explain its records, by the id explained:
   * for this scope and for every one below it, read off the tree whether or
   * not the scope that explains them is drawn.
   */
  explainedAbove?: (scope: string) => ReadonlyMap<string, readonly CauseAbove[]> | undefined
  view: PictureView
  /** What a scope is called, this one included. */
  scopeLabel: (path: string) => string
  /** The heading over this scope's lanes while there are boundaries beside them. */
  hereLabel: string
  selectedKey?: string
  onSelect: (key: string) => void
  /** A right-click on a record or a line; absent, the browser's own menu. */
  onMenu?: PictureMenuHandler
  /** What is drawn of a large scope, and the cards for the rest; absent, everything. */
  window?: MapWindow
  /** A press on a card that stands for what is not drawn. */
  onMore?: (card: Extract<PictureNode, { kind: 'more' }>) => void
  /**
   * The + on a card: a press asks why of it, a drag to another card links the two.
   * Absent where nothing may be written.
   */
  onAsk?: (key: string) => void
  onDragLink?: (from: string, to: string) => void
  /** What the dock holds beyond the zoom. */
  dockExtra?: ReactNode
  /** Everything is drawn, so the map may run far past the window: say where the window stands. */
  showOverview?: boolean
  s: Translate
}

const LANE_KEY: Record<PictureLane, 'observation.laneObservations' | 'observation.laneCauses' | 'observation.laneDeeper' | 'observation.laneRoots' | 'observation.laneSolutions'> = {
  observations: 'observation.laneObservations',
  causes: 'observation.laneCauses',
  deeper: 'observation.laneDeeper',
  roots: 'observation.laneRoots',
  solutions: 'observation.laneSolutions',
}

/** How far short of `opensAt` a map stops, so the lanes do not start against the window's edge. */
const OPENS_CLEAR = 24

/** A record's own id, as the lists and the page's menus name it. */
export function recordId(node: PictureNode): string {
  if (node.kind === 'more') return node.key
  return node.kind === 'observation' ? node.observation.id : node.kind === 'cause' ? node.cause.id : node.solution.id
}

export function AnalysisPicture(props: AnalysisPictureProps) {
  const { scopes, here, view, s, window: drawnWindow } = props
  const filtered = props.filter?.filtering ? props.filter.visible : undefined
  const visible = drawnWindow?.drawn ?? filtered
  // Far out a card is one line, laid out for that: three lines at 60% could not be read.
  const size = view.size === 'large' && view.zoom < FAR_BELOW ? 'far' : view.size
  const picture = useMemo(
    () => analysisPicture(scopes, {
      here, size, ...(visible ? { visible } : {}),
      ...(drawnWindow ? { cards: drawnWindow.cards, order: drawnWindow.order } : {}),
    }),
    [scopes, here, size, visible, drawnWindow],
  )
  const open = useMemo(() => openEnds(scopes, here, props.explainedAbove), [scopes, here, props.explainedAbove])
  // The chains behind bright spots only are drawn in the success colour (ADR-0038 §6).
  const bright = useMemo(() => {
    const keys = brightChains(scopes, here)
    for (const node of picture.nodes) if (node.kind === 'observation' && toneOf(node.observation) === 'bright') keys.add(node.key)
    return keys
  }, [scopes, here, picture.nodes])
  const [hot, setHot] = useState<string | undefined>(undefined)
  const traced = useMemo(() => (hot ? traceChain(hot, picture.edges) : undefined), [hot, picture.edges])
  const hotNode = hot ? picture.nodes.find((node) => node.key === hot && node.kind !== 'more') : undefined
  const large = size !== 'small'

  return (
    <PictureFrame content={picture} opensAt={picture.boundaries.length > 0 && picture.nodes.some((node) => node.scope === here) ? picture.hereX : undefined} view={view} label={s('observation.tabAnalysis')} dockExtra={props.dockExtra} overview={props.showOverview ? { nodes: picture.nodes, slot: PICTURE_SIZE[size] } : undefined}>
      {picture.nodes.length === 0 ? (
        <PageState compact state="empty" title={filtered ? s('observation.filterNothing') : s('observation.graphEmpty')} />
      ) : (
        <Box sx={{ position: 'relative', width: picture.width * view.zoom, height: picture.height * view.zoom }}>
          <svg
            width={picture.width * view.zoom}
            height={picture.height * view.zoom}
            viewBox={`0 0 ${picture.width} ${picture.height}`}
            role="group"
            aria-label={s('observation.tabAnalysis')}
            data-testid="analysis-picture"
            data-guide="observations.picture"
            data-size={view.size}
            style={{ display: 'block' }}
          >
            <Headings picture={picture} hereLabel={props.hereLabel} s={s} large={large} />
            <Boundaries picture={picture} scopeLabel={props.scopeLabel} s={s} />
            <Edges picture={picture} here={here} size={size} traced={traced} bright={bright} onMenu={props.onMenu} />
            <Nodes {...props} picture={picture} size={size} open={open} traced={traced} hot={hot} onHot={setHot} />
          </svg>
          {hotNode && <HoverCard node={hotNode} picture={picture} zoom={view.zoom} size={size} scopeLabel={props.scopeLabel} s={s} />}
        </Box>
      )}
    </PictureFrame>
  )
}

/** Where the window stands over a map that does not fit: a drag on it moves the window, so a far card is a press away. */
function Overview({ frame, content, nodes, slot, zoom, s }: {
  frame: RefObject<HTMLDivElement | null>
  content: { width: number; height: number }
  nodes: readonly { x: number; y: number }[]
  slot: { width: number; height: number }
  zoom: number
  s: Translate
}) {
  const scale = 180 / Math.max(content.width, 1)
  const height = Math.min(120, content.height * scale)
  const element = frame.current
  const goTo = (event: PointerEvent<SVGSVGElement>) => {
    if (event.buttons !== 1 || !element) return
    const box = event.currentTarget.getBoundingClientRect()
    element.scrollLeft = ((event.clientX - box.left) / scale) * zoom - element.clientWidth / 2
    element.scrollTop = ((event.clientY - box.top) / scale) * zoom - element.clientHeight / 2
  }
  return (
    <div className="chain-overview" data-testid="picture-overview">
      <svg width={180} height={height} viewBox={`0 0 180 ${height}`} onPointerDown={goTo} onPointerMove={goTo} aria-hidden="true">
        {nodes.map((node, index) => <rect key={index} x={node.x * scale} y={node.y * scale} width={slot.width * scale} height={Math.max(1, slot.height * scale)} fill="var(--ink-3)" />)}
        {element && (
          <rect
            x={(element.scrollLeft / zoom) * scale} y={(element.scrollTop / zoom) * scale}
            width={(element.clientWidth / zoom) * scale} height={(element.clientHeight / zoom) * scale} fill="none" stroke="var(--accent)" strokeWidth={1.5}
          />
        )}
      </svg>
      <div className="chain-overview__said">{s('observation.mapOverview')}</div>
    </div>
  )
}

/**
 * The window a map is looked at through, the same for both: it zooms the one way
 * every canvas does, pans with a drag on the background, and has the dock. Scrollable,
 * so it takes the keyboard's arrows as well. A map that does not fit says where the
 * window stands.
 */
export function PictureFrame({ content, opensAt, view, label, children, dockExtra, overview, s }: {
  content: { width: number; height: number }
  /**
   * Where the map opens along its width, where its start is not what it is read for.
   * The scopes below stand to the left of this scope's lanes, so at 100% they would
   * push this scope's own records out of the window. Past the end the browser stops
   * at the end, which leaves the nearest scope below in view beside them. Absent, as
   * where a filter leaves nothing of this scope, the map stands at its start.
   */
  opensAt?: number | undefined
  view: PictureView
  label: string
  children: ReactNode
  dockExtra?: ReactNode
  overview?: { nodes: readonly { x: number; y: number }[]; slot: { width: number; height: number } } | undefined
  s?: Translate
}) {
  const theme = useTheme()
  const said = useStrings().t
  const frame = useRef<HTMLDivElement>(null)
  const latest = useRef(view)
  latest.current = view
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [pan, setPan] = useState<{ x: number; y: number; left: number; top: number } | undefined>(undefined)
  const [, moved] = useState(0)

  useEffect(() => {
    const element = frame.current
    if (!element) return undefined
    const measure = () => setViewport({ width: element.clientWidth, height: element.clientHeight })
    measure()
    // Absent under a test's DOM, which never resizes.
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(element)
    return () => observer?.disconnect()
  }, [])

  useLayoutEffect(() => {
    if (frame.current) frame.current.scrollLeft = opensAt === undefined ? 0 : Math.max(0, opensAt * latest.current.zoom - OPENS_CLEAR)
  }, [opensAt])

  const zoomTo = useCallback((zoom: number, at?: { x: number; y: number }) => {
    const element = frame.current
    const ratio = clampZoom(zoom) / latest.current.zoom
    latest.current.zoomTo(zoom)
    if (!element || !at) return
    // The picture has its new size on the next frame, and the record under the pointer stays under it.
    requestAnimationFrame(() => {
      element.scrollLeft = (element.scrollLeft + at.x) * ratio - at.x
      element.scrollTop = (element.scrollTop + at.y) * ratio - at.y
    })
  }, [])
  const zoomRef = useCanvasZoom(steppedZoomTarget({
    zoom: () => latest.current.zoom,
    to: zoomTo,
    fit: () => latest.current.fitNow(),
  }))
  const frameRef = useCallback((element: HTMLDivElement | null) => {
    frame.current = element
    zoomRef(element)
  }, [zoomRef])

  const { fit, fitted } = view
  useEffect(() => {
    if (fit) fitted(fitZoom(content, viewport))
  }, [fit, fitted, content, viewport])

  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as Element).closest('[data-key], [data-handle]')) return
    const element = event.currentTarget
    setPan({ x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop })
    element.setPointerCapture?.(event.pointerId)
  }
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!pan) return
    event.currentTarget.scrollLeft = pan.left - (event.clientX - pan.x)
    event.currentTarget.scrollTop = pan.top - (event.clientY - pan.y)
  }
  const overflows = viewport.width > 0 && (content.width * view.zoom > viewport.width || content.height * view.zoom > viewport.height)
  const [mapOn, setMapOn] = useState(true)
  return (
    <div className="chain-map">
      <Box
        ref={frameRef}
        role="region"
        aria-label={label}
        tabIndex={0}
        data-testid="analysis-frame"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => setPan(undefined)}
        onPointerCancel={() => setPan(undefined)}
        onScroll={() => moved((tick) => tick + 1)}
        sx={{
          flex: 1, minHeight: 0, overflow: 'auto', position: 'relative', cursor: pan ? 'grabbing' : 'grab',
          bgcolor: 'background.default', fontFamily: theme.typography.fontFamily,
          '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
        }}
      >
        {children}
      </Box>
      <CanvasDock
        zoom={view.zoom}
        onZoomIn={() => zoomTo(stepZoom(view.zoom, 'in'))}
        onZoomOut={() => zoomTo(stepZoom(view.zoom, 'out'))}
        onFit={view.fitNow}
        onHome={() => zoomTo(1)}
        {...(overview && overflows ? { map: { on: mapOn, onToggle: () => setMapOn((on) => !on) } } : {})}
        extra={dockExtra}
        data-testid="picture-dock"
      />
      {overview && overflows && mapOn && <Overview frame={frame} content={content} nodes={overview.nodes} slot={overview.slot} zoom={view.zoom} s={s ?? said} />}
    </div>
  )
}

function Headings({ picture, hereLabel, large, s }: { picture: SectionedPicture; hereLabel: string; large: boolean; s: Translate }) {
  const theme = useTheme()
  const head = { fontSize: 'var(--t-small)', fontWeight: 600, style: { textTransform: 'uppercase' as const, letterSpacing: '.09em' } }
  return (
    <g data-testid="picture-headings">
      {picture.lanes.map(({ lane, x }) => (
        <text key={x} x={x + (large ? 0 : PICTURE_SIZE.small.width / 2)} y={picture.headingY} textAnchor={large ? 'start' : 'middle'} fill={theme.palette.text.secondary} {...head}>
          {s(LANE_KEY[lane])}
        </text>
      ))}
      {picture.zoneY !== undefined && (
        <>
          <text x={24} y={picture.zoneY} fill={theme.palette.info.main} {...head}>{s('observation.pictureLocal')}</text>
          <text x={picture.hereX} y={picture.zoneY} fill={theme.palette.primary.main} {...head}>{hereLabel}</text>
        </>
      )}
    </g>
  )
}

function Boundaries({ picture, scopeLabel, s }: { picture: SectionedPicture; scopeLabel: (path: string) => string; s: Translate }) {
  const theme = useTheme()
  const { info } = theme.palette
  return (
    <g>
      {picture.boundaries.map((box) => (
        <g key={box.scope} data-testid="picture-boundary" data-scope={box.scope}>
          <rect x={box.x} y={box.y} width={box.width} height={box.height} rx={12} fill={info.main} fillOpacity={0.05} stroke={info.main} strokeWidth={1.2} />
          <text x={box.x + 14} y={box.y + 22} fontSize={12} fontWeight={600} fill={info.main}>{scopeLabel(box.scope)}</text>
          <text x={box.x + box.width - 14} y={box.y + 22} fontSize={11} textAnchor="end" fill={theme.palette.text.secondary}>
            {s('observation.pictureBoxCounts', { observations: box.observations, causes: box.causes })}
          </text>
        </g>
      ))}
    </g>
  )
}

function Edges({ picture, here, size, traced, bright, onMenu }: {
  picture: SectionedPicture; here: string; size: PictureSize; traced?: ReadonlySet<string>; bright: ReadonlySet<string>; onMenu?: PictureMenuHandler
}) {
  const theme = useTheme()
  const byKey = useMemo(() => new Map(picture.nodes.map((node) => [node.key, node])), [picture.nodes])
  return (
    <g>
      {picture.edges.map((edge) => {
        const from = byKey.get(edge.from)!
        const to = byKey.get(edge.to)!
        const a = anchorOf(from, 'right', size)
        const b = anchorOf(to, 'left', size)
        const bend = Math.max(40, (b.x - a.x) / 2)
        const d = `M${a.x},${a.y} C${a.x + bend},${a.y} ${b.x - bend},${b.y} ${b.x},${b.y}`
        const on = traced !== undefined && traced.has(edge.from) && traced.has(edge.to)
        const plain = STROKE[edge.strength]
        const colour = on ? theme.palette.primary.main : edge.crossing ? theme.palette.info.main
          : bright.has(edge.from) && bright.has(edge.to) ? theme.palette.success.main : theme.palette.text.secondary
        // A card's line stands for lines not drawn, and has no link of its own to change.
        const menu = onMenu && to.scope === here && from.kind !== 'more' ? edgeTarget(edge, from, to, here) : undefined
        return (
          <g key={`${edge.from}->${edge.to}`}>
            <path
              d={d}
              fill="none"
              stroke={colour}
              strokeWidth={on ? 2.2 : edge.crossing ? 1.7 : plain.width}
              strokeDasharray={on ? undefined : edge.crossing ? '6 4' : plain.dash}
              strokeOpacity={traced && !on ? 0.16 : 0.75}
              data-testid="analysis-link"
              data-strength={edge.strength}
              data-crossing={edge.crossing ? 'true' : undefined}
              data-bright={bright.has(edge.from) && bright.has(edge.to) ? 'true' : undefined}
            />
            {menu && onMenu && (
              <path
                d={d} fill="none" stroke="transparent" strokeWidth={LINE_HIT_WIDTH} pointerEvents="stroke" data-testid="analysis-link-hit"
                onContextMenu={(event) => { event.preventDefault(); onMenu(menu, { x: event.clientX, y: event.clientY }) }}
              />
            )}
          </g>
        )
      })}
    </g>
  )
}

/** What a right-click on a line of this scope's is about: the link it draws. */
function edgeTarget(edge: PictureEdge, from: PictureNode, to: PictureNode, here: string) {
  if (edge.kind === 'addresses') {
    return { kind: 'addresses' as const, solutionId: recordId(to), causeId: recordId(from), strength: edge.strength }
  }
  return {
    kind: 'explains' as const, causeId: recordId(to), id: recordId(from),
    ...(from.scope !== here ? { scope: from.scope } : {}), strength: edge.strength,
  }
}

type NodesProps = AnalysisPictureProps & {
  picture: SectionedPicture
  size: PictureSize
  open: ReadonlySet<string>
  traced?: ReadonlySet<string>
  hot?: string
  onHot: (key: string | undefined) => void
}

/** The marker on a cause where a link leaves the picture: explained from above, or explaining causes below not drawn. */
function markerOf(node: PictureNode, props: NodesProps, drawn: ReadonlySet<string>): string | undefined {
  if (node.kind !== 'cause') return undefined
  // A cause above that is drawn has its line; one that is not is said on the card.
  const above = props.explainedAbove?.(node.scope)?.get(node.cause.id)
    ?.filter((one) => !drawn.has(pictureKey(props.here, one.scope, one.cause.id)))
  if (above && above.length > 0) {
    return props.s('observation.pictureFromAbove', { label: causeLabel(above[0].cause), scope: props.scopeLabel(above[0].scope) })
  }
  const away = node.cause.explains.filter((link) => link.scope !== undefined && !drawn.has(pictureKey(props.here, link.scope, link.id))).length
  return away > 0 ? props.s('observation.pictureToBelow', { count: away }) : undefined
}

/** A card a line may be drawn from: what can be asked why of. A root cause ends the chain, and a solution has none behind it. */
const asksWhy = (node: PictureNode) => node.kind === 'observation' || (node.kind === 'cause' && !node.root)

function Nodes(props: NodesProps) {
  const theme = useTheme()
  const { picture, view, traced, onSelect, onMenu, onHot, size, onAsk, onDragLink, onMore } = props
  const drawn = useMemo(() => new Set(picture.nodes.map((node) => node.key)), [picture.nodes])
  const maxSeen = Math.max(1, ...picture.nodes.map((node) => (node.kind === 'observation' ? node.observation.seen : 1)))
  const [drag, setDrag] = useState<{ from: PictureNode; x: number; y: number } | undefined>(undefined)
  const slot = PICTURE_SIZE[size]
  const press = (node: PictureNode) => (node.kind === 'more' ? onMore?.(node) : onSelect(node.key))
  const keyDown = (node: PictureNode) => (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    press(node)
  }
  const inPicture = (event: PointerEvent<Element>) => {
    const box = event.currentTarget.closest('svg')?.getBoundingClientRect()
    return { x: (event.clientX - (box?.left ?? 0)) / view.zoom, y: (event.clientY - (box?.top ?? 0)) / view.zoom }
  }
  return (
    <g>
      {picture.nodes.map((node) => (
        // The + stands beside the card and not in it: a button inside a button is reached by nobody's keyboard.
        <g key={node.key} transform={`translate(${node.x},${node.y})`} onMouseEnter={() => onHot(node.key)} onMouseLeave={() => onHot(undefined)}>
        <g
          role="button"
          tabIndex={0}
          aria-label={node.kind === 'more'
            ? (node.more === 'fold' ? props.s('observation.mapMore', { count: node.count }) : props.s('observation.mapPile', { count: node.count }))
            : `${recordLabel(node)} ${recordTitle(node)}`}
          aria-describedby={props.hot === node.key ? 'analysis-hover' : undefined}
          data-testid={`analysis-${node.kind}`}
          data-key={node.key}
          data-root={node.kind === 'cause' && node.root ? 'true' : undefined}
          data-dimmed={traced && !traced.has(node.key) ? 'true' : undefined}
          style={traced && !traced.has(node.key) ? { ...DIMMED, cursor: 'pointer' } : { cursor: 'pointer' }}
          onClick={() => press(node)}
          onKeyDown={keyDown(node)}
          onFocus={() => onHot(node.key)}
          onBlur={() => onHot(undefined)}
          onContextMenu={onMenu && node.kind !== 'more' ? (event) => {
            event.preventDefault()
            onMenu({ kind: 'node', key: node.key }, { x: event.clientX, y: event.clientY })
          } : undefined}
        >
          <RecordMark
            node={node}
            size={size}
            zoom={view.zoom}
            selected={node.key === props.selectedKey}
            matched={(props.filter?.filtering ?? false) && (props.filter?.matched.has(node.key) ?? false)}
            openEnd={props.open.has(node.key)}
            marker={markerOf(node, props, drawn)}
            fill={node.kind === 'observation' ? seenTint(theme, node.observation.seen, maxSeen, toneOf(node.observation)) : theme.palette.background.paper}
            s={props.s}
          />
        </g>
          {size !== 'small' && onAsk && asksWhy(node) && (props.hot === node.key || node.key === props.selectedKey) && (
            <g
              role="button" tabIndex={0} aria-label={props.s('observation.mapHandle')} data-testid="analysis-handle" data-handle={node.key}
              transform={`translate(${slot.width},${slot.height / 2})`} style={{ cursor: 'crosshair' }}
              onClick={() => onAsk(node.key)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onAsk(node.key) } }}
              onPointerDown={(event) => {
                if (!onDragLink) return
                event.stopPropagation()
                event.currentTarget.setPointerCapture?.(event.pointerId)
                setDrag({ from: node, ...inPicture(event) })
              }}
              onPointerMove={(event) => { if (drag) setDrag({ from: drag.from, ...inPicture(event) }) }}
              onPointerUp={(event) => {
                if (!drag) return
                setDrag(undefined)
                const hit = document.elementsFromPoint?.(event.clientX, event.clientY)
                  .map((one) => one.closest('[data-key]')?.getAttribute('data-key')).find((key) => key && key !== node.key)
                if (hit) onDragLink?.(node.key, hit)
              }}
            >
              <circle r={9} fill={theme.palette.primary.main} />
              <path d="M-4 0H4M0 -4V4" stroke={theme.palette.primary.contrastText} strokeWidth={1.6} />
            </g>
          )}
        </g>
      ))}
      {drag && (
        <line
          x1={drag.from.x + slot.width} y1={drag.from.y + slot.height / 2} x2={drag.x} y2={drag.y}
          stroke={theme.palette.primary.main} strokeWidth={1.6} strokeDasharray="4 3" pointerEvents="none"
        />
      )}
    </g>
  )
}

/** The full title, the label, what it is and the scope, under the record hovered or focused. */
function HoverCard({ node, picture, zoom, size, scopeLabel, s }: {
  node: PictureNode; picture: SectionedPicture; zoom: number; size: PictureSize; scopeLabel: (path: string) => string; s: Translate
}) {
  const { language } = useStrings()
  const slot = PICTURE_SIZE[size]
  const left = Math.min(Math.max(0, (node.x + slot.width / 2) * zoom - 150), Math.max(0, picture.width * zoom - 300))
  return (
    <Box
      id="analysis-hover"
      role="tooltip"
      data-testid="analysis-hover"
      sx={{
        position: 'absolute', left, top: (node.y + slot.height) * zoom + 6, width: 300, pointerEvents: 'none', zIndex: 1,
        bgcolor: 'text.primary', color: 'background.paper', borderRadius: 1, px: 1.25, py: 0.75, boxShadow: 4, fontSize: 'var(--t-small)', lineHeight: 1.4,
      }}
    >
      <b>{recordLabel(node)}</b> {recordTitle(node)}
      <Box sx={{ fontSize: 'var(--t-small)', mt: 0.25 }}>{recordState(node, s, language)} · {scopeLabel(node.scope)}</Box>
    </Box>
  )
}

/** What the marks mean, said once under the picture, for the size it is drawn in. */
export function PictureLegend({ size, local, s }: { size: PictureSize; local: boolean; s: Translate }) {
  const theme = useTheme()
  const { palette } = theme
  const row = (glyph: ReactNode, text: string) => (
    <Box key={text} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <svg width={26} height={14} aria-hidden>{glyph}</svg>
      <Typography variant="caption" color="text.secondary">{text}</Typography>
    </Box>
  )
  const box = (stroke: string, over: { dash?: string; width?: number; rx?: number; fill?: string } = {}) => (
    <rect x={2} y={2} width={22} height={10} rx={over.rx ?? 3} fill={over.fill ?? 'none'} stroke={stroke} strokeWidth={over.width ?? 1.4} strokeDasharray={over.dash} />
  )
  const ring = (stroke: string, over: { dash?: string; double?: boolean } = {}) => (
    <>
      <circle cx={13} cy={7} r={6} fill="none" stroke={stroke} strokeWidth={1.4} strokeDasharray={over.dash} />
      {over.double && <circle cx={13} cy={7} r={3} fill="none" stroke={stroke} strokeWidth={1} />}
    </>
  )
  const solutionFill = palette.background.paper
  const rows = size !== 'small' ? [
    row(<><rect x={2} y={2} width={22} height={10} rx={3} fill="none" stroke={palette.text.secondary} /><rect x={2} y={2} width={4} height={10} fill={palette.error.main} /></>, s('observation.legendStripe')),
    row(box(palette.success.main, { width: 1.8 }), s('observation.legendBright')),
    row(box(palette.warning.main, { dash: '3 2' }), s('observation.legendAssumed')),
    row(box(palette.success.main), s('observation.legendVerified')),
    row(box(palette.secondary.main, { width: 2.4, rx: 6 }), s('observation.legendRoot')),
    row(box(palette.primary.main, { fill: solutionFill }), s('observation.legendSolution')),
  ] : [
    row(<><circle cx={7} cy={7} r={4} fill={palette.primary.main} /><circle cx={19} cy={7} r={6} fill={palette.primary.main} /></>, s('observation.legendCircle')),
    row(<circle cx={13} cy={7} r={6} fill={palette.success.main} />, s('observation.legendBright')),
    row(ring(palette.text.secondary), s('observation.legendHollow')),
    row(ring(palette.warning.main, { dash: '3 2' }), s('observation.legendAssumed')),
    row(ring(palette.success.main), s('observation.legendVerified')),
    row(ring(palette.secondary.main, { double: true }), s('observation.legendDoubleRing')),
    row(<rect x={8} y={2} width={10} height={10} rx={2} fill={solutionFill} stroke={palette.primary.main} />, s('observation.legendSquare')),
  ]
  return (
    <Box data-testid="analysis-legend" data-size={size} sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
      {rows}
      {row(<><circle cx={13} cy={7} r={6} fill={palette.background.paper} stroke={palette.warning.main} /><text x={13} y={7} dy="0.35em" textAnchor="middle" fontSize={9} fontWeight={700} fill={palette.warning.main}>?</text></>, s('observation.legendOpenEnd'))}
      {row(<><line x1={1} y1={3} x2={25} y2={3} stroke={palette.text.secondary} strokeWidth={3} /><line x1={1} y1={7} x2={25} y2={7} stroke={palette.text.secondary} strokeWidth={1.5} /><line x1={1} y1={11} x2={25} y2={11} stroke={palette.text.secondary} strokeDasharray="3 3" /></>, s('observation.legendStrength'))}
      {local && row(box(palette.info.main), s('observation.legendScopeBelow'))}
      {local && row(<line x1={1} y1={7} x2={25} y2={7} stroke={palette.info.main} strokeWidth={1.7} strokeDasharray="6 4" />, s('observation.legendAcross'))}
    </Box>
  )
}
