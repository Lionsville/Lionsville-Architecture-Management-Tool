// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The records that point at a person (ADR-0036 §8, §10): every name field
 * that holds the person's register id — an element's owner, a plan's, who saw
 * an observation, who runs an experiment, who proposed and who signed a
 * decision — and, for a signature, the name it kept.
 *
 * What the People page's *Points at them* lists and *What we hold* answers a
 * request for access with. Read by field, not by shape, because what is said
 * is which field: *owner*, *seen by*, *signed as*. Text typed into a field is
 * not here — it points at nobody; a search for the name finds it.
 */
import type { Adr } from './adr'
import type { Experiment, Observation } from './observation'
import type { PersonId, PersonRef } from './person'
import { personIdOf } from './person'
import type { Transition } from './transition'
import type { DesignElement } from './types'

/** Which field of a record points at the person. */
export type PointerField = 'owner' | 'seenBy' | 'runBy' | 'proposed' | 'signer'

/** One record that points at a person, by the field that does. */
export type Pointer = {
  kind: 'element' | 'plan' | 'observation' | 'experiment' | 'decision'
  id: string
  /** What people call it, where its kind numbers its records: `OB-0007`. */
  label?: string
  title: string
  field: PointerField
  /** The id the field holds: the person's own, or one merged into it. */
  person: PersonId
  /** The name a signature kept: part of the record, kept after the person is forgotten. */
  signedAs?: string
}

/** A scope's lists, as whoever reads them has them: every one optional. */
export type PointedModel = {
  readonly elements?: readonly DesignElement[]
  readonly transitions?: readonly Transition[]
  readonly observations?: readonly Observation[]
  readonly experiments?: readonly Experiment[]
  readonly decisions?: readonly Adr[]
}

function numbered(prefix: string, number: number): string {
  return `${prefix}-${String(Math.max(0, Math.trunc(number))).padStart(4, '0')}`
}

/**
 * Every record of a model whose name fields point at one of `ids`, in the
 * model's order: elements, plans, observations, experiments, decisions. A
 * stand-in carries no owner (ADR-0012 §3), so an element is listed where it
 * is defined and nowhere else.
 */
export function pointersIn(model: PointedModel, ids: ReadonlySet<PersonId>): Pointer[] {
  const found: Pointer[] = []
  const at = (ref: PersonRef | undefined): PersonId | undefined => {
    const id = personIdOf(ref)
    return id !== undefined && ids.has(id) ? id : undefined
  }
  const push = (pointer: Omit<Pointer, 'person'>, ref: PersonRef | undefined) => {
    const person = at(ref)
    if (person !== undefined) found.push({ ...pointer, person })
  }
  for (const element of model.elements ?? []) {
    if (element.ref === undefined) push({ kind: 'element', id: element.id, title: element.name, field: 'owner' }, element.owner)
  }
  for (const plan of model.transitions ?? []) {
    push({ kind: 'plan', id: plan.id, label: numbered('TR', plan.number), title: plan.title, field: 'owner' }, plan.owner)
  }
  for (const one of model.observations ?? []) {
    push({ kind: 'observation', id: one.id, label: numbered('OB', one.number), title: one.title, field: 'seenBy' }, one.by)
  }
  for (const one of model.experiments ?? []) {
    push({ kind: 'experiment', id: one.id, label: numbered('EX', one.number), title: one.title, field: 'runBy' }, one.by)
  }
  for (const adr of model.decisions ?? []) {
    const record = { kind: 'decision' as const, id: adr.id, label: numbered('ADR', adr.number), title: adr.title }
    push({ ...record, field: 'proposed', ...(adr.proposedAs ? { signedAs: adr.proposedAs } : {}) }, adr.proposedBy)
    for (const signer of adr.signers) {
      push({ ...record, field: 'signer', ...(signer.signedAs ? { signedAs: signer.signedAs } : {}) }, signer.name)
    }
  }
  return found
}
