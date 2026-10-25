// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Who records an observation, and whose are *Mine* (ADR-0038, amended §10).
 *
 * Where the source has accounts, the account that records — with the entry
 * it is linked to, where it is — and the source checks it; on its own, *This
 * is me* where it is said, and otherwise nobody: nothing is written rather
 * than a word that names no one. An agent records for its person, `via` its
 * client.
 */
import { isPicked } from '../model/person'
import type { PersonId } from '../model/person'
import type { Observation, RecordedBy } from '../model/observation'

/** The account using the app, where the source has accounts. */
export type RecordingAccount = { readonly id: string; readonly name: string }

/** The person *This is me* or the account's link names, with the name the register gives them. */
export type RecordingPerson = { readonly id: PersonId; readonly name: string }

/** Who a new observation is recorded by, or `undefined` where nobody is said. */
export function whoRecords(
  account: RecordingAccount | undefined, me: RecordingPerson | undefined, via?: string,
): RecordedBy | undefined {
  const through = via ? { via } : {}
  if (account) return { name: account.name, account: account.id, ...(me ? { person: me.id } : {}), ...through }
  if (me?.name) return { name: me.name, person: me.id, ...through }
  return undefined
}

/**
 * Whether an observation is mine: recorded by my account, or by the person I
 * am, or seen by that person (`by`). With neither an account nor a person,
 * nothing is.
 */
export function isMine(one: Pick<Observation, 'recordedBy' | 'by'>, account: string | undefined, me: PersonId | undefined): boolean {
  const recorded = one.recordedBy
  if (recorded && account !== undefined && recorded.account === account) return true
  if (me === undefined) return false
  if (recorded?.person === me) return true
  return isPicked(one.by) && one.by.person === me
}
