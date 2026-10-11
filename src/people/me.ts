// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *This is me* (ADR-0036): which entry of the register is the person using
 * this install, so every screen can mark *you* wherever they appear.
 *
 * A preference kept with the install, not with the work (ADR-0023): the
 * person's own settings of the source that is open (`SettingsRepository`,
 * `of: 'person'`), under `people.me` — the desktop keeps those in its own
 * data folder, beside what it does about the folder, and never in it. In
 * Team an account is linked to its entry instead, and this is not asked.
 */
import type { PersonId } from '../model/person'
import type { Person } from './person'
import { registerOf, resolvePerson } from './shown'
import type { Register } from './shown'

/** The key *This is me* is kept under in the person's own settings. */
export const ME_KEY = 'people'

/** The entry this install takes to be its person, as the settings say; `undefined` where none was said. */
export function meOf(settings: { readonly [key: string]: unknown }): PersonId | undefined {
  const held = settings[ME_KEY]
  if (typeof held !== 'object' || held === null || Array.isArray(held)) return undefined
  const me = (held as Record<string, unknown>).me
  return typeof me === 'string' && me !== '' ? me : undefined
}

/** The settings patch that says who this install's person is, or — `undefined` — that it says nobody. */
export function mePatch(id: PersonId | undefined): { [ME_KEY]: { me: string | null } } {
  return { [ME_KEY]: { me: id ?? null } }
}

/**
 * The entry that is *you*, followed through a merge, and only while it is
 * there and has a name: a forgotten entry is nobody's to be.
 */
export function meIn(me: PersonId | undefined, register: Register): Person | undefined {
  if (me === undefined) return undefined
  const person = resolvePerson(me, register)
  return person && person.state !== 'forgotten' ? person : undefined
}

/** The id of the entry that is *you* in a register as it is listed: {@link meIn}, for a screen comparing entries by id. */
export function meIdIn(me: PersonId | undefined, people: readonly Person[] | undefined): PersonId | undefined {
  return me === undefined ? undefined : meIn(me, registerOf(people ?? []))?.id
}
