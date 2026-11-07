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
 *
 * *Mine* (amended 7 November 2026) asks ids first and names second. A name is
 * only ever compared to text that names nobody in the register: a picked
 * `by`, or a `recordedBy` that carries an entry, is answered by that entry, so
 * a namesake with an entry of their own is not me and a name kept beside a
 * forgotten entry connects to nobody. The register is read once, by
 * {@link mineOf}; a row then costs a lookup or two and a fold of its own text.
 *
 * **What a recorder reads as** (ADR-0036 §10, amended 7 November 2026) is
 * {@link recorderShown}, the one function every screen and every answer to an
 * agent reads through, and {@link recorderInCopy} what a copy carries. The entry
 * is the record's, or what the source says of the account; with an entry, a name
 * stored beside it is never read, so a forget reaches it. With none, the
 * source's current name for the account, and then the name stored. Core knows of
 * an account only that a source may answer for it (ADR-0036: core has no
 * accounts).
 */
import { fold } from '../model/textSearch'
import { isPicked, pickedPerson } from '../model/person'
import type { PersonId } from '../model/person'
import type { Observation, RecordedBy, RecorderSource } from '../model/observation'
import { meIn } from '../people/me'
import type { Person } from '../people/person'
import { resolvePerson, shownEntry, shownPerson } from '../people/shown'
import type { Register, Shown, Showing } from '../people/shown'

/** The account using the app, where the source has accounts. */
export type RecordingAccount = { readonly id: string; readonly name: string }

/** The person *This is me* or the account's link names, with the name the register gives them. */
export type RecordingPerson = { readonly id: PersonId; readonly name: string }

/** Who a new observation is recorded by, or `undefined` where nobody is said. */
export function whoRecords(
  account: RecordingAccount | undefined, me: RecordingPerson | undefined, via?: string,
): RecordedBy | undefined {
  const through = via ? { via } : {}
  // An entry answers for the name, so none is written beside it: the name is the register's to forget (amended 7 November 2026).
  if (account) return { ...(me ? { person: me.id } : { name: account.name }), account: account.id, ...through }
  if (me?.name) return { person: me.id, ...through }
  return undefined
}

/** The entry that answers for a recorder: the record's, or the one the source says the account is linked to. */
export function recorderEntry(by: RecordedBy, source?: RecorderSource): PersonId | undefined {
  return by.person ?? (by.account === undefined ? undefined : source?.(by.account)?.person)
}

/** What a recorder reads as: a reference's reading, or a name left out because names are withheld and no entry can stand for it. */
export type RecorderShown = Shown | { as: 'nameWithheld' }

/**
 * What a recorder reads as, for a screen and for an agent alike. With an entry,
 * what the register says of it (`people/shown`): the pseudonym once forgotten,
 * *a former colleague* once removed, the withheld form under a pseudonym policy,
 * the kept entry after a merge. With none, the source's name for the account and
 * then the name stored; nothing where neither says anything. A pseudonym policy
 * has no pseudonym to give such a name, so it is left out, and that is said.
 */
export function recorderShown(
  by: RecordedBy, register: Register, showing: Showing = {}, source?: RecorderSource,
): RecorderShown | undefined {
  const entry = recorderEntry(by, source)
  if (entry !== undefined) return shownPerson(pickedPerson(entry), register, showing)
  const name = (by.account === undefined ? undefined : source?.(by.account)?.name) ?? by.name
  if (!name) return undefined
  return showing.withhold ? { as: 'nameWithheld' } : { as: 'text', text: name }
}

/**
 * What a copy carries of a recorder, which goes where this source's accounts mean
 * nothing: never the account, and the entry where one answers, which the copy's
 * register reads (ADR-0036 §8). A copy without names keeps the entry and the
 * agent; with nothing left, no record.
 */
export function recorderInCopy(
  by: RecordedBy, { nameless = false, source }: { nameless?: boolean; source?: RecorderSource | undefined },
): RecordedBy | undefined {
  const person = recorderEntry(by, source)
  const said = by.account === undefined ? undefined : source?.(by.account)?.name
  const name = person === undefined && !nameless ? said ?? by.name : undefined
  const kept: RecordedBy = { ...(name ? { name } : {}), ...(person !== undefined ? { person } : {}), ...(by.via ? { via: by.via } : {}) }
  return Object.keys(kept).length > 0 ? kept : undefined
}

/** Who *mine* asks about, worked out once per register rather than per row. */
export type Mine = {
  readonly account: string | undefined
  /** The entry I am, the one a merge kept; nobody once it is forgotten. */
  readonly person: PersonId | undefined
  /** The entry that answers for an id: where a merge took it, or the id. */
  readonly canonical: (id: PersonId) => PersonId
  /** Each of my names as its folded words, those of fewer than two words left out. */
  readonly names: readonly (readonly string[])[]
}

/** Text as whole words, by the one folding rule (`model/textSearch`); a mark stays in its word. */
function wordsOf(text: string): string[] {
  return fold(text).split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean)
}

/**
 * A name's words, or nothing for a name that would claim everybody who shares
 * it. Words are counted by what separates a name's parts, so a double given
 * name or a surname with an apostrophe is one word, though each piece of it is
 * compared on its own.
 */
function nameWords(name: string | undefined): readonly string[] | undefined {
  if (name === undefined) return undefined
  const parts = name.split(/[\s,;]+/).filter((part) => /[\p{L}\p{N}]/u.test(part))
  return parts.length < 2 ? undefined : wordsOf(name)
}

/** The name an entry reads as: none for a pseudonym, on a redirect or where names are withheld (`people/shown`). */
function nameOfEntry(person: Person | undefined, showing: Showing): string | undefined {
  if (!person) return undefined
  const shown = shownEntry(person, showing)
  return shown.as === 'name' || shown.as === 'left' ? shown.name : undefined
}

/**
 * Who *mine* asks about: my account, the entry I am and my names. With no
 * register to ask (`undefined`), an id is only itself and an entry has no
 * name. Where names are withheld from the reader, none is compared: which text
 * came back would tell them what the pseudonym stands for.
 */
export function mineOf(
  who: { readonly account?: RecordingAccount | undefined; readonly me?: PersonId | undefined },
  register: Register | undefined,
  showing: Showing = {},
): Mine {
  const entry = register ? meIn(who.me, register) : undefined
  const named = showing.withhold ? [] : [who.account?.name, nameOfEntry(entry, showing)]
  return {
    account: who.account?.id,
    person: register ? entry?.id : who.me,
    canonical: register ? (id) => resolvePerson(id, register)?.id ?? id : (id) => id,
    names: named.map(nameWords).filter((words) => words !== undefined),
  }
}

/** Whether a text names me: every word of one of my names, as a whole word, in any order. */
function namesMe(text: string | undefined, names: Mine['names']): boolean {
  if (!text || names.length === 0) return false
  const words = new Set(wordsOf(text))
  return names.some((name) => name.every((word) => words.has(word)))
}

/**
 * Whether an observation is mine: recorded by my account, by the entry I am, or
 * under my name where the record carries no entry; or seen by that entry, or by
 * my name as typed. With neither an account nor a person, nothing is.
 */
export function isMine(one: Pick<Observation, 'recordedBy' | 'by'>, mine: Mine): boolean {
  const recorded = one.recordedBy
  const isMe = (id: PersonId) => mine.person !== undefined && mine.canonical(id) === mine.person
  if (recorded) {
    if (mine.account !== undefined && recorded.account === mine.account) return true
    if (recorded.person !== undefined ? isMe(recorded.person) : namesMe(recorded.name, mine.names)) return true
  }
  return isPicked(one.by) ? isMe(one.by.person) : namesMe(one.by, mine.names)
}

/**
 * What the toolbar says while *Mine* is on: that nobody is said to be me; or,
 * having found nothing, what it counts — without the entry where the account
 * is linked to none. Nothing while it has found something.
 */
export type MineCaption = 'nobody' | 'counts' | 'noEntry'

export function mineCaption(mine: Mine, found: boolean): MineCaption | undefined {
  if (mine.account === undefined && mine.person === undefined) return 'nobody'
  if (found) return undefined
  return mine.person === undefined ? 'noEntry' : 'counts'
}
