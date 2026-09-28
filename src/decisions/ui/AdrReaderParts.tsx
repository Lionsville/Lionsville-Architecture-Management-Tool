// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The pieces of the reading pane that are not the text: the record's bar with
 * its moves, the notices under it, the front matter, and the contents.
 *
 * Apart from `AdrReader.tsx` because each answers one question about the
 * record and none needs the draft: the reader owns the text being written,
 * these draw what the record says about itself (ADR-0008, amended 28
 * September 2026).
 */
import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import type { StringKey, Translate } from '../../i18n'
import {
  adrGate, formatAdrNumber, isAdrDeletable, isAdrLocked, selfAccepted, supersededByUnaccepted, transitionsFrom,
} from '../adr'
import type { Adr, AdrGateItem, AdrPatch, AdrStatus } from '../adr'
import type { Solution } from '../../model/observation'
import { transitionLabel } from '../../model/transition'
import type { Transition } from '../../model/transition'
import { STATUS_COLOR, STATUS_LABEL } from '../adrScope'

export type Mode = 'read' | 'edit'

/** Each line of a gate, in the words the page says it in. */
const GATE_LABEL: Record<AdrGateItem, StringKey> = {
  context: 'adr.gate.context',
  options: 'adr.gate.options',
  outcome: 'adr.gate.outcome',
  consequence: 'adr.gate.consequence',
  approved: 'adr.gate.approved',
  predecessors: 'adr.gate.predecessors',
  reason: 'adr.gate.reason',
  rejection: 'adr.gate.rejection',
  successor: 'adr.gate.successor',
}

/**
 * `SO-0003`, as the observations page writes it. Said here rather than
 * imported: `decisions` may not import `observations`, and a label is one line.
 */
function solutionLabel(number: number): string {
  return `SO-${String(Math.max(0, Math.trunc(number))).padStart(4, '0')}`
}

/** A record as its list names it: number and title. */
function namer(list: readonly Adr[]): (id: string) => string {
  return (id) => {
    const found = list.find((a) => a.id === id)
    return found ? `${formatAdrNumber(found.number)} · ${found.title}` : id
  }
}

/** The gate to acceptance, while acceptance is a move the record has. */
function acceptGateOf(adr: Adr, list: readonly Adr[]) {
  return transitionsFrom(adr.status).includes('accepted') ? adrGate(adr, 'accepted', { list }) : undefined
}

// --- the bar ------------------------------------------------------------------------

/**
 * The record's own bar: status, day, the moves, delete, history, and read or
 * edit. Acceptance waits for its gate; withdrawing a proposal is called that.
 */
export function ReaderBar({ adr, list, readOnly, canEdit, mode, s, day, onStatus, onDelete, onHistory, onMode }: {
  adr: Adr
  list: readonly Adr[]
  readOnly: boolean
  canEdit: boolean
  mode: Mode
  s: Translate
  day: (value: string) => string
  onStatus: (next: AdrStatus) => void
  onDelete: () => void
  onHistory?: () => void
  onMode: (next: Mode | null) => void
}) {
  const moves = transitionsFrom(adr.status)
  const acceptOpen = acceptGateOf(adr, list)?.items.some((one) => !one.ok) ?? false
  const moveLabel = (next: AdrStatus) => (
    adr.status === 'proposed' && next === 'rejected' ? s('adr.withdraw') : s('adr.moveTo', { status: s(STATUS_LABEL[next]) })
  )
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.75, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexWrap: 'wrap' }}>
      <Chip size="small" color={STATUS_COLOR[adr.status]} label={s(STATUS_LABEL[adr.status])} data-testid="adr-status" data-guide="decision.status" />
      <Typography variant="caption" color="text.secondary">{day(adr.date)}</Typography>
      <Box sx={{ flex: 1 }} />
      {!readOnly && moves.map((next) => (
        <Button
          key={next}
          size="small"
          variant="outlined"
          data-guide="decision.move"
          data-testid={`adr-move-${next}`}
          disabled={next === 'accepted' && acceptOpen}
          onClick={() => onStatus(next)}
        >
          {moveLabel(next)}
        </Button>
      ))}
      {!readOnly && isAdrDeletable(adr) && (
        <Button size="small" color="error" onClick={onDelete}>{s('adr.delete')}</Button>
      )}
      {onHistory && (
        <Button size="small" onClick={onHistory}>{s('common.history')}</Button>
      )}
      <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_e, value: Mode | null) => onMode(value)}>
        <ToggleButton value="read">{s('adr.read')}</ToggleButton>
        {canEdit && <ToggleButton value="edit">{s('adr.edit')}</ToggleButton>}
      </ToggleButtonGroup>
    </Box>
  )
}

// --- the notices ----------------------------------------------------------------------

function Notice({ testId, warning = false, children }: { testId?: string; warning?: boolean; children: ReactNode }) {
  return (
    <Typography
      variant="caption"
      data-testid={testId}
      sx={{ px: 2, py: 0.5, borderBottom: 1, borderColor: 'divider', color: warning ? 'warning.main' : 'text.secondary' }}
    >
      {children}
    </Typography>
  )
}

/**
 * What the record says about itself under the bar: what acceptance still
 * needs, that it is locked, a successor that is not in force, and an
 * approval that is only the proposer's own.
 */
export function ReaderNotices({ adr, list, readOnly, s }: { adr: Adr; list: readonly Adr[]; readOnly: boolean; s: Translate }) {
  const gate = readOnly ? undefined : acceptGateOf(adr, list)
  const ownApproval = (adr.status === 'reviewing' || adr.status === 'accepted') && selfAccepted(adr)
  return (
    <>
      {gate && <GateChecklist items={gate.items} s={s} />}
      {isAdrLocked(adr) && <Notice>{s('adr.locked', { status: s(STATUS_LABEL[adr.status]).toLowerCase() })}</Notice>}
      {supersededByUnaccepted(adr, list) && <Notice testId="adr-broken-successor" warning>{s('adr.brokenSuccessor')}</Notice>}
      {ownApproval && <Notice testId="adr-self-accepted" warning>{s('adr.selfAccepted', { name: adr.proposedBy ?? '' })}</Notice>}
    </>
  )
}

/** The gate to acceptance as a checklist: the one move that locks a record says what it waits for. */
function GateChecklist({ items, s }: { items: readonly { item: AdrGateItem; ok: boolean }[]; s: Translate }) {
  return (
    <Box
      data-testid="adr-gate"
      sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 2, rowGap: 0.25, px: 2, py: 0.75, borderBottom: 1, borderColor: 'divider' }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {s('adr.gateTitle', { status: s(STATUS_LABEL.accepted) })}
      </Typography>
      {items.map(({ item, ok }) => (
        <Typography
          key={item}
          variant="caption"
          data-gate-item={item}
          data-ok={ok ? 'true' : 'false'}
          sx={{ color: ok ? 'success.main' : 'text.secondary' }}
        >
          {ok ? '✓' : '○'} {s(GATE_LABEL[item])}
        </Typography>
      ))}
    </Box>
  )
}

// --- the front matter -------------------------------------------------------------------

export function Term({ children }: { children: ReactNode }) {
  return <Box component="dt" sx={{ color: 'text.secondary', fontWeight: 500 }}>{children}</Box>
}

/** One row of links to other records: a term, and each as a button. Nothing when there are none. */
function LinkRow({ term, links, testId }: {
  term: string
  links: readonly { key: string; label: string; onOpen: () => void }[]
  testId?: string
}) {
  if (links.length === 0) return null
  return (
    <>
      <Term>{term}</Term>
      <Box component="dd" sx={{ m: 0 }} data-testid={testId}>
        {links.map((link, i) => (
          <Box component="span" key={link.key}>
            {i > 0 && ', '}
            <Link component="button" type="button" onClick={link.onOpen} sx={{ fontSize: 'inherit', verticalAlign: 'baseline' }}>
              {link.label}
            </Link>
          </Box>
        ))}
      </Box>
    </>
  )
}

/**
 * MADR front matter, as a definition list rather than prose: status and its
 * successor, day, decision-makers, who proposed it, why it ended, what it
 * supersedes, and what rests on it.
 */
export function FrontMatter({ adr, list, canEdit, s, day, onUpdate, onSelect, plans, solutions }: {
  adr: Adr
  list: readonly Adr[]
  canEdit: boolean
  s: Translate
  day: (value: string) => string
  onUpdate: (patch: AdrPatch) => void
  onSelect: (adrId: string) => void
  plans?: { list: readonly Transition[]; onOpen(transitionId: string): void }
  solutions?: { list: readonly Pick<Solution, 'id' | 'number' | 'title' | 'decision'>[]; onOpen(solutionId: string): void }
}) {
  const nameOf = namer(list)
  const successor = adr.supersededBy ? list.find((a) => a.id === adr.supersededBy) : undefined
  const deciders = adr.signers.map((signer) => signer.name.trim()).filter(Boolean)
  const predecessors = list.filter((a) => a.supersededBy === adr.id)
    .map((p) => ({ key: p.id, label: s('adr.supersedes', { name: nameOf(p.id) }), onOpen: () => onSelect(p.id) }))
  // Derived, as the plans are: the solution names its record, and the record reads the name back.
  const decidedFor = (solutions?.list ?? []).filter((solution) => solution.decision === adr.id)
    .map((one) => ({ key: one.id, label: `${solutionLabel(one.number)} ${one.title}`, onOpen: () => solutions?.onOpen(one.id) }))
  const resting = (plans?.list ?? []).filter((plan) => plan.decisions.includes(adr.id))
    .map((plan) => ({ key: plan.id, label: `${transitionLabel(plan)} ${plan.title}`, onOpen: () => plans?.onOpen(plan.id) }))
  return (
    <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 3, rowGap: 0.5, mt: 2, mb: 0, fontSize: 14 }}>
      <Term>{s('adr.status')}</Term>
      <Box component="dd" sx={{ m: 0 }}>
        {s(STATUS_LABEL[adr.status])}
        {successor && (
          <> · <Link component="button" type="button" onClick={() => onSelect(successor.id)} sx={{ fontSize: 'inherit', verticalAlign: 'baseline' }}>
            {s('adr.supersededBy', { name: nameOf(successor.id) })}
          </Link></>
        )}
      </Box>
      <Term>{s('adr.date')}</Term>
      <Box component="dd" sx={{ m: 0 }}>{day(adr.date)}</Box>
      <Term>{s('adr.deciders')}</Term>
      <Box component="dd" sx={{ m: 0, color: deciders.length ? 'inherit' : 'text.secondary' }}>
        {deciders.length ? deciders.join(', ') : '—'}
      </Box>
      <ProposedByRow adr={adr} canEdit={canEdit} s={s} onUpdate={onUpdate} />
      {adr.reason && (
        <>
          <Term>{s('adr.reason')}</Term>
          <Box component="dd" sx={{ m: 0 }} data-testid="adr-reason">{adr.reason}</Box>
        </>
      )}
      <SupersedesRow adr={adr} list={list} canEdit={canEdit} s={s} onUpdate={onUpdate} onSelect={onSelect} />
      <LinkRow term={s('adr.statusSuperseded')} links={predecessors} />
      <LinkRow term={s('adr.decidedFor')} links={decidedFor} testId="adr-decided-for" />
      <LinkRow term={s('adr.plans')} links={resting} testId="adr-plans" />
    </Box>
  )
}

/** Who proposed it: a field while the record is written, a name once it is not, nothing when nobody said. */
function ProposedByRow({ adr, canEdit, s, onUpdate }: { adr: Adr; canEdit: boolean; s: Translate; onUpdate: (patch: AdrPatch) => void }) {
  if (!canEdit && !adr.proposedBy) return null
  return (
    <>
      <Term>{s('adr.proposedBy')}</Term>
      <Box component="dd" sx={{ m: 0 }}>
        {canEdit ? (
          <ProposedByField value={adr.proposedBy ?? ''} label={s('adr.proposedBy')} onCommit={(proposedBy) => onUpdate({ proposedBy })} />
        ) : adr.proposedBy}
      </Box>
    </>
  )
}

/**
 * Who proposed it: typed, and committed when the field is left — a name is
 * not worth a commit per keystroke.
 */
function ProposedByField({ value, label, onCommit }: { value: string; label: string; onCommit: (next: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])
  const commit = () => { if (draft.trim() !== value) onCommit(draft) }
  return (
    <TextField
      variant="standard"
      size="small"
      value={draft}
      slotProps={{ htmlInput: { 'aria-label': label } }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => { if (event.key === 'Enter') commit() }}
    />
  )
}

/**
 * What the record supersedes: picked from the accepted records while it is
 * written, and read as "Will supersede …" once it is under way and not yet
 * accepted. Accepting it supersedes them in the same step.
 */
function SupersedesRow({ adr, list, canEdit, s, onUpdate, onSelect }: {
  adr: Adr
  list: readonly Adr[]
  canEdit: boolean
  s: Translate
  onUpdate: (patch: AdrPatch) => void
  onSelect: (adrId: string) => void
}) {
  const nameOf = namer(list)
  if (!canEdit) {
    const pending = adr.status === 'accepted' || adr.status === 'superseded' ? [] : (adr.supersedes ?? [])
    return (
      <LinkRow
        term={s('adr.supersedesField')}
        links={pending.map((id) => ({ key: id, label: s('adr.willSupersede', { name: nameOf(id) }), onOpen: () => onSelect(id) }))}
      />
    )
  }
  const supersedable = list.filter((other) => other.id !== adr.id && other.status === 'accepted')
  if (supersedable.length === 0) return null
  return (
    <>
      <Term>{s('adr.supersedesField')}</Term>
      <Box component="dd" sx={{ m: 0 }}>
        <TextField
          select
          variant="standard"
          size="small"
          fullWidth
          value={adr.supersedes ?? []}
          helperText={s('adr.supersedesHelp')}
          slotProps={{
            select: { multiple: true, 'aria-label': s('adr.supersedesField') } as Record<string, unknown>,
          }}
          data-testid="adr-supersedes"
          onChange={(event) => {
            const value = event.target.value as unknown
            onUpdate({ supersedes: Array.isArray(value) ? value as string[] : String(value).split(',').filter(Boolean) })
          }}
        >
          {supersedable.map((other) => (
            <MenuItem key={other.id} value={other.id}>{nameOf(other.id)}</MenuItem>
          ))}
        </TextField>
      </Box>
    </>
  )
}

// --- the contents -----------------------------------------------------------------------

/** The headings, as a row that scrolls the sheet to each. Nothing when there are none. */
export function Contents({ headings, root, s }: {
  headings: readonly { id: string; text: string; level: number }[]
  root: RefObject<HTMLDivElement | null>
  s: Translate
}) {
  if (headings.length === 0) return null
  const scrollTo = (headingText: string) => {
    const candidates = root.current?.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')
    const target = Array.from(candidates ?? []).find((el) => el.textContent?.trim() === headingText)
    target?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, py: 1.5, mt: 2, mb: 2, borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '.05em' }}>
        {s('adr.contents')}
      </Typography>
      {headings.map((h, index) => (
        <Typography
          key={`${h.id}-${index}`}
          component="button"
          type="button"
          variant="caption"
          onClick={() => scrollTo(h.text)}
          sx={{ border: 0, p: 0, bgcolor: 'transparent', color: 'text.secondary', cursor: 'pointer', pl: h.level === 3 ? 1.5 : 0, '&:hover': { color: 'primary.main' } }}
        >
          {h.text}
        </Typography>
      ))}
    </Box>
  )
}
