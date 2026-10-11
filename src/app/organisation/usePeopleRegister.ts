// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The people register as the shell holds it (ADR-0036): read from the
 * source's `PeopleRepository`, with the organisation's policy and this
 * install's *This is me* beside it, and every change the People page and the
 * agent make to it made here — so a leave means one thing whoever asks, and a
 * change either makes is on the page at once.
 *
 * **Not a command.** Nothing here is a step: no undo, no Activity line, no
 * history entry. The register is changed in place, and the page says so.
 *
 * **The policy applies itself** where nothing runs on a schedule (ADR-0036
 * §10): when the organisation is opened, and again when the day turns while
 * it stays open, every name kept past the period is forgotten and every
 * forgotten entry kept past the next is removed. Only where the source may be
 * written: a register that is only read is not changed by reading it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PeopleView } from '../../agent/people'
import type { PersonId } from '../../model/person'
import { forgetPerson, leavePerson } from '../../people/leave'
import type { Left } from '../../people/leave'
import { meOf, mePatch } from '../../people/me'
import type { NewPerson, Person, PersonPatch } from '../../people/person'
import { DEFAULT_POLICY, dueOn, policyOf, policyPatch } from '../../people/policy'
import type { PeoplePolicy } from '../../people/policy'
import type { Mention } from '../../people/hold'
import type { PeopleRefused, PersonRemoved, PersonWritten } from '../../ports/PeopleRepository'
import type { Repositories } from '../../ports/Repositories'
import { searchAll } from '../../search/search'
import type { SearchableModel } from '../../model/searchable'
import { leaveConsequences } from './leaving'

/** The register, and what may be done to it, as the page and the agent are handed it. */
export type PeopleAccess = {
  /** Every entry as last read, redirects included; `undefined` until the first read answers. */
  people: readonly Person[] | undefined
  policy: PeoplePolicy
  /** The entry this install takes to be its person (*This is me*). */
  me: PersonId | undefined
  /** Whether the register may be changed here. */
  readOnly: boolean
  today: string
  refresh: () => void
  add: (person: NewPerson) => Promise<PersonWritten | PeopleRefused>
  change: (id: PersonId, patch: PersonPatch) => Promise<PersonWritten | PeopleRefused>
  leave: (id: PersonId, on: string) => Promise<Left | PeopleRefused>
  forget: (id: PersonId, on: string) => Promise<Left | PeopleRefused>
  remove: (id: PersonId) => Promise<PersonRemoved | PeopleRefused>
  merge: (from: PersonId, into: PersonId) => Promise<PersonWritten | PeopleRefused>
  setPolicy: (change: Partial<PeoplePolicy>) => Promise<void>
  setMe: (id: PersonId | undefined) => Promise<void>
  /** Records across the tree whose text holds a name: what a forget cannot reach. */
  mentionsOf: (name: string) => Promise<Mention[]>
  /** The same register, for the agent: read fresh on every call. */
  agent: PeopleView
  /** A chosen file's text, for a list to import; where the host can read one. */
  readText?: (file: Blob) => Promise<string>
  /** Text handed to the clipboard: *What we hold*, copied. */
  copyText?: (text: string) => void
}

const HOUR = 3_600_000

type Held = { people: readonly Person[] | undefined; policy: PeoplePolicy; me: PersonId | undefined }

/** Every scope's model, read whole, for a search across the tree. */
async function everyModel(scopes: Repositories['scopes']): Promise<{ scope: string; model: SearchableModel }[]> {
  const tree = await scopes.tree()
  const nodes = [tree.root]
  for (let at = 0; at < nodes.length; at++) nodes.push(...nodes[at].children)
  const read = await Promise.all(nodes.map(async (node) => ({ node, state: await scopes.state(node.id) })))
  return read.flatMap(({ node, state }) => (state ? [{ scope: node.address, model: state.model as unknown as SearchableModel }] : []))
}

export function usePeopleRegister(deps: {
  repositories: Pick<Repositories, 'people' | 'settings' | 'scopes'>
  readOnly: boolean
  /** The day, asked again each hour: the policy applies itself again when it turns. */
  today: () => string
  /** A failure, said on the trail and — with a key — to the person. */
  failed: (where: string, cause: unknown) => void
  readText?: (file: Blob) => Promise<string>
  copyText?: (text: string) => void
}): PeopleAccess {
  const { repositories, readOnly, failed } = deps
  const [held, setHeld] = useState<Held>({ people: undefined, policy: DEFAULT_POLICY, me: undefined })
  const [today, setToday] = useState(deps.today)
  useEffect(() => {
    const ticking = setInterval(() => setToday(deps.today()), HOUR)
    return () => clearInterval(ticking)
  }, [deps.today])
  const failedRef = useRef(failed)
  failedRef.current = failed

  const read = useCallback(async (): Promise<Held> => {
    const [list, organisation, person] = await Promise.all([
      repositories.people.list(), repositories.settings.read({ of: 'organisation' }), repositories.settings.read({ of: 'person' }),
    ])
    return { people: list.people, policy: policyOf(organisation), me: meOf(person) }
  }, [repositories])

  const refresh = useCallback(() => {
    void read().then(setHeld, (cause: unknown) => failedRef.current('people.read', cause))
  }, [read])

  const consequences = useMemo(() => leaveConsequences({ repositories }), [repositories])

  /** A change made, and the register read again: what every write below ends with. */
  const changed = useCallback(<T>(work: Promise<T>): Promise<T> => work.finally(refresh), [refresh])

  const applyPolicy = useCallback(async (day: string) => {
    const now = await read()
    const due = dueOn(now.people ?? [], now.policy, day)
    for (const id of due.forget) await forgetPerson(repositories.people, consequences, id, day)
    for (const id of due.remove) await repositories.people.remove(id)
    if (due.forget.length + due.remove.length > 0) refresh()
  }, [read, repositories, consequences, refresh])

  useEffect(() => { refresh() }, [refresh])
  // When the organisation is opened, and when the day turns while it is (`today` moves with it).
  useEffect(() => {
    if (readOnly) return
    void applyPolicy(today).catch((cause: unknown) => failedRef.current('people.policy', cause))
  }, [applyPolicy, readOnly, today])

  const agent = useMemo<PeopleView>(() => ({
    read: async () => {
      const now = await read()
      return { people: now.people ?? [], policy: now.policy }
    },
    add: (person) => changed(repositories.people.add(person)),
    leave: (id, on) => changed(leavePerson(repositories.people, consequences, id, on)),
    today: () => today,
    readOnly: () => readOnly,
  }), [read, changed, repositories, consequences, today, readOnly])

  return {
    ...held,
    readOnly,
    today,
    refresh,
    add: (person) => changed(repositories.people.add(person)),
    change: (id, patch) => changed(repositories.people.change(id, patch)),
    leave: (id, on) => changed(leavePerson(repositories.people, consequences, id, on)),
    forget: (id, on) => changed(forgetPerson(repositories.people, consequences, id, on)),
    remove: (id) => changed(repositories.people.remove(id)),
    merge: (from, into) => changed(repositories.people.merge(from, into)),
    setPolicy: (change) => changed(repositories.settings.write({ of: 'organisation' }, policyPatch(change)).then(() => undefined)),
    setMe: (id) => changed(repositories.settings.write({ of: 'person' }, mePatch(id)).then(() => undefined)),
    mentionsOf: async (name) => searchAll({ sources: await everyModel(repositories.scopes), query: name, limitPerKind: 1000 })
      .map((hit) => ({ scope: hit.scope ?? '', kind: hit.kind, id: hit.id, title: hit.title })),
    agent,
    ...(deps.readText ? { readText: deps.readText } : {}),
    ...(deps.copyText ? { copyText: deps.copyText } : {}),
  }
}
