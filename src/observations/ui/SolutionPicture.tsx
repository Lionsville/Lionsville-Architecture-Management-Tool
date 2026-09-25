// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What is being done about the causes, drawn (ADR-0026): causes on the left,
 * then directions, experiments and structural solutions — or, with the whole
 * chain, the analysis first and the solutions after it.
 *
 * Plain SVG over `solutionGraph` and `placeGraph`, like the analysis. A
 * solution is a rounded box whose width is the benefit it promises and whose
 * fill is how far it has got; an experiment is a box with its outcome on the
 * left edge. A structural solution keeps a faded box in the directions lane
 * for the direction it was. A line from a cause to a solution is drawn in the
 * accent colour with the link's weight; a line from a direction to an
 * experiment is dashed; a confirmed experiment leads on into the structural
 * solution with a solid one. Selecting a node lights what it reaches in both
 * directions, so the team can follow one chain through the picture; a
 * right-click on a node, or on a line a person drew, asks the page what can be
 * done with it (`PictureMenu`).
 */
import { useMemo, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import type { Translate } from '../../i18n'
import { placeGraph } from '../graph'
import { formatExperimentNumber, formatSolutionNumber } from '../solution'
import type { SolutionPhase, SolutionSize } from '../solution'
import { solutionKey } from '../solutionGraph'
import type { SolutionGraph, SolutionGraphEdge, SolutionGraphNode, SolutionLane } from '../solutionGraph'
import { OUTCOME_LABEL, PHASE_LABEL } from '../observationScope'
import { BOX, CauseMark, Flag, LANE_WIDTH, LINE_HIT_WIDTH, ObservationMark, RADIUS, ROW_HEIGHT, STROKE, shorten } from './AnalysisPicture'
import type { PictureMenuHandler, PictureTarget } from './PictureMenu'

const WIDTH: Record<SolutionSize | 'unset', number> = { unset: 160, small: 160, medium: 184, large: 212 }
const HEIGHT = 46

/** How each kind of line between the solution lanes is drawn; `addresses` and `explains` take the link's weight. */
const LINE: Partial<Record<SolutionGraphEdge['kind'], { width: number; dash?: string }>> = {
  tests: { width: 1.4, dash: '5 4' },
  proves: { width: 1.8 },
  became: { width: 1.4, dash: '1 3' },
}

const LANE_TITLE: Record<SolutionLane, Parameters<Translate>[0]> = {
  observations: 'observation.laneObservations',
  causes: 'observation.laneCauses',
  roots: 'observation.laneRoots',
  directions: 'solution.laneDirections',
  experiments: 'solution.laneExperiments',
  structural: 'solution.laneStructural',
}

export type SolutionPictureProps = {
  graph: SolutionGraph
  selectedKey?: string
  onSelect: (key: string) => void
  /** The reason a node carries the attention mark, by key; absent is no mark. */
  flags: ReadonlyMap<string, { text: string; strong?: boolean }>
  /** A right-click on a node or a line; absent, the browser's own menu. */
  onMenu?: PictureMenuHandler
  s: Translate
}

/** Everything a node reaches along the lines, both ways. */
function reach(graph: SolutionGraph, from: string): Set<string> {
  const found = new Set([from])
  for (const forward of [true, false]) {
    const stack = [from]
    const seen = new Set([from])
    while (stack.length) {
      const key = stack.pop()!
      for (const edge of graph.edges) {
        const [here, there] = forward ? [edge.from, edge.to] : [edge.to, edge.from]
        if (here !== key || seen.has(there)) continue
        seen.add(there)
        found.add(there)
        stack.push(there)
      }
    }
  }
  return found
}

export function SolutionPicture({ graph, selectedKey, onSelect, flags, onMenu, s }: SolutionPictureProps) {
  const theme = useTheme()
  const placed = useMemo(() => placeGraph(graph, { laneWidth: LANE_WIDTH, rowHeight: ROW_HEIGHT, top: 36, left: 0 }), [graph])
  const at = useMemo(() => new Map(placed.map((one) => [one.key, one])), [placed])
  // A structural solution is lit from its direction too, so an experiment
  // that tested it without confirming it is part of its chain.
  const lit = useMemo(() => {
    if (!selectedKey || !graph.nodes.some((node) => node.key === selectedKey)) return undefined
    const found = reach(graph, selectedKey)
    const trail = graph.nodes.find((node) => node.kind === 'trail' && solutionKey(node.id) === selectedKey)
    if (trail) for (const key of reach(graph, trail.key)) found.add(key)
    return found
  }, [graph, selectedKey])
  const tallest = Math.max(1, ...Array.from({ length: graph.lanes }, (_, lane) => graph.nodes.filter((node) => node.lane === lane).length))
  const width = graph.lanes * LANE_WIDTH
  const height = 36 + tallest * ROW_HEIGHT + 16

  const hasSolutions = graph.nodes.some((node) => node.kind === 'solution')
  if (!hasSolutions && !graph.nodes.some((node) => node.kind === 'cause')) {
    return (
      <Box sx={{ p: 5, color: 'text.secondary' }}>
        <Typography>{s('solution.graphEmpty')}</Typography>
      </Box>
    )
  }

  const fillOf = (phase: SolutionPhase): string => {
    const paper = theme.palette.background.paper
    const mix = (colour: string, share: number) => `color-mix(in srgb, ${colour} ${share}%, ${paper})`
    switch (phase) {
      case 'idea': case 'dropped': return paper
      case 'shaped': return mix(theme.palette.info.main, 18)
      case 'testing': return mix(theme.palette.warning.main, 22)
      case 'proven': return mix(theme.palette.primary.main, 20)
      case 'adopted': return mix(theme.palette.success.main, 35)
      case 'implemented': return theme.palette.success.main
    }
  }
  const outcomeColour = {
    planned: theme.palette.divider, running: theme.palette.warning.main, confirmed: theme.palette.success.main,
    refuted: theme.palette.error.main, inconclusive: theme.palette.text.secondary,
  }
  const maxSeen = Math.max(1, ...graph.nodes.map((node) => (node.kind === 'observation' ? node.observation.seen : 1)))
  const tint = (seen: number) => {
    const share = maxSeen === 1 ? 1 : (seen - 1) / (maxSeen - 1)
    return `color-mix(in srgb, ${theme.palette.primary.main} ${Math.round(25 + share * 75)}%, ${theme.palette.background.paper})`
  }
  const halfWidth = (node: SolutionGraphNode | undefined): number => {
    if (!node) return BOX.width / 2
    if (node.kind === 'observation') return RADIUS[node.observation.impact]
    if (node.kind === 'solution' || node.kind === 'trail') return WIDTH[node.solution.benefit ?? 'unset'] / 2
    return BOX.width / 2
  }
  const nodeOf = new Map(graph.nodes.map((node) => [node.key, node]))
  const menuOn = (key: string) => (onMenu ? (event: ReactMouseEvent) => {
    event.preventDefault()
    onMenu({ kind: 'node', key }, { x: event.clientX, y: event.clientY })
  } : undefined)
  /** The link a line draws, where it is one a person made; the rest are read off the records. */
  const lineTarget = (edge: SolutionGraph['edges'][number]): PictureTarget | undefined => {
    const left = nodeOf.get(edge.from)
    const right = nodeOf.get(edge.to)
    if (!left || !right) return undefined
    if (edge.kind === 'explains' && right.kind === 'cause' && (left.kind === 'observation' || left.kind === 'cause')) {
      return {
        kind: 'explains', causeId: right.id, id: left.id,
        ...(left.kind === 'observation' && left.scope !== undefined ? { scope: left.scope } : {}), strength: edge.strength,
      }
    }
    if (edge.kind === 'addresses' && left.kind === 'cause' && (right.kind === 'solution' || right.kind === 'trail')) {
      return { kind: 'addresses', solutionId: right.id, causeId: left.id, strength: edge.strength }
    }
    return undefined
  }

  return (
    <Box sx={{ overflow: 'auto', flex: 1, minHeight: 0, bgcolor: 'background.default' }}>
      <svg
        width={Math.max(width, 4 * LANE_WIDTH)}
        height={height}
        role="img"
        aria-label={s('solution.tab')}
        data-testid="solution-picture"
        style={{ display: 'block', fontFamily: theme.typography.fontFamily }}
      >
        {graph.laneKinds.map((kind, lane) => (
          <text
            key={lane}
            x={lane * LANE_WIDTH + LANE_WIDTH / 2}
            y={18}
            textAnchor="middle"
            fontSize={11}
            fill={theme.palette.text.secondary}
            style={{ textTransform: 'uppercase', letterSpacing: '.05em' }}
          >
            {s(LANE_TITLE[kind])}
          </text>
        ))}

        {graph.edges.map((edge) => {
          const from = at.get(edge.from)
          const to = at.get(edge.to)
          if (!from || !to) return null
          const startX = from.x + halfWidth(nodeOf.get(edge.from))
          const endX = to.x - halfWidth(nodeOf.get(edge.to))
          const mid = (startX + endX) / 2
          const stroke = LINE[edge.kind] ?? STROKE[edge.strength]
          const colour = edge.kind === 'addresses' ? theme.palette.primary.main : theme.palette.text.secondary
          const dim = lit !== undefined && !(lit.has(edge.from) && lit.has(edge.to))
          const d = `M${startX},${from.y} C${mid},${from.y} ${mid},${to.y} ${endX},${to.y}`
          const target = onMenu ? lineTarget(edge) : undefined
          return (
            <g key={`${edge.from}->${edge.to}`}>
              <path
                d={d}
                fill="none"
                stroke={colour}
                strokeWidth={stroke.width}
                strokeDasharray={stroke.dash}
                strokeOpacity={dim ? 0.15 : 0.8}
                data-testid="solution-link"
                data-kind={edge.kind}
              />
              {target && (
                <path
                  d={d} fill="none" stroke="transparent" strokeWidth={LINE_HIT_WIDTH} pointerEvents="stroke"
                  data-testid="solution-link-hit" data-kind={edge.kind}
                  onContextMenu={(event) => { event.preventDefault(); onMenu!(target, { x: event.clientX, y: event.clientY }) }}
                />
              )}
            </g>
          )
        })}

        {graph.nodes.map((node) => {
          const spot = at.get(node.key)
          if (!spot) return null
          const selected = node.key === selectedKey
          const dim = lit !== undefined && !lit.has(node.key)
          const flag = flags.get(node.key)
          const common = {
            cursor: 'pointer' as const, onClick: () => onSelect(node.key), onContextMenu: menuOn(node.key),
            'data-testid': `solution-picture-${node.kind}`, dim,
          }
          if (node.kind === 'observation') {
            return <ObservationMark key={node.key} node={node} x={spot.x} y={spot.y} selected={selected} fill={tint(node.observation.seen)} {...common} />
          }
          if (node.kind === 'cause') {
            return <CauseMark key={node.key} node={node} x={spot.x} y={spot.y} selected={selected} s={s} flag={flag?.text} {...common} />
          }
          const stroke = selected ? theme.palette.secondary.main : theme.palette.text.primary
          if (node.kind === 'trail') {
            const { solution } = node
            const w = WIDTH[solution.benefit ?? 'unset']
            const chosen = solutionKey(node.id) === selectedKey
            return (
              <g key={node.key} transform={`translate(${spot.x},${spot.y})`} onClick={() => onSelect(solutionKey(node.id))} onContextMenu={menuOn(solutionKey(node.id))} cursor="pointer" data-testid="solution-picture-trail" data-key={node.key}>
                <rect x={-w / 2} y={-HEIGHT / 2} width={w} height={HEIGHT} rx={10} fill={theme.palette.background.paper} />
                <g opacity={dim ? 0.25 : 0.6}>
                  <title>{`${formatSolutionNumber(solution.number)} ${solution.title} — ${s('solution.trail')}`}</title>
                  <rect
                    x={-w / 2} y={-HEIGHT / 2} width={w} height={HEIGHT} rx={10} fill="none"
                    stroke={chosen ? theme.palette.secondary.main : theme.palette.text.secondary} strokeWidth={chosen ? 2 : 1.2} strokeDasharray="3 3"
                  />
                  <text textAnchor="middle" dy="-0.2em" fontSize={11} fill={theme.palette.text.secondary}>{shorten(solution.title, Math.round(w / 6.4))}</text>
                  <text textAnchor="middle" dy="1.05em" fontSize={10} fill={theme.palette.text.secondary}>
                    {formatSolutionNumber(solution.number)} · {s('solution.trail')}
                  </text>
                </g>
              </g>
            )
          }
          if (node.kind === 'experiment') {
            const { experiment } = node
            return (
              <g key={node.key} transform={`translate(${spot.x},${spot.y})`} onClick={common.onClick} onContextMenu={common.onContextMenu} cursor="pointer" data-testid={common['data-testid']} data-key={node.key}>
                <rect x={-BOX.width / 2} y={-HEIGHT / 2} width={BOX.width} height={HEIGHT} rx={3} fill={theme.palette.background.paper} />
                <g opacity={dim ? 0.35 : 1}>
                  <title>{`${formatExperimentNumber(experiment.number)} ${experiment.title}`}</title>
                  <rect x={-BOX.width / 2} y={-HEIGHT / 2} width={BOX.width} height={HEIGHT} rx={3} fill={theme.palette.background.paper} stroke={selected ? stroke : theme.palette.divider} strokeWidth={selected ? 3 : 1.2} />
                  <rect x={-BOX.width / 2} y={-HEIGHT / 2} width={5} height={HEIGHT} fill={outcomeColour[experiment.outcome]} />
                  <text x={-BOX.width / 2 + 12} dy="-0.2em" fontSize={11} fill={theme.palette.text.primary}>{shorten(experiment.title, 27)}</text>
                  <text x={-BOX.width / 2 + 12} dy="1.05em" fontSize={10} fill={theme.palette.text.secondary}>
                    {formatExperimentNumber(experiment.number)} · {s(OUTCOME_LABEL[experiment.outcome]).toLowerCase()}
                  </text>
                </g>
              </g>
            )
          }
          const { solution, phase } = node
          const w = WIDTH[solution.benefit ?? 'unset']
          const done = phase === 'implemented'
          return (
            <g key={node.key} transform={`translate(${spot.x},${spot.y})`} onClick={common.onClick} onContextMenu={common.onContextMenu} cursor="pointer" data-testid={common['data-testid']} data-key={node.key} data-phase={phase}>
              <rect x={-w / 2} y={-HEIGHT / 2} width={w} height={HEIGHT} rx={10} fill={theme.palette.background.paper} />
              <g opacity={dim ? 0.35 : phase === 'dropped' ? 0.55 : 1}>
                <title>{`${formatSolutionNumber(solution.number)} ${solution.title}`}</title>
                <rect
                  x={-w / 2} y={-HEIGHT / 2} width={w} height={HEIGHT} rx={10}
                  fill={fillOf(phase)} stroke={stroke} strokeWidth={selected ? 3 : 1.5}
                  strokeDasharray={phase === 'idea' || phase === 'dropped' ? '5 3' : undefined}
                />
                <text textAnchor="middle" dy="-0.2em" fontSize={11} fill={done ? theme.palette.success.contrastText : theme.palette.text.primary} textDecoration={phase === 'dropped' ? 'line-through' : undefined}>
                  {shorten(solution.title, Math.round(w / 6.4))}
                </text>
                <text textAnchor="middle" dy="1.05em" fontSize={10} fill={done ? theme.palette.success.contrastText : theme.palette.text.secondary}>
                  {formatSolutionNumber(solution.number)} · {s(PHASE_LABEL[phase]).toLowerCase()}
                </text>
                {flag && <Flag x={w / 2} y={-HEIGHT / 2} title={flag.text} strong={flag.strong} />}
              </g>
            </g>
          )
        })}
      </svg>
    </Box>
  )
}

/** What the marks mean, said once under the picture. */
export function SolutionLegend({ s }: { s: Translate }) {
  const theme = useTheme()
  const row = (glyph: ReactNode, text: string) => (
    <Box key={text} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <svg width={34} height={14} aria-hidden>{glyph}</svg>
      <Typography variant="caption" color="text.secondary">{text}</Typography>
    </Box>
  )
  const paper = theme.palette.background.paper
  return (
    <Box data-testid="solution-legend" sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, px: 2, py: 1, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      {row(<><rect x={1} y={3} width={12} height={8} rx={3} fill="none" stroke={theme.palette.text.primary} /><rect x={16} y={2} width={17} height={10} rx={3} fill="none" stroke={theme.palette.text.primary} /></>, s('solution.legendWidth'))}
      {row(<><rect x={1} y={3} width={9} height={8} rx={3} fill={paper} stroke={theme.palette.text.primary} strokeDasharray="2 2" /><rect x={12} y={3} width={9} height={8} rx={3} fill={`color-mix(in srgb, ${theme.palette.warning.main} 22%, ${paper})`} stroke={theme.palette.text.primary} /><rect x={23} y={3} width={10} height={8} rx={3} fill={theme.palette.success.main} stroke={theme.palette.text.primary} /></>, s('solution.legendFill'))}
      {row(<line x1={2} y1={7} x2={32} y2={7} stroke={theme.palette.primary.main} strokeWidth={2.5} />, s('solution.legendAddresses'))}
      {row(<line x1={2} y1={7} x2={32} y2={7} stroke={theme.palette.text.secondary} strokeWidth={1.4} strokeDasharray="5 4" />, s('solution.legendTests'))}
      {row(<line x1={2} y1={7} x2={32} y2={7} stroke={theme.palette.text.secondary} strokeWidth={1.8} />, s('solution.legendProves'))}
      {row(<rect x={1} y={2} width={32} height={10} rx={4} fill="none" stroke={theme.palette.text.secondary} strokeOpacity={0.6} strokeDasharray="3 3" />, s('solution.legendTrail'))}
      {row(<><circle cx={10} cy={7} r={6} fill={theme.palette.warning.main} /><text x={10} y={7} dy="0.35em" textAnchor="middle" fontSize={9} fontWeight={700} fill={paper}>!</text></>, s('solution.flag'))}
    </Box>
  )
}
