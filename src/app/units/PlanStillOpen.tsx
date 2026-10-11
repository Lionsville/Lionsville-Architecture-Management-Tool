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
 * A line about a unit is a link to it, as every list of findings is — an
 * interaction to declare opens the plan's unit, whose *Works with* declares
 * it; one about a person or a responsibility is a line.
 */
import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { HostModel } from '../../model/hostModel'
import type { Responsibility } from '../../model/operatingModel'
import { interactionsToDeclare, lostAccountability, reorganisationRoots, reorganisedUnits, unitTree } from '../../model/reorganisation'
import type { PlanReorganisation, UnitNode } from '../../model/reorganisation'
import { personOf, runsOn } from '../../model/units'
import { findingSentence, findingsOfOrganisation } from '../../projects/checks'
import type { OrganisationAt } from '../../projects/checks'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
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
  s: Translate
}

type Line = { text: string; unitId?: string }

export function StillOpen(props: StillOpenProps) {
  const { at, reorganisation, index, scope, model, before, after, names, onOpen, s } = props
  // The day's Conway map is read off the whole organisation's applications: worked out when what it reads changes.
  const declare = useMemo(() => {
    const around = new Set(reorganisedUnits(at.organisation, reorganisation, after))
    return interactionsToDeclare(conwayInputAround(index, scope, model, at, around), reorganisation, { before, after })
  }, [at, reorganisation, index, scope, model, before, after])
  const lines = [
    ...checksAndAccountability(props),
    ...declare.map((one): Line => ({ text: s('move.declare', { unit: names.unit(one.unitId), other: names.unit(one.withId) }), unitId: one.unitId })),
  ]
  return (
    <Box data-testid="plan-still-open">
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mt: 1.5, mb: 0.5 }}>{s('move.stillOpen', { day: after })}</Typography>
      {lines.length === 0 && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('move.stillOpenNone')}</Typography>}
      {lines.map((line, at) => (
        <Typography key={`${at}/${line.text}`} sx={{ fontSize: 12, color: 'warning.main' }} data-testid="plan-open-line">
          {line.unitId !== undefined && onOpen
            ? <Link component="button" type="button" color="inherit" underline="hover" sx={{ fontSize: 'inherit', textAlign: 'left' }}
              onClick={() => onOpen(line.unitId!)}>{line.text}</Link>
            : line.text}
        </Typography>
      ))}
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
    .map((one) => ({ text: findingSentence(one, s, scopeLabel, names.person), ...(one.person === undefined ? { unitId: one.id } : {}) }))
  const lost = lostAccountability(responsibilities, at.organisation, before, after)
    .map((one) => ({ text: s('move.lostA', { responsibility: one.name }) }))
  return [...found, ...lost].filter((line) => (said.has(line.text) ? false : (said.add(line.text), true)))
}
