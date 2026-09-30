// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The analysis drawn (ADR-0021, ADR-0032 §8): observations on the left, the
 * causes they were analysed into in the lanes to the right, root causes, and
 * the solutions that address them last — and, with *View local* on, each
 * scope below in a boundary of its own to the left, nested as the tree
 * nests, with the lines that cross a boundary drawn apart.
 *
 * Plain SVG over `analysisPicture` (`graph.ts`): no canvas library, nothing
 * dragged, the same records in the same place every time. Each record is one
 * of two sizes (`PictureMarks`). The picture starts fitted to its window;
 * the zoom buttons and ⌘ or Ctrl with the scroll wheel zoom it, and a drag on
 * the background pans it. Hovering a record — or focusing it from the
 * keyboard — traces its chain both ways and dims the rest, and shows its full
 * title, label and scope beside it, so a title cut short on a card is always
 * one hover from whole.
 *
 * Clicking anything selects it; Enter or Space does the same from the
 * keyboard. A right-click on a record or a line asks the page what can be
 * done with it (`PictureMenu`); a line offers its menu only where the link is
 * this scope's to change.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import type { Translate } from '../../i18n'
import { analysisPicture, fitZoom, openEnds, pictureKey, traceChain, PICTURE_SIZE } from '../graph'
import type { PictureEdge, PictureLane, PictureNode, SectionedPicture } from '../graph'
import { causeLabel } from '../observation'
import type { CauseAbove, ScopeAnalysis } from '../observation'
import type { FilterResult } from '../filter'
import { LINE_HIT_WIDTH, STROKE, seenTint } from './ChainMarks'
import type { PictureMenuHandler } from './PictureMenu'
import { RecordMark, anchorOf, recordLabel, recordState, recordTitle } from './PictureMarks'
import type { PictureView } from './usePictureFilters'

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
  s: Translate
}

const LANE_KEY: Record<PictureLane, 'observation.laneObservations' | 'observation.laneCauses' | 'observation.laneDeeper' | 'observation.laneRoots' | 'observation.laneSolutions'> = {
  observations: 'observation.laneObservations',
  causes: 'observation.laneCauses',
  deeper: 'observation.laneDeeper',
  roots: 'observation.laneRoots',
  solutions: 'observation.laneSolutions',
}

/** A record's own id, as the lists and the page's menus name it. */
export function recordId(node: PictureNode): string {
  return node.kind === 'observation' ? node.observation.id : node.kind === 'cause' ? node.cause.id : node.solution.id
}

export function AnalysisPicture(props: AnalysisPictureProps) {
  const { scopes, here, view, s } = props
  const visible = props.filter?.filtering ? props.filter.visible : undefined
  const picture = useMemo(
    () => analysisPicture(scopes, { here, size: view.size, ...(visible ? { visible } : {}) }),
    [scopes, here, view.size, visible],
  )
  const open = useMemo(() => openEnds(scopes, here, props.explainedAbove), [scopes, here, props.explainedAbove])
  const [hot, setHot] = useState<string | undefined>(undefined)
  const traced = useMemo(() => (hot ? traceChain(hot, picture.edges) : undefined), [hot, picture.edges])
  const hotNode = hot ? picture.nodes.find((node) => node.key === hot) : undefined

  return (
    <PictureFrame picture={picture} view={view} label={s('observation.tabAnalysis')}>
      {picture.nodes.length === 0 ? (
        <Box sx={{ p: 5, color: 'text.secondary' }}>
          <Typography>{visible ? s('observation.filterNothing') : s('observation.graphEmpty')}</Typography>
        </Box>
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
            <Headings picture={picture} hereLabel={props.hereLabel} s={s} large={view.size === 'large'} />
            <Boundaries picture={picture} scopeLabel={props.scopeLabel} s={s} />
            <Edges picture={picture} here={here} large={view.size === 'large'} traced={traced} onMenu={props.onMenu} />
            <Nodes {...props} picture={picture} open={open} traced={traced} hot={hot} onHot={setHot} />
          </svg>
          {hotNode && <HoverCard node={hotNode} picture={picture} zoom={view.zoom} large={view.size === 'large'} scopeLabel={props.scopeLabel} s={s} />}
        </Box>
      )}
    </PictureFrame>
  )
}

/**
 * The window the picture is looked at through: it measures itself to fit,
 * zooms with ⌘ or Ctrl and the scroll wheel, and pans with a drag on the
 * background. Scrollable, so it takes the keyboard's arrows as well.
 */
function PictureFrame({ picture, view, label, children }: { picture: SectionedPicture; view: PictureView; label: string; children: ReactNode }) {
  const theme = useTheme()
  const frame = useRef<HTMLDivElement>(null)
  const latest = useRef(view)
  latest.current = view
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [pan, setPan] = useState<{ x: number; y: number; left: number; top: number } | undefined>(undefined)

  useEffect(() => {
    const element = frame.current
    if (!element) return undefined
    const measure = () => setViewport({ width: element.clientWidth, height: element.clientHeight })
    measure()
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      latest.current.zoomTo(latest.current.zoom * (event.deltaY < 0 ? 1.1 : 0.9))
    }
    element.addEventListener('wheel', wheel, { passive: false })
    // Absent under a test's DOM, which never resizes.
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(element)
    return () => {
      element.removeEventListener('wheel', wheel)
      observer?.disconnect()
    }
  }, [])

  const { fit, fitted } = view
  useEffect(() => {
    if (fit) fitted(fitZoom(picture, viewport))
  }, [fit, fitted, picture, viewport])

  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as Element).closest('[data-key]')) return
    const element = event.currentTarget
    setPan({ x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop })
    element.setPointerCapture?.(event.pointerId)
  }
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!pan) return
    event.currentTarget.scrollLeft = pan.left - (event.clientX - pan.x)
    event.currentTarget.scrollTop = pan.top - (event.clientY - pan.y)
  }
  return (
    <Box
      ref={frame}
      role="region"
      aria-label={label}
      tabIndex={0}
      data-testid="analysis-frame"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={() => setPan(undefined)}
      onPointerCancel={() => setPan(undefined)}
      sx={{
        flex: 1, minHeight: 0, overflow: 'auto', position: 'relative', cursor: pan ? 'grabbing' : 'grab',
        bgcolor: 'background.default', fontFamily: theme.typography.fontFamily,
        backgroundImage: `radial-gradient(${theme.palette.divider} 1px, transparent 1px)`, backgroundSize: '18px 18px',
        '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
      }}
    >
      {children}
    </Box>
  )
}

function Headings({ picture, hereLabel, large, s }: { picture: SectionedPicture; hereLabel: string; large: boolean; s: Translate }) {
  const theme = useTheme()
  const head = { fontSize: 10, fontWeight: 600, style: { textTransform: 'uppercase' as const, letterSpacing: '.09em' } }
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

function Edges({ picture, here, large, traced, onMenu }: {
  picture: SectionedPicture; here: string; large: boolean; traced?: ReadonlySet<string>; onMenu?: PictureMenuHandler
}) {
  const theme = useTheme()
  const byKey = useMemo(() => new Map(picture.nodes.map((node) => [node.key, node])), [picture.nodes])
  const size = large ? 'large' : 'small'
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
        const colour = on ? theme.palette.primary.main : edge.crossing ? theme.palette.info.main : theme.palette.text.secondary
        const menu = onMenu && to.scope === here ? edgeTarget(edge, from, to, here) : undefined
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

function Nodes(props: NodesProps) {
  const theme = useTheme()
  const { picture, view, traced, onSelect, onMenu, onHot } = props
  const drawn = useMemo(() => new Set(picture.nodes.map((node) => node.key)), [picture.nodes])
  const maxSeen = Math.max(1, ...picture.nodes.map((node) => (node.kind === 'observation' ? node.observation.seen : 1)))
  const keyDown = (key: string) => (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onSelect(key)
  }
  return (
    <g>
      {picture.nodes.map((node) => (
        <g
          key={node.key}
          transform={`translate(${node.x},${node.y})`}
          role="button"
          tabIndex={0}
          aria-label={`${recordLabel(node)} ${recordTitle(node)}`}
          aria-describedby={props.hot === node.key ? 'analysis-hover' : undefined}
          data-testid={`analysis-${node.kind}`}
          data-key={node.key}
          data-root={node.kind === 'cause' && node.root ? 'true' : undefined}
          opacity={traced && !traced.has(node.key) ? 0.16 : 1}
          style={{ cursor: 'pointer' }}
          onClick={() => onSelect(node.key)}
          onKeyDown={keyDown(node.key)}
          onMouseEnter={() => onHot(node.key)}
          onMouseLeave={() => onHot(undefined)}
          onFocus={() => onHot(node.key)}
          onBlur={() => onHot(undefined)}
          onContextMenu={onMenu ? (event) => {
            event.preventDefault()
            onMenu({ kind: 'node', key: node.key }, { x: event.clientX, y: event.clientY })
          } : undefined}
        >
          <RecordMark
            node={node}
            size={view.size}
            selected={node.key === props.selectedKey}
            matched={(props.filter?.filtering ?? false) && (props.filter?.matched.has(node.key) ?? false)}
            openEnd={props.open.has(node.key)}
            marker={markerOf(node, props, drawn)}
            fill={node.kind === 'observation' ? seenTint(theme, node.observation.seen, maxSeen) : theme.palette.background.paper}
            s={props.s}
          />
        </g>
      ))}
    </g>
  )
}

/** The full title, the label, what it is and the scope, under the record hovered or focused. */
function HoverCard({ node, picture, zoom, large, scopeLabel, s }: {
  node: PictureNode; picture: SectionedPicture; zoom: number; large: boolean; scopeLabel: (path: string) => string; s: Translate
}) {
  const slot = PICTURE_SIZE[large ? 'large' : 'small']
  const left = Math.min(Math.max(0, (node.x + slot.width / 2) * zoom - 150), Math.max(0, picture.width * zoom - 300))
  return (
    <Box
      id="analysis-hover"
      role="tooltip"
      data-testid="analysis-hover"
      sx={{
        position: 'absolute', left, top: (node.y + slot.height) * zoom + 6, width: 300, pointerEvents: 'none', zIndex: 1,
        bgcolor: 'text.primary', color: 'background.paper', borderRadius: 1, px: 1.25, py: 0.75, boxShadow: 4, fontSize: 12.5, lineHeight: 1.4,
      }}
    >
      <b>{recordLabel(node)}</b> {recordTitle(node)}
      <Box sx={{ fontSize: 11.5, mt: 0.25 }}>{recordState(node, s)} · {scopeLabel(node.scope)}</Box>
    </Box>
  )
}

/** What the marks mean, said once under the picture, for the size it is drawn in. */
export function PictureLegend({ size, local, s }: { size: 'large' | 'small'; local: boolean; s: Translate }) {
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
  const rows = size === 'large' ? [
    row(<><rect x={2} y={2} width={22} height={10} rx={3} fill="none" stroke={palette.text.secondary} /><rect x={2} y={2} width={4} height={10} fill={palette.error.main} /></>, s('observation.legendStripe')),
    row(box(palette.warning.main, { dash: '3 2' }), s('observation.legendAssumed')),
    row(box(palette.success.main), s('observation.legendVerified')),
    row(box(palette.secondary.main, { width: 2.4, rx: 6 }), s('observation.legendRoot')),
    row(box(palette.primary.main, { fill: solutionFill }), s('observation.legendSolution')),
  ] : [
    row(<><circle cx={7} cy={7} r={4} fill={palette.primary.main} /><circle cx={19} cy={7} r={6} fill={palette.primary.main} /></>, s('observation.legendCircle')),
    row(ring(palette.text.secondary), s('observation.legendHollow')),
    row(ring(palette.warning.main, { dash: '3 2' }), s('observation.legendAssumed')),
    row(ring(palette.success.main), s('observation.legendVerified')),
    row(ring(palette.secondary.main, { double: true }), s('observation.legendDoubleRing')),
    row(<rect x={8} y={2} width={10} height={10} rx={2} fill={solutionFill} stroke={palette.primary.main} />, s('observation.legendSquare')),
  ]
  return (
    <Box data-testid="analysis-legend" data-size={size} sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, px: 2, py: 1, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      {rows}
      {row(<><circle cx={13} cy={7} r={6} fill={palette.background.paper} stroke={palette.warning.main} /><text x={13} y={7} dy="0.35em" textAnchor="middle" fontSize={9} fontWeight={700} fill={palette.warning.main}>?</text></>, s('observation.legendOpenEnd'))}
      {row(<><line x1={1} y1={3} x2={25} y2={3} stroke={palette.text.secondary} strokeWidth={3} /><line x1={1} y1={7} x2={25} y2={7} stroke={palette.text.secondary} strokeWidth={1.5} /><line x1={1} y1={11} x2={25} y2={11} stroke={palette.text.secondary} strokeDasharray="3 3" /></>, s('observation.legendStrength'))}
      {local && row(box(palette.info.main), s('observation.legendScopeBelow'))}
      {local && row(<line x1={1} y1={7} x2={25} y2={7} stroke={palette.info.main} strokeWidth={1.7} strokeDasharray="6 4" />, s('observation.legendAcross'))}
    </Box>
  )
}
