// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What is still open on a plan's day (ADR-0036 §6, §7), at the foot of the
 * plan's organisation: what the checks find then in the units under the
 * change, every responsibility that loses its *A*, and every interaction the
 * plan's units are left to declare — an interface that crosses from one of
 * them to another unit with nothing declared between the two, as the Conway
 * map of that day finds it (`model/reorganisation.interactionsToDeclare`).
 *
 * In the one list of findings (`widgets/FindingsList`, ADR-0036 amended 11
 * October 2026), each said under its check: a responsibility that loses its
 * *A* is the operating model's `check.accountability`, and an interaction to
 * declare the Conway map's `check.interfaceUndeclared`. A finding about a unit
 * opens the unit from its explanation; an interaction to declare offers
 * *Declare an interaction…*, which opens the plan's unit, whose *Works with*
 * declares it, and *Open the two units*; one about a person or a
 * responsibility is explained and opens nothing here.
 */
import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import { CHECK_LIST_WORDS, groupByCheck } from '../../model/checkCatalogue'
import type { CheckAction, CheckKey } from '../../model/checkCatalogue'
import type { HostModel } from '../../model/hostModel'
import type { Responsibility } from '../../model/operatingModel'
import { interactionsToDeclare, lostAccountability, reorganisationRoots, reorganisedUnits, unitTree } from '../../model/reorganisation'
import type { PlanReorganisation, UnitNode } from '../../model/reorganisation'
import { personOf, runsOn } from '../../model/units'
import { checkMarksHere } from '../../projects/checkMarks'
import { findingSentence, findingsOfOrganisation } from '../../projects/checks'
import type { Finding, OrganisationAt } from '../../projects/checks'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import { FindingsList } from '../../widgets/FindingsList'
import type { FindingActions } from '../../widgets/FindingsList'
import { useFindingMarks } from '../checkMarking'
import type { MoveNames } from './MovePeople'
import { conwayInputAround } from './unitViewsHere'

export type StillOpenProps = {
  at: OrganisationAt
  reorganisation: PlanReorganisation
  responsibilities: readonly Responsibility[]
  names: MoveNames
  /** The day before the plan's first day, and its last. */
  before: string
  after: string
  /** Where the applications and the interfaces are read from: the index, with the open scope's session laid over it. */
  index: ScopeIndex
  scope: ScopePath
  model: HostModel
  scopeLabel: (path: ScopePath) => string
  onOpen: ((id: string) => void) | undefined
  /** Where the session keeps the list's folds: the plan's own. */
  remember: string
  s: Translate
}

/** One thing still open, under the check it is: the unit it is about, and for an interaction the unit it is to be declared with. */
type Line = { key: CheckKey; text: string; unitId?: string; withId?: string; finding?: Finding }

/** What a plan's page does for a line: open the unit, or the plan's unit where an interaction is to be declared. */
function stillOpenActions(onOpen: ((id: string) => void) | undefined, names: MoveNames): FindingActions<Line, CheckAction> {
  const opening = (id: string | undefined) => (id !== undefined && onOpen ? () => onOpen(id) : undefined)
  return {
    openUnit: (line) => opening(line.unitId),
    declareInteraction: (line) => (line.withId !== undefined ? opening(line.unitId) : undefined),
    openUnits: (line) => (line.withId !== undefined && onOpen
      ? [line.unitId, line.withId].flatMap((id) => (id === undefined ? [] : [{ key: id, label: names.unit(id), run: () => onOpen(id) }]))
      : undefined),
  }
}

export function StillOpen(props: StillOpenProps) {
  const { at, reorganisation, index, scope, model, before, after, names, onOpen, s } = props
  // The day's Conway map is read off the whole organisation's applications: worked out when what it reads changes.
  const declare = useMemo(() => {
    const around = new Set(reorganisedUnits(at.organisation, reorganisation, after))
    return interactionsToDeclare(conwayInputAround(index, scope, model, at, around), reorganisation, { before, after })
  }, [at, reorganisation, index, scope, model, before, after])
  const lines = [
    ...checksAndAccountability(props),
    ...declare.map((one): Line => ({
      key: 'check.interfaceUndeclared', text: s('move.declare', { unit: names.unit(one.unitId), other: names.unit(one.withId) }),
      unitId: one.unitId, withId: one.withId,
    })),
  ]
  // One marked as intended is not still open: it is listed under Accepted. A line said from no finding is never marked.
  const marks = useMemo(() => checkMarksHere(index, scope, model), [index, scope, model])
  const { shown, more, accepted } = useFindingMarks(lines, { findingOf: (line) => line.finding, sentence: (line) => line.text, marks, remember: props.remember })
  const groups = groupByCheck(shown)
  return (
    <Box data-testid="plan-still-open">
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mt: 1.5, mb: 0.5 }}>{s('move.stillOpen', { day: after })}</Typography>
      <FindingsList
        groups={groups} words={CHECK_LIST_WORDS} sentence={(line) => line.text} keyOf={(line) => `${line.key}|${line.text}`}
        actions={stillOpenActions(onOpen, names)} attributesOf={() => ({ 'data-testid': 'plan-open-line' })} remember={props.remember}
        more={more} accepted={accepted}
        empty={<Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('move.stillOpenNone')}</Typography>}
      />
    </Box>
  )
}

/** The sentences of the checks of the day in the units under the change, then the responsibilities without their A — each once. */
function checksAndAccountability({ at, reorganisation, responsibilities, before, after, scopeLabel, names, s }: StillOpenProps): Line[] {
  const roots = reorganisationRoots(at.organisation, reorganisation, before, after)
  const walk = (nodes: readonly UnitNode[]): string[] => nodes.flatMap((node) => [node.unit.id, ...walk(node.children)])
  const units = new Set(walk(unitTree(at.organisation, after, roots)))
  const persons = new Set(at.organisation.assignments
    .filter((one) => units.has(one.unitId) && runsOn(one, after)).map((one) => names.canonical(personOf(one))))
  const said = new Set<string>()
  const found = findingsOfOrganisation(at, after, names.canonical)
    .filter((one) => (one.person !== undefined ? persons.has(one.person) : units.has(one.id)))
    .map((one): Line => ({
      key: one.key, text: findingSentence(one, s, scopeLabel, names.person), finding: one, ...(one.person === undefined ? { unitId: one.id } : {}),
    }))
  // A responsibility left without its A on the day is the operating model's own check.
  const lost = lostAccountability(responsibilities, at.organisation, before, after)
    .map((one): Line => ({ key: 'check.accountability', text: s('move.lostA', { responsibility: one.name }) }))
  return [...found, ...lost].filter((line) => (said.has(line.text) ? false : (said.add(line.text), true)))
}
