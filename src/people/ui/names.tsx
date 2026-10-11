// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a screen that shows or asks for a person is handed (ADR-0036 §8): the
 * register as it reads now, in the screen's words. Every page with a name
 * field — an element's owner, a plan's, who saw an observation, who runs an
 * experiment, who proposed and who signed a decision — renders a reference
 * through this, so a forget made once in the register reaches all of them at
 * once, and a merged id reads as the entry it went into.
 *
 * Built once per register by the shell (`personNames`) and handed down as one
 * object in a context (`PersonNamesProvider`), so every page under the shell
 * reads the same register without each page passing it on, and a page
 * memoised on it is drawn again only when the register changes. With no
 * provider — a page tested on its own — a reference reads as its text.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import type { PersonId, PersonRef } from '../../model/person'
import { personIdOf, personRefOf } from '../../model/person'
import type { Person } from '../person'
import { peopleMatching } from '../matching'
import { registerOf, resolvePerson, shownPerson, shownText } from '../shown'
import type { Translate } from '../shown'
import type { PeopleRegisterAccess } from './access'

export type PersonNames = {
  /** What a reference reads as: the name, the pseudonym, *a former colleague*, or the text as typed. */
  text(ref: PersonRef | undefined): string
  /**
   * The name an entry has now, for a signature to keep (ADR-0036 §8): the
   * entry a merge kept, and nothing once it is forgotten or gone.
   */
  nameOf(id: PersonId): string | undefined
  /** The id that answers for an id: the entry a merge kept, or the id itself. */
  canonical(id: PersonId): PersonId
  /** Whether a reference is the person using the app (*you*). */
  isMe(ref: PersonRef | undefined): boolean
  /**
   * For a search: the register ids a folded word of the query names, by what
   * each entry reads as here (`people/search.ts`) — so a record that points
   * at a person is found by their name, and no index holds it.
   */
  match(token: string): ReadonlySet<PersonId>
  /** The register, for picking and adding; absent where it is not there, and a field then takes text alone. */
  access?: PeopleRegisterAccess
}

/** What a reference reads as before the register has been read: not yet anybody. */
export const NOT_READ = '…'

/** The names over a register as the shell holds it; with none, every reference reads as its text. */
export function personNames(access: PeopleRegisterAccess | undefined, t: Translate): PersonNames {
  const people: readonly Person[] | undefined = access?.people
  const register = registerOf(people ?? [])
  const canonical = (id: PersonId) => resolvePerson(id, register)?.id ?? id
  return {
    text: (ref) => {
      const held = personRefOf(ref)
      if (held === undefined) return ''
      if (personIdOf(held) !== undefined && people === undefined) return NOT_READ
      return shownText(shownPerson(held, register), t)
    },
    nameOf: (id) => {
      const kept = resolvePerson(id, register)
      return kept?.state === 'forgotten' ? undefined : kept?.name
    },
    canonical,
    match: peopleMatching(people ?? [], (shown) => shownText(shown, t)),
    isMe: (ref) => {
      const id = personIdOf(ref)
      return id !== undefined && access?.me !== undefined && canonical(id) === canonical(access.me)
    },
    ...(access ? { access } : {}),
  }
}

/** Text only: what a page reads names with when it is handed no register — a test, a reader with none. */
export function textNames(t: Translate): PersonNames {
  return personNames(undefined, t)
}

const PersonNamesContext = createContext<PersonNames | undefined>(undefined)

/** The register's names for everything under it: what the shell wraps its pages in. */
export function PersonNamesProvider({ names, children }: { names: PersonNames | undefined; children: ReactNode }) {
  return <PersonNamesContext.Provider value={names}>{children}</PersonNamesContext.Provider>
}

/** The names the shell provides, or text alone where it provides none. */
export function usePersonNames(): PersonNames {
  const held = useContext(PersonNamesContext)
  const { t } = useStrings()
  const plain = useMemo(() => textNames(t), [t])
  return held ?? plain
}
