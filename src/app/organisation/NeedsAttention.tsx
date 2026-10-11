// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The block under the cards: what the organisation contradicts about itself,
 * in the one list of findings every screen draws (`widgets/FindingsList`,
 * ADR-0036 amended 11 October 2026) — grouped by check and folded, fix
 * first, the notes behind *Show notes*, and each instance opening its
 * explanation with the ways from it to where it is fixed.
 *
 * Not shown at all when there is nothing — a heading over an empty list would
 * be a warning about nothing, and a "no problems" line would be saying so
 * before the index has been read. An organisation whose business layer is
 * still being agreed can have forty capabilities proposed by its domains: one
 * row, a note, hidden until asked for, where it used to be forty sentences
 * folded past a handful.
 *
 * **Where an action goes** is where the row used to: the record on its board
 * where it is kept, the view a shape is on, the operating model's page with
 * the item picked — and, for a definition in two scopes, the other one, and
 * *Link…* where this scope may be written. An action the home has nothing to
 * do with (assign, set an owner…) is no button here; the scope's own screens
 * offer it.
 */
import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { ElementId } from '../../model'
import { CHECK_LIST_WORDS, groupByCheck } from '../../model/checkCatalogue'
import type { CheckAction, CheckKey } from '../../model/checkCatalogue'
import type { ScopePath } from '../../projects/scopePath'
import { FindingsList } from '../../widgets/FindingsList'
import type { FindingActions } from '../../widgets/FindingsList'
import type { AttentionItem } from './attention'

export type AttentionDoors = {
  /** Open the scope with the record selected; absent where the host cannot. */
  onOpen?: ((scope: ScopePath, id: ElementId) => void) | undefined
  /** Open the scope on a view, for a finding about something on one; absent where the host cannot. */
  onOpenView?: ((scope: ScopePath, viewId: string) => void) | undefined
  /** Open the operating model's page on an item of it, for a finding about one; absent where the host cannot. */
  onOpenOperating?: ((id: string) => void) | undefined
  /** Make the definition in `scope` a stand-in of the one in `to` (*Link…*); absent where the host cannot. */
  onLink?: ((scope: ScopePath, id: ElementId, to: ScopePath) => void) | undefined
  /** Whether the home's scope may be written: *Link…* is a change. */
  writable?: boolean
}

/** The organisation's findings about a unit, which name the unit as what they are about. */
const ABOUT_A_UNIT: ReadonlySet<CheckKey> = new Set([
  'check.roleVacant', 'check.roleOverMax', 'check.unitMisplaced', 'check.unitSpans', 'check.unitOverLimit',
  'check.assignmentEnded', 'check.unitTypeEnded',
])

/** What the home does for each action: where the row goes, and *Link…* for a definition kept twice. */
export function attentionActions(doors: AttentionDoors): FindingActions<AttentionItem, CheckAction> {
  const { onOpen, onOpenView, onOpenOperating, onLink } = doors
  const record = (item: AttentionItem) => (item.page === undefined && item.view === undefined && onOpen ? () => onOpen(item.scope, item.id) : undefined)
  const operating = (item: AttentionItem) => (item.page === 'operating' && onOpenOperating ? () => onOpenOperating(item.id) : undefined)
  return {
    openElement: record,
    openRow: record,
    openApplication: record,
    openCause: record,
    openUnit: (item) => (ABOUT_A_UNIT.has(item.key) ? record(item) : undefined),
    openDefinition: (item) => {
      const { elsewhere } = item
      return elsewhere !== undefined && onOpen ? () => onOpen(elsewhere, item.id) : undefined
    },
    openView: (item) => {
      const { view } = item
      return view !== undefined && onOpenView ? () => onOpenView(item.scope, view) : undefined
    },
    openOperating: operating,
    openType: operating,
    link: (item) => {
      const { elsewhere } = item
      return item.key === 'check.conflict' && doors.writable === true && elsewhere !== undefined && onLink
        ? () => onLink(elsewhere, item.id, item.scope) : undefined
    },
  }
}

export function NeedsAttention({ items, at, s, ...doors }: AttentionDoors & {
  items: readonly AttentionItem[]
  /** The scope whose home this is: what its folds are kept under for the session. */
  at: ScopePath
  s: Translate
}) {
  const groups = useMemo(() => groupByCheck(items), [items])
  const { onOpen, onOpenView, onOpenOperating, onLink, writable } = doors
  const actions = useMemo(
    () => attentionActions({ onOpen, onOpenView, onOpenOperating, onLink, ...(writable !== undefined ? { writable } : {}) }),
    [onOpen, onOpenView, onOpenOperating, onLink, writable],
  )
  if (items.length === 0) return null
  return (
    <Box sx={{ mb: 4, maxWidth: 760 }} data-testid="needs-attention" data-guide="org.attention">
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, mb: 0.5, textTransform: 'uppercase', color: 'warning.main' }}>
        {s('org.attention')}
      </Typography>
      <FindingsList
        groups={groups} words={CHECK_LIST_WORDS} sentence={(item) => item.text} keyOf={(item) => `${item.key}|${item.scope}|${item.id}`}
        actions={actions}
        // The row's own test id and the one word something outside points at a kind by, as before.
        attributesOf={(item) => ({ 'data-testid': `attention-${item.scope}-${item.id}`, 'data-finding': item.kind })}
        remember={`attention\u0000${at}`} testId="attention-findings"
      />
    </Box>
  )
}
