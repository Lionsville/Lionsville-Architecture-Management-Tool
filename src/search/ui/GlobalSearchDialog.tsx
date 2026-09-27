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
import { STATUS_LABEL } from '../../decisions/adrScope'
import { isElementKind, kindLabel } from '../../model/kinds'
import { isRelationType, RELATION_LABEL } from '../../model/relations'
import type { SearchKind } from '../../model/searchable'
import {
  ARCHIVED_LABEL, IMPACT_LABEL, OUTCOME_LABEL, PHASE_LABEL, STATE_LABEL,
} from '../../observations/observationScope'
import { PLAN_STATUS_LABEL } from '../../roadmap/labels'
import { searchAll } from '../search'
import type { SearchHit, SearchSource } from '../search'

export type GlobalSearchDialogProps = {
  open: boolean
  /** Nearest first: the open scope, then the scopes above, then the rest of the tree. */
  sources: readonly SearchSource[]
  /** What to call a scope on a row. */
  scopeLabel: (path: string) => string
  onClose: () => void
  onChoose: (hit: SearchHit) => void
  s: Translate
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
}

const VIEW_LABEL: Record<string, StringKey> = {
  layer7: 'gsearch.view.layer7',
  container: 'gsearch.view.container',
  sheet: 'gsearch.view.sheet',
  map: 'gsearch.view.map',
  technology: 'gsearch.view.technology',
}

/** Each kind's status words, from the tables the modules that own them publish. */
const STATUS_TABLES: Partial<Record<SearchKind, Readonly<Record<string, StringKey>>>> = {
  decision: STATUS_LABEL,
  plan: PLAN_STATUS_LABEL,
  observation: { ...IMPACT_LABEL, archived: ARCHIVED_LABEL },
  cause: STATE_LABEL,
  solution: PHASE_LABEL,
  experiment: OUTCOME_LABEL,
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
  if (hit.kind === 'view' && VIEW_LABEL[variant]) return s(VIEW_LABEL[variant])
  if (hit.kind === 'relation' && isRelationType(variant)) return s(RELATION_LABEL[variant])
  return undefined
}

export function GlobalSearchDialog({ open, sources, scopeLabel, onClose, onChoose, s }: GlobalSearchDialogProps) {
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
    () => (open ? searchAll({ sources, query: asked }) : []),
    [open, sources, asked],
  )
  // Keyed on the query the list was built from, not on the one being typed: the
  // highlight resets when the rows it points into change.
  useEffect(() => setActiveIndex(0), [asked])

  const active = hits.length > 0 ? Math.min(activeIndex, hits.length - 1) : -1
  const optionId = (index: number) => `lv-gsearch-option-${index}`

  useEffect(() => {
    if (active < 0) return
    const row = listRef.current?.querySelector(`#${optionId(active)}`)
    ;(row as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest' })
  }, [active, hits])

  const move = (delta: number) => {
    if (hits.length === 0) return
    setActiveIndex((current) => (Math.min(current, hits.length - 1) + delta + hits.length) % hits.length)
  }

  const choose = (hit: SearchHit) => {
    onChoose(hit)
    onClose()
  }

  // The empty state describes the list, so it quotes the query the list answers.
  const trimmed = asked.trim()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
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
            else if (event.key === 'Enter' && active >= 0) { event.preventDefault(); choose(hits[active]) }
          }}
          label={s('gsearch.title')}
          placeholder={s('gsearch.placeholder')}
          slotProps={{
            htmlInput: {
              'aria-label': s('gsearch.field'),
              role: 'combobox',
              'aria-expanded': hits.length > 0,
              'aria-controls': 'lv-gsearch-results',
              'aria-activedescendant': active >= 0 ? optionId(active) : undefined,
              autoComplete: 'off',
            },
          }}
        />
      </Box>
      <Box
        ref={listRef}
        id="lv-gsearch-results"
        role="listbox"
        aria-label={s('gsearch.results')}
        sx={{ maxHeight: 420, overflowY: 'auto', pb: 0.5 }}
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
      </Box>
      {/* Beside the listbox, not in it: a listbox holds options and nothing else. */}
      {hits.length === 0 && (
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
