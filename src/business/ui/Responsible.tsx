// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Show who is responsible* (ADR-0036, amended 11 October 2026): a chip on
 * each area, grouping and capability naming the units its `assigned` rows
 * point at — here or elsewhere in the tree, counted once — and the ones
 * nobody answers for marked. A unit that serves neither the function's domain
 * nor sits under one that does is drawn as a warning, as the check says it.
 *
 * Off by default and the page's own, for the session: a view of the sheet,
 * not something the sheet says.
 */
import { useMemo } from 'react'
import Box from '@mui/material/Box'
import type { DesignModel, ElementId, Relation } from '../../model'
import type { Translate } from '../../i18n'
import { coverageOf } from '../coverage'
import type { SheetResponsible } from './FunctionInspector'

/** One actor a function is assigned to, as a chip says it. */
export type Holder = { id: ElementId; name: string; outside: boolean }

/** Who answers for each function on the page, while *Show who is responsible* is on. */
export type Who = { of(functionId: ElementId): readonly Holder[] }

/** The rows over the page, read once per model; nothing while the toggle is off. */
export function useWho(
  model: DesignModel, elsewhere: readonly Relation[] | undefined, responsible: SheetResponsible | undefined, shown: boolean,
): Who | undefined {
  return useMemo(() => {
    if (!shown || !responsible) return undefined
    const coverage = coverageOf(model.relations, elsewhere)
    const named = (id: ElementId) => model.elements.find((one) => one.id === id)?.name ?? responsible.name(id) ?? id
    return {
      of: (functionId) => (coverage.get(functionId)?.assignedTo ?? [])
        .map((id) => ({ id, name: named(id), outside: !responsible.serves(id, functionId) })),
    }
  }, [model, elsewhere, responsible, shown])
}

/** The chips under a name: each unit responsible, or *nobody*, marked. Plain text, since a card is itself a button. */
export function ResponsibleChips({ who, functionId, t }: { who: Who | undefined; functionId: ElementId; t: Translate }) {
  if (!who) return null
  const holders = who.of(functionId)
  const chip = {
    display: 'inline-block', fontSize: 9.5, fontWeight: 400, letterSpacing: 0, textTransform: 'none',
    lineHeight: '16px', px: 0.75, borderRadius: 8, border: 1, mr: 0.5, mt: 0.25,
  } as const
  return (
    <Box component="span" data-testid={`sheet-responsible-${functionId}`} sx={{ display: 'block' }}>
      {holders.length === 0 && (
        <Box component="span" data-responsible="nobody" sx={{ ...chip, borderStyle: 'dashed', borderColor: 'warning.main', color: 'warning.main' }}>
          {t('sheet.responsibleNobody')}
        </Box>
      )}
      {holders.map((one) => (
        <Box
          component="span" key={one.id} data-responsible={one.outside ? 'outside' : 'serves'}
          sx={{ ...chip, borderColor: one.outside ? 'warning.main' : 'divider', color: one.outside ? 'warning.main' : 'text.primary', bgcolor: 'action.hover' }}
        >
          {one.outside ? `${one.name} · ${t('sheet.assignedOutside')}` : one.name}
        </Box>
      ))}
    </Box>
  )
}
