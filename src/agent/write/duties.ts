// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a call says of a duty beside its letter (ADR-0052), for the two tools
 * that say it: a role's whole list (`role.add`, `role.update`) and one cell of
 * the RACI (`raci.set`). A field left out keeps what is there and null takes it
 * away, which is `dutiesWith`'s to do; this reads what was said, and refuses
 * what the source cannot keep.
 */
import type { DutySaid } from '../../model/operatingModel'
import type { UnkeptPart } from '../../platform/sourceProvider'
import type { Certainty } from '../../model/types'
import type { AgentAnswer } from '../tools'
import { notKept } from '../unkept'
import type { UnkeptSaid } from '../unkept'

/** The fields of a duty beside its letter. */
export const DUTY_SAID = ['alsoResponsible', 'certainty', 'source'] as const

type Field = (typeof DUTY_SAID)[number]

const PART: Readonly<Record<Field, UnkeptPart>> = {
  alsoResponsible: 'duty.alsoResponsible', certainty: 'duty.certainty', source: 'duty.source',
}

/** What a duty is given as: any of the fields, unread. */
export type GivenDuty = { readonly [F in Field]?: unknown }

/** Whether a call says anything beside the letter. */
export function saysMore(given: GivenDuty): boolean {
  return DUTY_SAID.some((field) => given[field] !== undefined)
}

/** The fields a call says, a source trimmed and a blank one taken away. */
export function dutySaid(given: GivenDuty): DutySaid {
  const { alsoResponsible, certainty, source } = given
  return {
    ...(alsoResponsible !== undefined ? { alsoResponsible: alsoResponsible === true } : {}),
    ...(certainty !== undefined ? { certainty: certainty as Certainty | null } : {}),
    ...(source !== undefined ? { source: (typeof source === 'string' && source.trim()) || null } : {}),
  }
}

/** The refusal for the first field named that the source cannot keep yet. */
export function dutyNotKept(view: UnkeptSaid, given: readonly GivenDuty[]): AgentAnswer | undefined {
  for (const field of DUTY_SAID) {
    const refusal = given.some((one) => one[field] !== undefined) ? notKept(view, PART[field], field) : undefined
    if (refusal) return refusal
  }
  return undefined
}

/** Why a field cannot be said beside this letter, or nothing: also responsible is said beside an A. */
export function wrongBeside(given: GivenDuty, raci: string): string | undefined {
  return given.alsoResponsible === true && raci !== 'A' ? `alsoResponsible is said beside an A, and the letter is ${raci}` : undefined
}
