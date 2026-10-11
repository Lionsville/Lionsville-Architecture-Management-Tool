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
 * written, and only where the source does not apply it itself
 * (`SourcePeople.appliesPolicy`): a register that is only read is not changed
 * by reading it, and one a server forgets on its own schedule is not forgotten
 * twice.
 *
 * **Who *you* are** is this install's *This is me* (`people.me`), or — where
 * the source knows which entry the person using it is, an account linked to
 * one — the source's word (`SourcePeople.me`), and then *This is me* is not
 * offered. A source that hears the register change elsewhere says so
 * (`SourcePeople.changes`), and the register is read again. A source that
 * knows who may do what says it per change and per entry
 * (`SourcePeople.may`), which address it keeps from this person
 * (`withheld`), and whom its schedule held back (`held`); the page reads all
 * three through this hook.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PeopleView } from '../../agent/people'
import { managesPeople } from '../../model/managing'
import type { ManagesPeople } from '../../model/managing'
import type { PersonId } from '../../model/person'
import { forgetPerson, leavePerson, mergePerson } from '../../people/leave'
import { registerOf, resolvePerson } from '../../people/shown'
import type { Left } from '../../people/leave'
import { meOf, mePatch } from '../../people/me'
import type { MergeLeaving, NewPerson, PeopleAction, Person, PersonPatch, PolicyHold } from '../../people/person'
import { DEFAULT_POLICY, dueOn, policyOf, policyPatch } from '../../people/policy'
import type { PeoplePolicy } from '../../people/policy'
import type { Mention } from '../../people/hold'
import type { PeopleRefused, PersonRemoved, PersonWritten } from '../../ports/PeopleRepository'
import type { SourcePeople } from '../../ports/ProviderParts'
import type { Repositories } from '../../ports/Repositories'
import { searchAll } from '../../search/search'
import type { SearchableModel } from '../../model/searchable'
import { leaveConsequences } from './leaving'
import type { OpenScope } from './leaving'
import type { ScopeIndex } from '../../projects/scopeIndex'
import { heldAssignments, idsOfPerson, ownedByRule } from '../units/held'
import type { HeldAssignment, PointsAt } from '../../people/hold'
import { pointersIn } from '../../model/pointers'
import type { PointedModel } from '../../model/pointers'

/** The register, and what may be done to it, as the page and the agent are handed it. */
export type PeopleAccess = {
  /** Every entry as last read, redirects included; `undefined` until the first read answers. */
  people: readonly Person[] | undefined
  policy: PeoplePolicy
  /** The entry this install takes to be its person (*This is me*), or the one the source says is. */
  me: PersonId | undefined
  /** The source says who the person is (an account linked to an entry): *This is me* is not offered. */
  meSaid: boolean
  /** Whether the register may be changed here. */
  readOnly: boolean
  /** Whether this person may make one kind of change, of one entry where it is the entry's; where the source says (`SourcePeople.may`). */
  may?: (action: PeopleAction, id?: PersonId) => boolean
  /** Whether an entry has an address this person is not shown; where the source says. */
  withheld?: (id: PersonId) => boolean
  /** Why the source's schedule held an entry back from being forgotten; where the source says. */
  held?: (id: PersonId) => PolicyHold | undefined
  /** Whose people this person may change by a managing role, where the source grants that right (`SourcePeople.managingRight`). */
  manages?: ManagesPeople
  today: string
  refresh: () => void
  add: (person: NewPerson) => Promise<PersonWritten | PeopleRefused>
  change: (id: PersonId, patch: PersonPatch) => Promise<PersonWritten | PeopleRefused>
  leave: (id: PersonId, on: string) => Promise<Left | PeopleRefused>
  forget: (id: PersonId, on: string) => Promise<Left | PeopleRefused>
  remove: (id: PersonId) => Promise<PersonRemoved | PeopleRefused>
  merge: (from: PersonId, into: PersonId, leaving?: MergeLeaving) => Promise<Left | PeopleRefused>
  setPolicy: (change: Partial<PeoplePolicy>) => Promise<void>
  setMe: (id: PersonId | undefined) => Promise<void>
  /** Records across the tree whose text holds a name: what a forget cannot reach. */
  mentionsOf: (name: string) => Promise<Mention[]>
  /** The same register, for the agent: read fresh on every call. */
  agent: PeopleView
  /** What each person holds across the tree, where the shell has a tree. */
  assignmentsOf?: (id: PersonId) => readonly HeldAssignment[]
  /** What points at a person across the tree: records by id, signatures, what the rules work out. */
  pointsAt?: (id: PersonId) => Promise<PointsAt>
  /** A chosen file's text, for a list to import; where the host can read one. */
  readText?: (file: Blob) => Promise<string>
  /** Text handed to the clipboard: *What we hold*, copied. */
  copyText?: (text: string) => void
}

const HOUR = 3_600_000

type Held = { people: readonly Person[] | undefined; policy: PeoplePolicy; me: PersonId | undefined }

/** Every scope's model, read whole, for a search across the tree and for what points at a person. */
async function everyModel(scopes: Repositories['scopes']): Promise<{ scope: string; model: SearchableModel & PointedModel & { name?: string } }[]> {
  const tree = await scopes.tree()
  const nodes = [tree.root]
  for (let at = 0; at < nodes.length; at++) nodes.push(...nodes[at].children)
  const read = await Promise.all(nodes.map(async (node) => ({ node, state: await scopes.state(node.id) })))
  return read.flatMap(({ node, state }) => (state
    ? [{ scope: node.address, model: state.model as unknown as SearchableModel & PointedModel & { name?: string } }]
    : []))
}

/**
 * What points at a person across the tree (ADR-0036 §8): every record whose
 * name fields hold one of their ids, read from every scope as it is kept, and
 * what the rules make them own today, off the index.
 */
async function pointsAtPerson(
  scopes: Repositories['scopes'], index: ScopeIndex | undefined, ids: ReadonlySet<PersonId>, day: string,
): Promise<PointsAt> {
  const models = await everyModel(scopes)
  const names = new Map(models.map(({ scope, model }) => [scope, model.name ?? scope]))
  return {
    pointers: models.flatMap(({ scope, model }) => pointersIn(model, ids).map((pointer) => ({ ...pointer, scope }))),
    byRule: index ? ownedByRule(index, ids, day, (path) => names.get(path) ?? path) : [],
  }
}

export function usePeopleRegister(deps: {
  repositories: Pick<Repositories, 'people' | 'settings' | 'scopes' | 'index'>
  /** The scope open in this window, where one is: leaving ends assignments there through its session. */
  openScope?: () => OpenScope | undefined
  /** The organisation's index, for what each person holds across the tree. */
  index?: ScopeIndex
  readOnly: boolean
  /** The day, asked again each hour: the policy applies itself again when it turns. */
  today: () => string
  /** A failure, said on the trail and — with a key — to the person. */
  failed: (where: string, cause: unknown) => void
  readText?: (file: Blob) => Promise<string>
  copyText?: (text: string) => void
  /** What the source does about the register beyond keeping it, where it does more (`ProviderParts.people`). */
  source?: SourcePeople
  /** A leave wrote scopes other than the open one: the tree's index is to be read again. */
  onTreeChanged?: () => void
}): PeopleAccess {
  const { repositories, failed, source } = deps
  const [held, setHeld] = useState<Held>({ people: undefined, policy: DEFAULT_POLICY, me: undefined })
  const [today, setToday] = useState(deps.today)
  useEffect(() => {
    const ticking = setInterval(() => setToday(deps.today()), HOUR)
    return () => clearInterval(ticking)
  }, [deps.today])
  /**
   * Whose people this person may change by a managing role (ADR-0036 §12):
   * only where the source grants that right and says who the person is — an
   * account linked to an entry, never *This is me* — worked out over the
   * organisation today, one person under every id a merge left.
   */
  const { index } = deps
  const managingRight = source?.managingRight === true && source.me !== undefined
  const manages = useMemo<ManagesPeople | undefined>(() => {
    if (!managingRight || !index || held.me === undefined) return undefined
    const register = registerOf(held.people ?? [])
    return managesPeople(index.organisation(), held.me, today, (id) => resolvePerson(id, register)?.id ?? id)
  }, [managingRight, index, held.me, held.people, today])
  /** The register is written by whoever the source lets write, and by a manager through the source's own `may`. */
  const readOnly = deps.readOnly && manages === undefined
  const failedRef = useRef(failed)
  failedRef.current = failed

  const read = useCallback(async (): Promise<Held> => {
    const [list, organisation, person] = await Promise.all([
      repositories.people.list(), repositories.settings.read({ of: 'organisation' }), repositories.settings.read({ of: 'person' }),
    ])
    return { people: list.people, policy: policyOf(organisation), me: source?.me ? source.me() : meOf(person) }
  }, [repositories, source])

  const refresh = useCallback(() => {
    void read().then(setHeld, (cause: unknown) => failedRef.current('people.read', cause))
  }, [read])

  const { openScope } = deps
  // Read through a ref: a shell hands a new function on every render, and the consequences are made once.
  const treeChanged = useRef(deps.onTreeChanged)
  treeChanged.current = deps.onTreeChanged
  const consequences = useMemo(
    () => leaveConsequences({ repositories, openScope, onTreeChanged: () => treeChanged.current?.() }), [repositories, openScope],
  )
  /** The agent's leave ends the same assignments, each step under the agent's name. */
  const agentConsequences = useMemo(
    () => leaveConsequences({ repositories, openScope, origin: 'agent', onTreeChanged: () => treeChanged.current?.() }), [repositories, openScope],
  )

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
  // What the source hears of the register changing elsewhere: read again.
  useEffect(() => source?.changes?.(refresh), [source, refresh])
  // When the organisation is opened, and when the day turns while it is (`today` moves with it).
  const appliesPolicy = source?.appliesPolicy === true
  useEffect(() => {
    if (readOnly || appliesPolicy) return
    void applyPolicy(today).catch((cause: unknown) => failedRef.current('people.policy', cause))
  }, [applyPolicy, readOnly, appliesPolicy, today])

  const agent = useMemo<PeopleView>(() => ({
    read: async () => {
      const now = await read()
      return { people: now.people ?? [], policy: now.policy }
    },
    add: (person) => changed(repositories.people.add(person)),
    leave: (id, on) => changed(leavePerson(repositories.people, agentConsequences, id, on)),
    today: () => today,
    readOnly: () => readOnly,
  }), [read, changed, repositories, agentConsequences, today, readOnly])

  // The host's two doors, read through a ref: a shell hands new functions on every render, and the
  // register is one object while nothing it says has changed — what a screen built on it is memoised by.
  const doors = useRef({ readText: deps.readText, copyText: deps.copyText })
  doors.current = { readText: deps.readText, copyText: deps.copyText }
  const canRead = deps.readText !== undefined
  const canCopy = deps.copyText !== undefined
  return useMemo<PeopleAccess>(() => ({
    ...held,
    meSaid: source?.me !== undefined,
    readOnly,
    ...(source?.may ? { may: source.may } : {}),
    ...(source?.withheld ? { withheld: source.withheld } : {}),
    ...(source?.held ? { held: source.held } : {}),
    ...(manages ? { manages } : {}),
    today,
    refresh,
    add: (person) => changed(repositories.people.add(person)),
    change: (id, patch) => changed(repositories.people.change(id, patch)),
    leave: (id, on) => changed(leavePerson(repositories.people, consequences, id, on)),
    forget: (id, on) => changed(forgetPerson(repositories.people, consequences, id, on)),
    remove: (id) => changed(repositories.people.remove(id)),
    merge: (from, into, leaving) => changed(mergePerson(repositories.people, consequences, from, into, leaving)),
    setPolicy: (change) => changed(repositories.settings.write({ of: 'organisation' }, policyPatch(change)).then(() => undefined)),
    setMe: (id) => changed(repositories.settings.write({ of: 'person' }, mePatch(id)).then(() => undefined)),
    mentionsOf: async (name) => searchAll({ sources: await everyModel(repositories.scopes), query: name, limitPerKind: 1000 })
      .map((hit) => ({ scope: hit.scope ?? '', kind: hit.kind, id: hit.id, title: hit.title })),
    agent,
    ...(index ? { assignmentsOf: (id: PersonId) => heldAssignments(index, idsOfPerson(id, held.people ?? [])) } : {}),
    pointsAt: (id) => pointsAtPerson(repositories.scopes, index, idsOfPerson(id, held.people ?? []), today),
    ...(canRead ? { readText: (file: Blob) => doors.current.readText?.(file) ?? Promise.resolve('') } : {}),
    ...(canCopy ? { copyText: (text: string) => doors.current.copyText?.(text) } : {}),
  }), [held, source, readOnly, manages, today, refresh, changed, repositories, consequences, agent, index, canRead, canCopy])
}

