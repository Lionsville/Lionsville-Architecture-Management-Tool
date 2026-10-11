// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A person named in an answer, as an agent is told it (ADR-0036 §8, §13).
 *
 * A name field holds a person picked from the register as `{ person: id }`,
 * or text. Every answer that carries such a field — an element's owner, a
 * plan's, who saw an observation, who runs an experiment, who proposed and
 * who signed a decision — says a picked person as `{ person: id, name }`: the
 * name, or the pseudonym where the organisation's policy gives agents
 * pseudonyms, *a former colleague* for an id the register no longer holds.
 * The id stays beside it, so the agent can hand it back. Text is said as it
 * is. A signature's name as signed is the record's, and said as written —
 * except where the policy gives agents pseudonyms: then the signer and the
 * proposer are said by pseudonym like everybody else, and the name as signed
 * is left out with a word that it is withheld (`signedAsWithheld`,
 * `proposedAsWithheld`). The record is unchanged, and a screen shows it.
 *
 * **A signature whose signer is forgotten, or gone, links to nobody**
 * (ADR-0036 §8): the signer — or the proposer — is said as the name as signed
 * alone, as text, with no id and no pseudonym beside it, so nothing in an
 * answer ties that name to the entry and undoes the forgetting. Where names
 * are withheld, as *a former colleague*, and the name as signed is withheld.
 *
 * Done once, over the answer as it leaves the handler, so no tool has to
 * remember to do it: the answer is read by the shape of a reference, as
 * `personIdsIn` reads a model. An answer with no reference in it is passed
 * through untouched, and the register is not read for it.
 */
import { isPersonRef, isPicked, pickedPerson } from '../model/person'
import type { PersonId, PersonRef } from '../model/person'
import type { Person } from '../people/person'
import type { PeoplePolicy } from '../people/policy'
import { peopleMatching } from '../people/matching'
import { registerOf, shownEnglish, shownPerson, signatureApart } from '../people/shown'
import type { PeopleMatch } from '../search/search'
import type { AgentAnswer } from './tools'

/** What a reference reads as to an agent: the name or pseudonym of a picked person, the text as typed. */
export type PersonWords = (ref: PersonRef | undefined) => string

/** The register as the agent is told it: names, or pseudonyms where the policy says so. */
export type AgentRegister = {
  /** What a reference reads as. */
  words: PersonWords
  /** For `search`: the register ids a folded word names, as the agent may read them. */
  match: PeopleMatch
  /** Names are withheld from agents: the policy gives them pseudonyms, the names signatures kept included. */
  withhold: boolean
  /** Whether a signature that kept a name has come apart from its entry: forgotten, or gone (`signatureApart`). */
  apart: (id: PersonId) => boolean
}

/** The register as an agent reads it, over its entries and the organisation's policy. */
export function agentRegister(people: readonly Person[], policy: PeoplePolicy | undefined): AgentRegister {
  const register = registerOf(people)
  const showing = { withhold: policy?.agentsSee === 'pseudonyms' }
  return {
    words: (ref) => shownEnglish(shownPerson(ref, register, showing)),
    match: peopleMatching(people, shownEnglish, showing),
    withhold: showing.withhold,
    apart: (id) => signatureApart(id, register),
  }
}

/** A picked person as an answer says it. */
export function personSaid(id: PersonId, words: PersonWords): { person: PersonId; name: string } {
  return { person: id, name: words(pickedPerson(id)) }
}

/** The two fields that keep a name as signed (ADR-0036 §8), and what an agent is told in their place where names are withheld. */
const SIGNED_NAMES: Readonly<Record<string, string>> = { signedAs: 'signedAsWithheld', proposedAs: 'proposedAsWithheld' }

/** The field that holds the reference beside each field that keeps a name as signed: a signer row's `name`, a decision's `proposedBy`. */
const SIGNED_BY: Readonly<Record<string, string>> = { signedAs: 'name', proposedAs: 'proposedBy' }

/** What an agent is told of a signer whose signature came apart from the entry and names are withheld. */
const FORMER = shownEnglish({ as: 'former' })

/**
 * A record with a signature whose entry is forgotten or gone, the reference
 * beside the name as signed said as that name alone — no id, no pseudonym —
 * or, where names are withheld, as nobody in particular. Nothing else moves.
 */
function apartSaid(value: Record<string, unknown>, withhold: boolean, apart: ((id: PersonId) => boolean) | undefined): Record<string, unknown> {
  if (!apart) return value
  let next = value
  for (const [kept, by] of Object.entries(SIGNED_BY)) {
    const name = value[kept]
    const ref = value[by]
    if (typeof name !== 'string' || !isPersonRef(ref) || !isPicked(ref) || !apart(ref.person)) continue
    next = { ...next, [by]: withhold ? FORMER : name }
  }
  return next
}

/**
 * Every reference in a value, said: a picked person as `{ person, name }`,
 * everything else as it is. With `withhold`, a name a signature kept is left
 * out too, and the answer says it was. A signature `apart` from its entry
 * says the name as signed and nothing that links it to the entry.
 */
export function withPersonNames(value: unknown, words: PersonWords, withhold = false, apart?: (id: PersonId) => boolean): unknown {
  if (Array.isArray(value)) return value.map((item) => withPersonNames(item, words, withhold, apart))
  if (typeof value !== 'object' || value === null) return value
  if (isPersonRef(value) && isPicked(value)) return personSaid(value.person, words)
  return Object.fromEntries(Object.entries(apartSaid(value as Record<string, unknown>, withhold, apart)).map(([key, item]): [string, unknown] => (
    withhold && key in SIGNED_NAMES && typeof item === 'string' ? [SIGNED_NAMES[key], true] : [key, withPersonNames(item, words, withhold, apart)]
  )))
}

/** Whether an answer may name somebody by id: a cheap look before the register is read. */
export function mayNamePeople(answer: AgentAnswer): boolean {
  return answer.ok && answer.content.some((block) => block.type === 'text' && (block.text.includes('"person"') || block.text.includes('"signedAs"') || block.text.includes('"proposedAs"')))
}

/**
 * An answer with every picked person in it said by name or pseudonym. A
 * block that is not JSON — a document, a table — is left as it is: the tool
 * that wrote it said its people itself.
 */
export function answerWithNames(answer: AgentAnswer, words: PersonWords, withhold = false, apart?: (id: PersonId) => boolean): AgentAnswer {
  if (!answer.ok) return answer
  return {
    ...answer,
    content: answer.content.map((block) => {
      if (block.type !== 'text' || !(block.text.includes('"person"') || (withhold && /"(signed|proposed)As"/.test(block.text)))) return block
      try {
        const read: unknown = JSON.parse(block.text)
        return { ...block, text: JSON.stringify(withPersonNames(read, words, withhold, apart), undefined, 2) }
      } catch {
        return block
      }
    }),
  }
}
