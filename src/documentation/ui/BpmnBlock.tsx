/**
 * A ```bpmn fence, drawn (plan step 14).
 *
 * The reading is `bpmn.ts`'s and is pure; this turns a drawing into SVG — a
 * pool into a rectangle with its name on end, a task into a rounded box, an
 * event into a circle whose stroke says start or end and whose glyph says
 * what triggers it, a gateway into a diamond with its marker, a flow into a
 * polyline with an arrowhead. Read-only: nothing here is dragged, and the
 * notation's own coordinates are honoured as written.
 *
 * Whenever the fence cannot be drawn its source is shown instead, under a
 * line saying why — a process that fails to render must never take its text
 * with it, the rule the mermaid block already keeps.
 *
 * No library. The mermaid block loads mermaid the first time it draws, and
 * that is the one heavy dependency the shell carries; the BPMN core is a few
 * shapes with well-known geometry, and a viewer that ships a modeller's
 * runtime to draw twelve rectangles would be the wrong trade.
 */
import { useId, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { useStrings } from '../../i18n'
import type { StringKey } from '../../i18n'
import { readBpmn, wrapLabel } from '../bpmn'
import type { BpmnDrawing, BpmnRefusal, Edge, Point, Shape } from '../bpmn'

const CODE_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
const FONT = 12
const LINE = 14
/** Around the drawing, so a stroke on the edge is not clipped. */
const PADDING = 12
/** A pool's or lane's name band. */
const BAND = 30

const WHY: Record<BpmnRefusal, StringKey> = {
  'bpmn.malformed': 'doc.bpmnMalformed',
  'bpmn.notBpmn': 'doc.bpmnNotBpmn',
  'bpmn.noDiagram': 'doc.bpmnNoDiagram',
}

export type BpmnBlockProps = { code: string }

export function BpmnBlock({ code }: BpmnBlockProps) {
  const { t } = useStrings()
  const theme = useTheme()
  const read = useMemo(() => readBpmn(code), [code])
  const ids = useId()

  if (read.ok) {
    return (
      <Box
        data-testid="bpmn-block" data-wide="" data-state="drawn"
        sx={{ my: '0.7em', overflowX: 'auto', '& svg': { maxWidth: '100%', height: 'auto', display: 'block' } }}
      >
        <Drawing drawing={read.drawing} theme={theme} markers={ids} />
      </Box>
    )
  }
  return (
    <Box data-testid="bpmn-block" data-wide="" data-state="failed" sx={{ my: '0.7em' }}>
      <Typography variant="caption" color="error" component="div" sx={{ mb: 0.5 }}>
        {t('doc.bpmnFailed')} {t(WHY[read.refusal])}
      </Typography>
      <Box
        component="pre"
        sx={{
          m: 0, p: '0.8em', overflowX: 'auto', borderRadius: 1, bgcolor: 'action.hover',
          fontFamily: CODE_FONT, fontSize: '0.9em', lineHeight: 1.5,
        }}
      >
        <code>{code}</code>
      </Box>
    </Box>
  )
}

type Paint = {
  stroke: string
  fill: string
  text: string
  faint: string
  /** The ids of the arrowhead markers, unique per block so two on a page do not share one. */
  arrow: string
  openArrow: string
}

function Drawing({ drawing, theme, markers }: { drawing: BpmnDrawing; theme: Theme; markers: string }) {
  const { bounds } = drawing
  const paint: Paint = {
    stroke: theme.palette.text.primary,
    fill: theme.palette.background.paper,
    text: theme.palette.text.primary,
    faint: theme.palette.divider,
    arrow: `${markers}-arrow`,
    openArrow: `${markers}-open`,
  }
  const x = bounds.x - PADDING
  const y = bounds.y - PADDING
  const width = bounds.width + PADDING * 2
  const height = bounds.height + PADDING * 2
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${x} ${y} ${width} ${height}`}
      width={width}
      height={height}
      fontFamily="inherit"
      fontSize={FONT}
      role="img"
    >
      <defs>
        <marker id={paint.arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={paint.stroke} />
        </marker>
        <marker id={paint.openArrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={paint.fill} stroke={paint.stroke} strokeWidth="1.2" />
        </marker>
      </defs>
      {drawing.shapes.map((shape) => <ShapeView key={shape.id} shape={shape} paint={paint} />)}
      {drawing.edges.map((edge) => <EdgeView key={edge.id} edge={edge} paint={paint} />)}
    </svg>
  )
}

/** A label, wrapped, centred on a point or left-aligned at one. */
function Label({ text, at, width, anchor = 'middle', paint, bold }: {
  text: string
  at: Point
  width: number
  anchor?: 'middle' | 'start'
  paint: Paint
  bold?: boolean
}) {
  const lines = wrapLabel(text, width)
  const top = at.y - ((lines.length - 1) * LINE) / 2
  return (
    <text fill={paint.text} textAnchor={anchor} fontWeight={bold ? 600 : 400} dominantBaseline="middle">
      {lines.map((line, index) => (
        <tspan key={index} x={at.x} y={top + index * LINE}>{line}</tspan>
      ))}
    </text>
  )
}

function ShapeView({ shape, paint }: { shape: Shape; paint: Paint }) {
  const { x, y, width, height } = shape.bounds
  const centre = { x: x + width / 2, y: y + height / 2 }
  const common = { 'data-shape': shape.kind, 'data-id': shape.id } as const

  switch (shape.kind) {
    case 'participant':
    case 'lane': {
      const pool = shape.kind === 'participant'
      const band = shape.vertical
        ? <rect x={x} y={y} width={width} height={BAND} fill="none" stroke={paint.stroke} strokeWidth={pool ? 1.5 : 1} />
        : <rect x={x} y={y} width={BAND} height={height} fill="none" stroke={paint.stroke} strokeWidth={pool ? 1.5 : 1} />
      const label = shape.name && (shape.vertical
        ? <Label text={shape.name} at={{ x: centre.x, y: y + BAND / 2 }} width={width - 8} paint={paint} bold={pool} />
        : (
          <g transform={`translate(${x + BAND / 2} ${centre.y}) rotate(-90)`}>
            <Label text={shape.name} at={{ x: 0, y: 0 }} width={height - 8} paint={paint} bold={pool} />
          </g>
        ))
      return (
        <g {...common}>
          <rect x={x} y={y} width={width} height={height} fill={pool ? paint.fill : 'none'} stroke={paint.stroke} strokeWidth={pool ? 1.5 : 1} />
          {shape.name && band}
          {label}
        </g>
      )
    }
    case 'group':
      return (
        <g {...common}>
          <rect x={x} y={y} width={width} height={height} rx={8} fill="none" stroke={paint.stroke} strokeDasharray="8 3 1 3" />
          {shape.name && <Label text={shape.name} at={{ x: x + 8, y: y + 12 }} width={width - 16} anchor="start" paint={paint} />}
        </g>
      )
    case 'task':
      return (
        <g {...common}>
          <rect x={x} y={y} width={width} height={height} rx={10} fill={paint.fill} stroke={paint.stroke} strokeWidth={1.5} />
          {shape.taskType === 'callActivity' && (
            <rect x={x + 1.5} y={y + 1.5} width={width - 3} height={height - 3} rx={8} fill="none" stroke={paint.stroke} strokeWidth={1.5} />
          )}
          <TaskGlyph type={shape.taskType} at={{ x: x + 6, y: y + 6 }} paint={paint} />
          {shape.name && <Label text={shape.name} at={centre} width={width - 12} paint={paint} />}
        </g>
      )
    case 'subProcess':
      return (
        <g {...common}>
          <rect x={x} y={y} width={width} height={height} rx={10} fill={shape.expanded ? 'none' : paint.fill} stroke={paint.stroke} strokeWidth={1.5} />
          {shape.name && (shape.expanded
            ? <Label text={shape.name} at={{ x: x + 10, y: y + 12 }} width={width - 20} anchor="start" paint={paint} />
            : <Label text={shape.name} at={{ x: centre.x, y: centre.y - 6 }} width={width - 12} paint={paint} />)}
          {!shape.expanded && (
            <g transform={`translate(${centre.x - 7} ${y + height - 18})`}>
              <rect width={14} height={14} fill="none" stroke={paint.stroke} />
              <path d="M7 3 V11 M3 7 H11" stroke={paint.stroke} strokeWidth={1.5} />
            </g>
          )}
        </g>
      )
    case 'event': {
      const r = Math.min(width, height) / 2
      const end = shape.eventPosition === 'end'
      const double = shape.eventPosition === 'intermediate' || shape.eventPosition === 'boundary'
      const labelAt = shape.label
        ? { x: shape.label.x + shape.label.width / 2, y: shape.label.y + shape.label.height / 2 }
        : { x: centre.x, y: y + height + 10 }
      return (
        <g {...common}>
          <circle cx={centre.x} cy={centre.y} r={r} fill={paint.fill} stroke={paint.stroke} strokeWidth={end ? 3 : 1.5} />
          {double && <circle cx={centre.x} cy={centre.y} r={r - 3} fill="none" stroke={paint.stroke} strokeWidth={1.5} />}
          <EventGlyph trigger={shape.eventTrigger} at={centre} r={r} throwing={shape.throwing === true} paint={paint} />
          {shape.name && <Label text={shape.name} at={labelAt} width={shape.label?.width ?? 90} paint={paint} />}
        </g>
      )
    }
    case 'gateway': {
      const points = `${centre.x},${y} ${x + width},${centre.y} ${centre.x},${y + height} ${x},${centre.y}`
      const labelAt = shape.label
        ? { x: shape.label.x + shape.label.width / 2, y: shape.label.y + shape.label.height / 2 }
        : { x: centre.x, y: y - 10 }
      return (
        <g {...common}>
          <polygon points={points} fill={paint.fill} stroke={paint.stroke} strokeWidth={1.5} />
          <GatewayGlyph type={shape.gatewayType} at={centre} r={Math.min(width, height) / 2} paint={paint} />
          {shape.name && <Label text={shape.name} at={labelAt} width={shape.label?.width ?? 120} paint={paint} />}
        </g>
      )
    }
    case 'dataObject': {
      const fold = 10
      const d = `M${x} ${y} H${x + width - fold} L${x + width} ${y + fold} V${y + height} H${x} Z`
      return (
        <g {...common}>
          <path d={d} fill={paint.fill} stroke={paint.stroke} strokeWidth={1.5} />
          <path d={`M${x + width - fold} ${y} V${y + fold} H${x + width}`} fill="none" stroke={paint.stroke} strokeWidth={1.5} />
          {shape.name && <Label text={shape.name} at={{ x: centre.x, y: y + height + 10 }} width={90} paint={paint} />}
        </g>
      )
    }
    case 'dataStore': {
      const ry = Math.min(8, height / 6)
      return (
        <g {...common}>
          <path
            d={`M${x} ${y + ry} A${width / 2} ${ry} 0 0 1 ${x + width} ${y + ry} V${y + height - ry} A${width / 2} ${ry} 0 0 1 ${x} ${y + height - ry} Z`}
            fill={paint.fill} stroke={paint.stroke} strokeWidth={1.5}
          />
          <path d={`M${x} ${y + ry} A${width / 2} ${ry} 0 0 0 ${x + width} ${y + ry}`} fill="none" stroke={paint.stroke} strokeWidth={1.5} />
          {shape.name && <Label text={shape.name} at={{ x: centre.x, y: y + height + 10 }} width={90} paint={paint} />}
        </g>
      )
    }
    case 'annotation':
      return (
        <g {...common}>
          <path d={`M${x + 12} ${y} H${x} V${y + height} H${x + 12}`} fill="none" stroke={paint.stroke} strokeWidth={1.5} />
          {shape.name && <Label text={shape.name} at={{ x: x + 8, y: centre.y }} width={width - 12} anchor="start" paint={paint} />}
        </g>
      )
    default:
      return (
        <g {...common}>
          <rect x={x} y={y} width={width} height={height} fill={paint.fill} stroke={paint.stroke} strokeDasharray="4 3" />
          {shape.name && <Label text={shape.name} at={centre} width={width - 12} paint={paint} />}
        </g>
      )
  }
}

/** The small glyph in a task's corner that says what kind of work it is. */
function TaskGlyph({ type, at, paint }: { type: Shape['taskType']; at: Point; paint: Paint }) {
  const g = { transform: `translate(${at.x} ${at.y})`, fill: 'none', stroke: paint.stroke, strokeWidth: 1.2 } as const
  switch (type) {
    case 'userTask':
      return <g {...g}><circle cx={7} cy={4.5} r={3} /><path d="M1.5 13 A5.5 5.5 0 0 1 12.5 13" /></g>
    case 'serviceTask':
      return <g {...g}><circle cx={7} cy={7} r={3} /><circle cx={7} cy={7} r={6} strokeDasharray="2 2" /></g>
    case 'scriptTask':
      return <g {...g}><path d="M2 2 H12 M2 6 H12 M2 10 H9" /></g>
    case 'manualTask':
      return <g {...g}><path d="M1 8 H8 M1 8 V5 A2 2 0 0 1 5 5 V8 M8 8 V4 A1.5 1.5 0 0 1 11 4 V11" /></g>
    case 'sendTask':
      return <g {...g}><rect x={1} y={2} width={12} height={9} fill={paint.stroke} /><path d="M1 2 L7 7 L13 2" stroke={paint.fill} /></g>
    case 'receiveTask':
      return <g {...g}><rect x={1} y={2} width={12} height={9} /><path d="M1 2 L7 7 L13 2" /></g>
    case 'businessRuleTask':
      return <g {...g}><rect x={1} y={2} width={12} height={9} /><path d="M1 5 H13 M5 5 V11" /></g>
    default:
      return null
  }
}

/** What triggers an event, drawn inside its circle; filled when it throws. */
function EventGlyph({ trigger, at, r, throwing, paint }: {
  trigger: Shape['eventTrigger']; at: Point; r: number; throwing: boolean; paint: Paint
}) {
  const s = r * 0.55
  const fill = throwing ? paint.stroke : 'none'
  const g = { fill, stroke: paint.stroke, strokeWidth: 1.2 } as const
  switch (trigger) {
    case 'message':
      return (
        <g {...g}>
          <rect x={at.x - s} y={at.y - s * 0.7} width={s * 2} height={s * 1.4} />
          <path d={`M${at.x - s} ${at.y - s * 0.7} L${at.x} ${at.y + s * 0.1} L${at.x + s} ${at.y - s * 0.7}`} stroke={throwing ? paint.fill : paint.stroke} fill="none" />
        </g>
      )
    case 'timer':
      return (
        <g {...g} fill="none">
          <circle cx={at.x} cy={at.y} r={s} />
          <path d={`M${at.x} ${at.y - s * 0.6} V${at.y} H${at.x + s * 0.5}`} />
        </g>
      )
    case 'error':
      return <path d={`M${at.x - s} ${at.y + s} L${at.x - s * 0.3} ${at.y - s} L${at.x + s * 0.2} ${at.y + s * 0.2} L${at.x + s} ${at.y - s} L${at.x + s * 0.3} ${at.y + s} L${at.x - s * 0.2} ${at.y - s * 0.2} Z`} {...g} />
    case 'signal':
      return <path d={`M${at.x} ${at.y - s} L${at.x + s} ${at.y + s * 0.8} H${at.x - s} Z`} {...g} />
    case 'terminate':
      return <circle cx={at.x} cy={at.y} r={s} fill={paint.stroke} />
    case 'conditional':
      return <g {...g} fill="none"><rect x={at.x - s * 0.8} y={at.y - s} width={s * 1.6} height={s * 2} /><path d={`M${at.x - s * 0.5} ${at.y - s * 0.5} H${at.x + s * 0.5} M${at.x - s * 0.5} ${at.y} H${at.x + s * 0.5} M${at.x - s * 0.5} ${at.y + s * 0.5} H${at.x + s * 0.5}`} /></g>
    case 'escalation':
      return <path d={`M${at.x} ${at.y - s} L${at.x + s * 0.8} ${at.y + s} L${at.x} ${at.y + s * 0.2} L${at.x - s * 0.8} ${at.y + s} Z`} {...g} />
    default:
      return null
  }
}

/** The marker inside a gateway's diamond. */
function GatewayGlyph({ type, at, r, paint }: { type: Shape['gatewayType']; at: Point; r: number; paint: Paint }) {
  const s = r * 0.45
  const g = { fill: 'none', stroke: paint.stroke, strokeWidth: 2 } as const
  switch (type) {
    case 'exclusive':
      return <path d={`M${at.x - s} ${at.y - s} L${at.x + s} ${at.y + s} M${at.x + s} ${at.y - s} L${at.x - s} ${at.y + s}`} {...g} />
    case 'parallel':
      return <path d={`M${at.x} ${at.y - s} V${at.y + s} M${at.x - s} ${at.y} H${at.x + s}`} {...g} strokeWidth={2.5} />
    case 'inclusive':
      return <circle cx={at.x} cy={at.y} r={s} {...g} />
    case 'eventBased':
      return (
        <g {...g} strokeWidth={1.2}>
          <circle cx={at.x} cy={at.y} r={s * 1.2} />
          <circle cx={at.x} cy={at.y} r={s * 0.9} />
          <polygon points={pentagon(at, s * 0.55)} />
        </g>
      )
    case 'complex':
      return <path d={`M${at.x} ${at.y - s} V${at.y + s} M${at.x - s} ${at.y} H${at.x + s} M${at.x - s * 0.7} ${at.y - s * 0.7} L${at.x + s * 0.7} ${at.y + s * 0.7} M${at.x + s * 0.7} ${at.y - s * 0.7} L${at.x - s * 0.7} ${at.y + s * 0.7}`} {...g} />
    default:
      return null
  }
}

function pentagon(at: Point, r: number): string {
  return [0, 1, 2, 3, 4]
    .map((i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return `${at.x + r * Math.cos(a)},${at.y + r * Math.sin(a)}` })
    .join(' ')
}

function EdgeView({ edge, paint }: { edge: Edge; paint: Paint }) {
  const points = edge.waypoints.map((point) => `${point.x},${point.y}`).join(' ')
  const [first, second] = edge.waypoints
  const dash = edge.kind === 'message' ? '6 4' : edge.kind === 'sequence' ? undefined : '2 3'
  const head = edge.kind === 'message' ? `url(#${paint.openArrow})`
    : edge.kind === 'association' && !edge.directed ? undefined
      : `url(#${paint.arrow})`
  /** A unit step along the first segment, for the marks at a flow's start. */
  const dx = second.x - first.x
  const dy = second.y - first.y
  const length = Math.hypot(dx, dy) || 1
  const along = (k: number): Point => ({ x: first.x + (dx / length) * k, y: first.y + (dy / length) * k })
  const labelAt = edge.label
    ? { x: edge.label.x + edge.label.width / 2, y: edge.label.y + edge.label.height / 2 }
    : midpoint(edge.waypoints)
  return (
    <g data-edge={edge.kind} data-id={edge.id}>
      <polyline points={points} fill="none" stroke={paint.stroke} strokeWidth={1.5} strokeDasharray={dash} markerEnd={head} />
      {edge.kind === 'message' && <circle cx={first.x} cy={first.y} r={4} fill={paint.fill} stroke={paint.stroke} strokeWidth={1.2} />}
      {edge.isDefault && (() => {
        const a = along(8); const b = along(16)
        const nx = -(dy / length) * 5; const ny = (dx / length) * 5
        return <path d={`M${a.x - nx} ${a.y - ny} L${b.x + nx} ${b.y + ny}`} stroke={paint.stroke} strokeWidth={1.5} />
      })()}
      {edge.conditional && (() => {
        const tip = along(14); const mid = along(7)
        const nx = -(dy / length) * 4; const ny = (dx / length) * 4
        return <polygon points={`${first.x},${first.y} ${mid.x + nx},${mid.y + ny} ${tip.x},${tip.y} ${mid.x - nx},${mid.y - ny}`} fill={paint.fill} stroke={paint.stroke} strokeWidth={1.2} />
      })()}
      {edge.name && (
        <text x={labelAt.x} y={labelAt.y} fill={paint.text} textAnchor="middle" dominantBaseline="middle" fontSize={FONT - 1}>
          {edge.name}
        </text>
      )}
    </g>
  )
}

/** Halfway along a polyline, by length. */
function midpoint(points: readonly Point[]): Point {
  let total = 0
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  let left = total / 2
  for (let i = 1; i < points.length; i++) {
    const segment = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    if (left <= segment) {
      const k = segment === 0 ? 0 : left / segment
      return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * k, y: points[i - 1].y + (points[i].y - points[i - 1].y) * k - 8 }
    }
    left -= segment
  }
  return points[points.length - 1]
}
