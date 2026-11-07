// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * ⌘K: one field over everything the organisation holds.
 *
 * The editor's own ⌘F finds a box on the canvas and nothing else, on purpose —
 * a paragraph would out-match every name. This dialog is the wider one: it
 * asks `searchAll` for every kind of record the sources hold and lets each
 * hit open the thing it is about, where it lives. It is the same
 * combobox-over-listbox pattern as the element finder — focus stays in the
 * field, ↑/↓ move the active row, Enter takes it — so the two feel like one
 * tool.
 *
 * A row says what it is — the heading of its group, and beside the title the
 * element's kind, the view's, or the record's status — and which scope holds
 * it, so a hit from another scope is not mistaken for one here.
 *
 * Pure rendering: the hits come from `core/search`, and what a chosen hit does
 * is the caller's (`onChoose`), because opening a page is the workspace's job.
 */
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import ListItemButton from '@mui/material/ListItemButton'
import ListSubheader from '@mui/material/ListSubheader'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { StringKey, Translate } from '../../i18n'
import type { DesignDiagram } from '../../model'
import { STATUS_LABEL } from '../../decisions/adrScope'
import { isElementKind, kindLabel } from '../../model/kinds'
import { isRelationType, RELATION_LABEL } from '../../model/relations'
import type { SearchKind } from '../../model/searchable'
import {
  ARCHIVED_LABEL, IMPACT_LABEL, OUTCOME_LABEL, PHASE_LABEL, STATE_LABEL,
} from '../../observations/observationScope'
import { PLAN_STATUS_LABEL } from '../../roadmap/labels'
import { searchAll } from '../search'
import type { PeopleMatch, SearchHit, SearchSource } from '../search'

export type GlobalSearchDialogProps = {
  open: boolean
  /** Nearest first: the open scope, then the scopes above, then the rest of the tree. */
  sources: readonly SearchSource[]
  /** What to call a scope on a row. */
  scopeLabel: (path: string) => string
  onClose: () => void
  onChoose: (hit: SearchHit) => void
  /** The register's half (ADR-0036 §8): which register ids a word names. Absent, people are found by text alone. */
  people?: PeopleMatch
  /**
   * What ⌘K offers beside the records: places and commands from the one table,
   * after the records, grouped under their own headings. Absent: records alone.
   */
  more?: (asked: string) => readonly PaletteLine[]
  s: Translate
}

/** A line of ⌘K that is not a record: its heading, its words, its key, and what it does. */
export type PaletteLine = {
  readonly id: string
  readonly group: string
  readonly label: string
  readonly keys?: string
  readonly run: () => void
}

const KIND_LABEL: Record<SearchKind, StringKey> = {
  element: 'gsearch.kind.element',
  documentation: 'gsearch.kind.documentation',
  view: 'gsearch.kind.view',
  relation: 'gsearch.kind.relation',
  decision: 'gsearch.kind.decision',
  plan: 'gsearch.kind.plan',
  milestone: 'gsearch.kind.milestone',
  observation: 'gsearch.kind.observation',
  cause: 'gsearch.kind.cause',
  solution: 'gsearch.kind.solution',
  experiment: 'gsearch.kind.experiment',
  unitType: 'gsearch.kind.unitType',
  role: 'gsearch.kind.role',
  responsibility: 'gsearch.kind.responsibility',
  comment: 'gsearch.kind.comment',
  principle: 'gsearch.kind.principle',
  person: 'gsearch.kind.person',
}

const VIEW_LABEL = {
  layer7: 'gsearch.view.layer7',
  container: 'gsearch.view.container',
  sheet: 'gsearch.view.sheet',
  map: 'gsearch.view.map',
  technology: 'gsearch.view.technology',
  drawing: 'gsearch.view.drawing',
  chart: 'gsearch.view.chart',
  conway: 'gsearch.view.conway',
} as const satisfies Record<DesignDiagram['kind'], StringKey>

function isViewKind(kind: string): kind is DesignDiagram['kind'] {
  return Object.prototype.hasOwnProperty.call(VIEW_LABEL, kind)
}

/** Each kind's status words, from the tables the modules that own them publish. */
const STATUS_TABLES: Partial<Record<SearchKind, Readonly<Record<string, StringKey>>>> = {
  decision: STATUS_LABEL,
  plan: PLAN_STATUS_LABEL,
  observation: { ...IMPACT_LABEL, archived: ARCHIVED_LABEL },
  cause: STATE_LABEL,
  solution: PHASE_LABEL,
  experiment: OUTCOME_LABEL,
  person: { active: 'gsearch.person.active', left: 'gsearch.person.left', forgotten: 'gsearch.person.forgotten' },
}

/** What the chip beside a title says: which kind of element or view, or where the record stands. */
export function chipOf(hit: SearchHit, s: Translate): string | undefined {
  const { variant, status } = hit
  if (status !== undefined) {
    const key = STATUS_TABLES[hit.kind]?.[status]
    return key ? s(key) : status
  }
  if (variant === undefined) return undefined
  if ((hit.kind === 'element' || hit.kind === 'documentation') && isElementKind(variant)) return kindLabel(variant, s)
  if (hit.kind === 'view' && isViewKind(variant)) return s(VIEW_LABEL[variant])
  if (hit.kind === 'relation' && isRelationType(variant)) return s(RELATION_LABEL[variant])
  return undefined
}

const optionId = (index: number) => `lv-gsearch-option-${index}`

/** The commands under the hits, a group to a heading: they count on from the hits for the arrows. */
function PaletteRows({ lines, first, active, onHover, onRun }: {
  lines: readonly PaletteLine[]
  first: number
  active: number
  onHover(index: number): void
  onRun(line: PaletteLine): void
}) {
  return (
    <>
      {runsOfGroup(lines).map(({ group, from, run: inGroup }) => (
          <Box key={group} role="group" aria-label={group}>
            <ListSubheader component="div" role="presentation" disableSticky sx={{ lineHeight: '28px', bgcolor: 'transparent', fontSize: 11 }}>{group}</ListSubheader>
            {inGroup.map((line, offset) => {
              const index = first + from + offset
              return (
                <ListItemButton
                  key={line.id} id={optionId(index)} role="option" aria-selected={index === active} selected={index === active} dense
                  onMouseMove={() => onHover(index)} onClick={() => onRun(line)}
                  data-testid={`palette-${line.id}`}
                  sx={{ display: 'flex', gap: 1, px: 2, py: 0.5 }}
                >
                  <Typography sx={{ fontSize: 13, flex: 1, minWidth: 0 }} noWrap>{line.label}</Typography>
                  {line.keys !== undefined && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{line.keys}</Typography>}
                </ListItemButton>
              )
            })}
          </Box>
        ))}
    </>
  )
}

export function GlobalSearchDialog({ open, sources, scopeLabel, onClose, onChoose, people, more, s }: GlobalSearchDialogProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Each opening starts empty: yesterday's answer to today's question helps nobody.
  useEffect(() => {
    if (open) { setQuery(''); setActiveIndex(0) }
  }, [open])

  /**
   * The field stays live while the list catches up.
   *
   * The search is a scan over every record of the tree, folded once. On a big
   * organisation `useDeferredValue` lets React paint the character you just
   * typed at once and re-run the search at lower priority, so a slow answer
   * never makes the field itself lag. When there is no lag to hide, this is
   * the query.
   */
  const asked = useDeferredValue(query)

  const hits = useMemo(
    () => (open ? searchAll({ sources, query: asked, ...(people ? { people } : {}) }) : []),
    [open, sources, asked, people],
  )
  // Keyed on the query the list was built from, not on the one being typed: the
  // highlight resets when the rows it points into change.
  useEffect(() => setActiveIndex(0), [asked])

  const lines = useMemo(() => (open && more ? more(asked) : []), [open, more, asked])
  const total = hits.length + lines.length
  const active = total > 0 ? Math.min(activeIndex, total - 1) : -1

  useEffect(() => {
    if (active < 0) return
    const row = listRef.current?.querySelector(`#${optionId(active)}`)
    ;(row as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest' })
  }, [active, hits])

  const move = (delta: number) => {
    if (total === 0) return
    setActiveIndex((current) => (Math.min(current, total - 1) + delta + total) % total)
  }

  const choose = (hit: SearchHit) => {
    onChoose(hit)
    onClose()
  }
  const run = (line: PaletteLine) => {
    onClose()
    line.run()
  }
  const chooseAt = (index: number) => {
    if (index < hits.length) choose(hits[index])
    else run(lines[index - hits.length])
  }
  const previewed = active >= 0 && active < hits.length ? hits[active] : undefined

  // The empty state describes the list, so it quotes the query the list answers.
  const trimmed = asked.trim()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={previewed ? 'md' : 'sm'}
      fullWidth
      sx={{ '& .MuiDialog-container': { alignItems: 'flex-start', pt: '10vh' } }}
    >
      <Box sx={{ p: 1.5, pb: 1 }}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); move(1) }
            else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1) }
            else if (event.key === 'Enter' && active >= 0) { event.preventDefault(); chooseAt(active) }
          }}
          label={s('gsearch.title')}
          placeholder={s('gsearch.placeholder')}
          slotProps={{
            htmlInput: {
              'aria-label': s('gsearch.field'),
              role: 'combobox',
              'aria-expanded': total > 0,
              'aria-controls': 'lv-gsearch-results',
              'aria-activedescendant': active >= 0 ? optionId(active) : undefined,
              autoComplete: 'off',
            },
          }}
        />
      </Box>
      <Box sx={{ display: 'flex', minHeight: 0 }}>
      <Box
        ref={listRef}
        id="lv-gsearch-results"
        role="listbox"
        aria-label={s('gsearch.results')}
        sx={{ maxHeight: 420, overflowY: 'auto', pb: 0.5, flex: '1 1 0', minWidth: 0 }}
      >
        {/* One group per kind, named by its heading, so a screen reader says
            which kind a row is as it reaches the first of them. */}
        {runsOfKind(hits).map(({ kind, from, run }) => (
          <Box key={`${kind}-${from}`} role="group" aria-labelledby={`lv-gsearch-kind-${from}`}>
            <ListSubheader id={`lv-gsearch-kind-${from}`} component="div" role="presentation" disableSticky sx={{ lineHeight: '28px', bgcolor: 'transparent', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              {s(KIND_LABEL[kind])}
            </ListSubheader>
            {run.map((hit, offset) => {
              const index = from + offset
              return (
                <ListItemButton
                  key={`${hit.kind}-${index}`}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  selected={index === active}
                  dense
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => choose(hit)}
                  sx={{ display: 'block', px: 2, py: 0.75 }}
                >
                  <HitRow hit={hit} scopeLabel={scopeLabel} s={s} />
                </ListItemButton>
              )
            })}
          </Box>
        ))}
        <PaletteRows lines={lines} first={hits.length} active={active} onHover={setActiveIndex} onRun={run} />
      </Box>
      {/* What a whole sentence needs room for: a hit read before it is opened. */}
      {previewed && (
        <Box data-testid="palette-preview" sx={{ flex: '0 0 300px', minWidth: 0, borderLeft: 1, borderColor: 'divider', p: 1.5, overflowY: 'auto', maxHeight: 420 }}>
          {chipOf(previewed, s) !== undefined && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{chipOf(previewed, s)}</Typography>}
          <Typography sx={{ fontSize: 16, fontWeight: 600, overflowWrap: 'anywhere' }}>{previewed.title !== '' ? previewed.title : previewed.about.join(' → ')}</Typography>
          {previewed.scope !== undefined && <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>{scopeLabel(previewed.scope)}</Typography>}
          {previewed.detail && <Typography sx={{ fontSize: 13, mt: 1, overflowWrap: 'anywhere' }}>{previewed.detail}</Typography>}
          {previewed.snippet && <Typography sx={{ fontSize: 13, mt: 1, overflowWrap: 'anywhere' }}>{previewed.snippet}</Typography>}
        </Box>
      )}
      </Box>
      {/* Beside the listbox, not in it: a listbox holds options and nothing else. */}
      {total === 0 && (
        <Typography sx={{ fontSize: 12, color: 'text.secondary', px: 2, pb: 1.5 }}>
          {trimmed === '' ? s('gsearch.empty') : s('gsearch.noMatches', { query: trimmed })}
        </Typography>
      )}
      <Typography sx={{ fontSize: 11, color: 'text.secondary', px: 2, pb: 1.5 }}>
        {s('gsearch.hint')}
      </Typography>
    </Dialog>
  )
}

/** The lines in runs of one heading, in the order they came, with where each run starts. */
function runsOfGroup(lines: readonly PaletteLine[]): { group: string; from: number; run: PaletteLine[] }[] {
  const runs: { group: string; from: number; run: PaletteLine[] }[] = []
  lines.forEach((line, index) => {
    const last = runs[runs.length - 1]
    if (last && last.group === line.group) last.run.push(line)
    else runs.push({ group: line.group, from: index, run: [line] })
  })
  return runs
}

/** The hits in runs of one kind, in the order they came, with where each run starts. */
function runsOfKind(hits: readonly SearchHit[]): { kind: SearchKind; from: number; run: SearchHit[] }[] {
  const runs: { kind: SearchKind; from: number; run: SearchHit[] }[] = []
  hits.forEach((hit, index) => {
    const last = runs[runs.length - 1]
    if (last && last.kind === hit.kind) last.run.push(hit)
    else runs.push({ kind: hit.kind, from: index, run: [hit] })
  })
  return runs
}

function HitRow({ hit, scopeLabel, s }: {
  hit: SearchHit; scopeLabel: (path: string) => string; s: Translate
}) {
  const chip = chipOf(hit, s)
  const about = hit.about.join(' → ')
  // A relation with no label is called by its two ends.
  const title = hit.title !== '' ? hit.title : about
  const second = [
    hit.scope !== undefined ? scopeLabel(hit.scope) : undefined,
    hit.title !== '' && about !== '' ? about : undefined,
    hit.detail,
    hit.snippet || undefined,
  ].filter(Boolean).join(' · ')
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {hit.label !== undefined && (
          <Typography sx={{ fontSize: 11, color: 'text.secondary', fontFamily: 'ui-monospace, Menlo, monospace' }}>
            {hit.label}
          </Typography>
        )}
        <Typography sx={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>{title}</Typography>
        {chip !== undefined && <Chip size="small" label={chip} sx={{ height: 18, fontSize: 10 }} />}
      </Box>
      {second !== '' && (
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }} noWrap>{second}</Typography>
      )}
    </>
  )
}
