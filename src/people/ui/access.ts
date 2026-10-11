// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the People page is handed (ADR-0036): the register as the shell holds
 * it, and each change to it — declared here, in the page's own terms, so the
 * page asks for exactly this and the shell's hook (`usePeopleRegister`)
 * satisfies it by its shape.
 *
 * And the one place the page says how a change went: a refusal is a key from
 * the register, a failure a key where it carries one, and a change made a
 * sentence the page words — said in the page's status line, because the
 * register keeps no Activity line to say it in.
 */
import { useCallback, useState } from 'react'
import type { PersonId } from '../../model/person'
import { ShellError } from '../../platform/errors'
import type { HeldAssignment, Mention, PointsAt } from '../hold'
import type { NewPerson, PeopleAction, PeopleRefusal, Person, PersonPatch, PolicyHold } from '../person'
import type { PeoplePolicy } from '../policy'
import type { Translate } from '../shown'

export type Refused = { refused: PeopleRefusal }

export type PeopleRegisterAccess = {
  /** Every entry, redirects included; `undefined` until the register has been read. */
  people: readonly Person[] | undefined
  policy: PeoplePolicy
  me: PersonId | undefined
  /** Who *you* are is the source's word (an account linked to an entry), and *This is me* is not offered. */
  meSaid?: boolean
  readOnly: boolean
  /**
   * Whether this person may make one kind of change — of one entry, where the
   * answer is the entry's. Absent, every change is `readOnly`'s to say.
   */
  may?(action: PeopleAction, id?: PersonId): boolean
  /** Whether an entry has a work address this person is not shown. */
  withheld?(id: PersonId): boolean
  /** Why the source's own schedule held an entry back from being forgotten. */
  held?(id: PersonId): PolicyHold | undefined
  today: string
  add(person: NewPerson): Promise<{ person: Person } | Refused>
  change(id: PersonId, patch: PersonPatch): Promise<{ person: Person } | Refused>
  leave(id: PersonId, on: string): Promise<{ person: Person; ended: number } | Refused>
  forget(id: PersonId, on: string): Promise<{ person: Person; ended: number } | Refused>
  remove(id: PersonId): Promise<{ removed: readonly PersonId[] } | Refused>
  merge(from: PersonId, into: PersonId): Promise<{ person: Person } | Refused>
  setPolicy(change: Partial<PeoplePolicy>): Promise<void>
  setMe(id: PersonId | undefined): Promise<void>
  mentionsOf(name: string): Promise<Mention[]>
  /**
   * The assignments a person holds across the tree — under their id and every
   * id merged into it — past, present and to come (ADR-0036 §4). Absent where
   * the shell has no tree to read.
   */
  assignmentsOf?(id: PersonId): readonly HeldAssignment[]
  /**
   * Everything across the tree that points at a person — under their id and
   * every id merged into it — by its fields: the records that name them, the
   * signatures that kept their name, and what the operating model's rules
   * make them own today (ADR-0036 §8). Absent where the shell has no tree.
   */
  pointsAt?(id: PersonId): Promise<PointsAt>
}

/** Whether the page offers one kind of change: the register may be written here, and — where the source says who may do what — by this person, of this entry. */
export function mayDo(register: Pick<PeopleRegisterAccess, 'readOnly' | 'may'>, action: PeopleAction, id?: PersonId): boolean {
  return !register.readOnly && (register.may?.(action, id) ?? true)
}

/** What the status line says, and how loudly. */
export type Said = { text: string; tone: 'success' | 'error' }

export type Saying = {
  said: Said | undefined
  /**
   * Run a change, and say how it went: `done` words a change made; a refusal
   * and a failure are said in the register's words. Answers the change, or
   * `undefined` where it was refused or failed.
   */
  run<T extends object>(work: Promise<T | Refused>, done: (answer: T) => string): Promise<T | undefined>
}

export function useSaying(s: Translate): Saying {
  const [said, setSaid] = useState<Said | undefined>(undefined)
  const run = useCallback(async <T extends object>(work: Promise<T | Refused>, done: (answer: T) => string) => {
    try {
      const answer = await work
      if ('refused' in answer) {
        setSaid({ text: s(answer.refused), tone: 'error' })
        return undefined
      }
      setSaid({ text: done(answer as T), tone: 'success' })
      return answer as T
    } catch (cause) {
      const text = cause instanceof ShellError
        ? s(cause.key, cause.params)
        : s('people.failed', { message: cause instanceof Error ? cause.message : String(cause) })
      setSaid({ text, tone: 'error' })
      return undefined
    }
  }, [s])
  return { said, run }
}
