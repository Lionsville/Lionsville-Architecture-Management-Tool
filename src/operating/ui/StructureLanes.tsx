// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The unit types drawn as a structure (ADR-0036, amended 11 October 2026):
 * the organisation in lane 0, each type once in its lane — the longest path
 * from the organisation (`model/unitOrder.ts`) — in the lane's order, and a
 * line from every place a type may sit to the type (`laneLines`), measured
 * from where the cards ended up after every layout and never stored.
 *
 * It draws and reads nothing else: the cards are handed in, and so is how
 * each line stands to what is picked. So the page draws the organisation's
 * own types with it, to pick and edit, and a library's dialog draws the
 * library's types with it, read-only, with cards of its own.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import type { UnitType } from '../../model/operatingModel'
import type { SitsIn, UnitTypeLanes } from '../../model/unitOrder'
import { laneLines, railBand } from './laneLines'
import type { CardBox, LaneLine } from './laneLines'
import type { Look } from './structurePick'
import { ringOf } from './TypeCard'

export type StructureLanesProps = {
  /** The lanes, as `unitTypeLanes` reads the types drawn: lane 1 first, the types that sit nowhere left out. */
  structure: UnitTypeLanes
  /** What the whole is called, read aloud. */
  label: string
  /** The organisation's card in lane 0: its name, a line under it, and how it stands to what is picked. */
  organisation: { name: string; note?: string; look?: Look }
  /** Each lane's heading, lane 0 the organisation's. */
  laneLabel: (lane: number) => string
  /** One type's card, drawn in its lane. */
  card: (type: UnitType) => ReactNode
  /** How a line stands to what is picked; plain where absent. */
  lineLook?: (edge: SitsIn) => Exclude<Look, 'picked'>
  /** The stable name the page's own structure carries (`platform/controlNames`). */
  named?: 'operating.structure'
  /** Narrower lanes, and a narrow organisation: for a dialog with a pane beside it. */
  compact?: boolean
}

/** A lane's width and the gap between two: room in the gap for a line to bend up to the rail and down again. */
const WIDE = { lane: 236, root: 150, gap: 48 }
const COMPACT = { lane: 200, root: 120, gap: 40 }

export function StructureLanes({ structure, label, organisation, laneLabel, card, lineLook, named, compact = false }: StructureLanesProps) {
  const stage = useRef<HTMLDivElement>(null)
  const lines = useMeasuredLines(stage, structure)
  const size = compact ? COMPACT : WIDE
  return (
    <Box
      ref={stage} role="group" aria-label={label} data-guide={named} data-testid="structure-lanes"
      sx={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: `${size.gap}px`, width: 'max-content', pt: `${railBand(structure)}px`, pb: 1.5, pr: 3 }}
    >
      <Lines lines={lines} look={lineLook} />
      <Lane heading={laneLabel(0)} lane={0} width={size.root}>
        <Box data-lane-root>
          <OrganisationCard {...organisation} />
        </Box>
      </Lane>
      {structure.lanes.map((lane) => (
        <Lane key={lane.lane} heading={laneLabel(lane.lane)} lane={lane.lane} width={size.lane}>
          {lane.types.map((type) => <Box key={type.id} role="listitem" data-lane-card={type.id}>{card(type)}</Box>)}
        </Lane>
      ))}
    </Box>
  )
}

/** One lane: its heading, said once as the list's name, and its cards one under the other. */
function Lane({ heading, lane, width, children }: { heading: string; lane: number; width: number; children: ReactNode }) {
  return (
    <Box sx={{ width, flexShrink: 0, position: 'relative', zIndex: 1 }} data-lane={lane}>
      <Typography aria-hidden sx={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', height: 16, mb: 0.5 }}>
        {heading}
      </Typography>
      <Box role="list" aria-label={heading} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {lane === 0 ? <Box role="listitem">{children}</Box> : children}
      </Box>
    </Box>
  )
}

function OrganisationCard({ name, note, look = 'plain' }: StructureLanesProps['organisation']) {
  const ring = ringOf(look)
  return (
    <Box data-testid="structure-organisation" data-look={look} sx={{
      border: 1, borderColor: ring ?? 'divider', borderRadius: 1.5, p: 1, bgcolor: 'background.default',
      // Out of the pick, as a type's card is (`TypeCard`).
      opacity: look === 'dim' ? 0.45 : 1,
    }}>
      <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{name}</Typography>
      {note && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{note}</Typography>}
    </Box>
  )
}

/** The lines, under the cards; a line cut at a loop dashed. */
function Lines({ lines, look }: { lines: readonly LaneLine[]; look: StructureLanesProps['lineLook'] }) {
  const theme = useTheme()
  const stroke = { plain: theme.palette.text.secondary, lit: theme.palette.primary.main, dim: theme.palette.divider } as const
  return (
    <Box component="svg" aria-hidden sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', zIndex: 0 }}>
      {lines.map((line) => {
        const how = look?.(line.edge) ?? 'plain'
        return (
          <path key={line.key} d={line.d} fill="none" stroke={stroke[how]} strokeWidth={how === 'lit' ? 2.2 : 1.3}
            strokeDasharray={line.shape === 'loop' ? '4 3' : undefined} data-testid={`structure-line-${line.shape}`} data-look={how} />
        )
      })}
    </Box>
  )
}

/**
 * Where each line runs, from the cards as they ended up: measured after every
 * layout — a card grows as its name or its slots do, and moves the ones under
 * it — and again whenever a card or the stage changes size.
 */
function useMeasuredLines(stage: { current: HTMLDivElement | null }, structure: UnitTypeLanes): LaneLine[] {
  const [lines, setLines] = useState<LaneLine[]>([])
  const measure = useCallback(() => {
    const root = stage.current
    if (!root) return
    const origin = root.getBoundingClientRect()
    const boxOf = (element: Element | null | undefined): CardBox | undefined => {
      const box = element?.getBoundingClientRect()
      if (!box || box.width === 0) return undefined
      return { left: box.left - origin.left, top: box.top - origin.top, right: box.right - origin.left, bottom: box.bottom - origin.top }
    }
    const cards = new Map([...root.querySelectorAll<HTMLElement>('[data-lane-card]')].map((card) => [card.dataset.laneCard, card]))
    const top = root.querySelector('[data-lane-root]')
    const next = laneLines(structure, (type) => boxOf(type === undefined ? top : cards.get(type)))
    setLines((held) => (sameLines(held, next) ? held : next))
  }, [stage, structure])
  useLayoutEffect(measure)
  useEffect(() => {
    const root = stage.current
    if (!root || typeof ResizeObserver === 'undefined') return undefined
    const watch = new ResizeObserver(() => measure())
    watch.observe(root)
    for (const card of root.querySelectorAll('[data-lane-card], [data-lane-root]')) watch.observe(card)
    return () => watch.disconnect()
  }, [stage, structure, measure])
  return lines
}

function sameLines(a: readonly LaneLine[], b: readonly LaneLine[]): boolean {
  return a.length === b.length && a.every((line, at) => line.key === b[at].key && line.d === b[at].d)
}
