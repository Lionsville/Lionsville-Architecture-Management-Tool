// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the principles screens read and write through, filled from the open
 * scope (ADR-0041): its own principles and groups from the session, each
 * change one step there — undone with ⌘Z, in the Activity list — and the
 * principles of every scope above from the index, read-only here because a
 * record is edited where it lives (ADR-0012 §7).
 *
 * The citations are the next step's (ADR-0041 §7): until they are kept, a
 * principle is cited by nothing and its removal is never refused for it.
 */
import { useMemo, useRef } from 'react'
import { apply } from '../../model/reducer'
import type { Command } from '../../model/commands'
import { principleList } from '../../model/normalised'
import { nextPrincipleNumber, mergePrinciples } from '../../model/principle'
import type { Principle, PrincipleGroup, PrincipleRelation, PrincipleStatus } from '../../model/principle'
import { principleOf } from '../../principles/draft'
import type { PrincipleDraft } from '../../principles/draft'
import type { PrinciplesAccess, PrincipleSource } from '../../principles/ui/PrinciplesContext'
import type { PrincipleInForce } from '../../principles/suggest'
import { ancestorScopes } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ModelSession } from '../useModelSession'

export type PrinciplesDeps = {
  session: Pick<ModelSession, 'model' | 'indexed' | 'dispatch' | 'readOnly'>
  /** The open scope. */
  scope: ScopePath
  /** The tree's index as it stands: the principles of every other scope. */
  index: Pick<ScopeIndex, 'principlesAt'>
  /** What a scope is called, as the tree says it. */
  scopeLabel: (path: ScopePath) => string
  makeId: (prefix: string) => string
  today: () => string
  /** The principles page of the open scope, on a principle. */
  openHere: (id?: string) => void
  /** Another scope's principles page, on a principle: where it is kept. */
  openThere?: (scope: ScopePath, id: string) => void
}

/** The groups the draft names by name that the scope has not got, made: the scope's list as it will be, and every id the principle sits in. */
function withNewGroups(held: readonly PrincipleGroup[], draft: PrincipleDraft, makeId: (prefix: string) => string): { groups: PrincipleGroup[]; ids: string[] } {
  const groups = [...held]
  const ids = [...draft.groups]
  for (const name of draft.newGroups) {
    const same = groups.find((one) => one.name.toLowerCase() === name.toLowerCase())
    if (same) { ids.push(same.id); continue }
    const made = { id: makeId('pg'), name }
    groups.push(made)
    ids.push(made.id)
  }
  return { groups, ids: [...new Set(ids)] }
}

/** A principle's own scope's principles and groups: the session's for the open scope, the index's for any other. */
function ownOf(deps: PrinciplesDeps, scope: ScopePath): { principles: readonly Principle[]; groups: readonly PrincipleGroup[] } {
  if (scope === deps.scope) return { principles: deps.session.model.principles ?? [], groups: deps.session.model.principleGroups ?? [] }
  return deps.index.principlesAt(scope)
}

/** Land one step on the open scope, or say why the reducer would refuse it. */
function land(deps: PrinciplesDeps, command: Command): { refused: string } | undefined {
  if (deps.session.readOnly) return { refused: 'shell.scopeReadOnly' }
  const tried = apply(deps.session.indexed(), command)
  if (!tried.ok) return { refused: tried.reason }
  return deps.session.dispatch(command) === undefined ? { refused: 'command.gone' } : undefined
}

export function principlesAccess(deps: PrinciplesDeps, version: number): PrinciplesAccess {
  const here = deps.scope
  const own = (scope: ScopePath) => ownOf(deps, scope)
  const inForce = (scope: ScopePath): PrincipleInForce[] => [scope, ...ancestorScopes(scope)].flatMap((at) => {
    const { principles, groups } = own(at)
    return principles.filter((one) => one.mergedInto === undefined).map((principle) => ({ scope: at, principle, groups }))
  })
  const heldHere = (id: string) => principleList(deps.session.indexed()).find((one) => one.id === id)
  const update = (id: string, change: (held: Principle) => Partial<Principle>) => {
    const held = heldHere(id)
    if (held) land(deps, { type: 'principle.update', id, patch: change(held) })
  }
  const relations = (next: readonly PrincipleRelation[]): Partial<Principle> => ({ relations: next.length ? [...next] : undefined })
  return {
    version,
    here,
    scopeLabel: deps.scopeLabel,
    own,
    inForce,
    sourceOf: (at: ScopePath, scope: ScopePath): PrincipleSource => (scope === at ? { kind: 'here' } : { kind: 'above', scope }),
    find: (ref) => inForce(here).find((one) => one.scope === ref.scope && one.principle.id === ref.id)
      ?? own(ref.scope).principles.filter((one) => one.id === ref.id).map((principle) => ({ scope: ref.scope, principle, groups: own(ref.scope).groups }))[0],
    citationsOf: () => [],
    citationsTo: () => [],
    recordLabel: () => '',
    citedNearby: () => [],
    cite: () => undefined,
    uncite: () => undefined,
    save: (scope, draft, held, note) => {
      if (scope !== here) return { refused: 'shell.scopeReadOnly' }
      const made = withNewGroups(own(here).groups, draft, deps.makeId)
      const today = deps.today()
      const base = held ?? { id: deps.makeId('pr'), number: nextPrincipleNumber(own(here).principles) }
      let principle = principleOf(draft, base, made.ids, today)
      if (held && note) principle = { ...principle, sharpened: [...(held.sharpened ?? []), { on: today, note }] }
      const step: Command = held
        ? { type: 'principle.update', id: held.id, patch: principle }
        : { type: 'principle.add', principle }
      const groupsChanged = made.groups.length !== own(here).groups.length
      const refused = land(deps, groupsChanged
        ? { type: 'transaction', commands: [{ type: 'project.settings', patch: { principleGroups: made.groups } }, step] }
        : step)
      return refused ?? { id: principle.id }
    },
    setStatus: (scope, id, status: PrincipleStatus) => {
      if (scope !== here) return
      update(id, (held) => ({ status, ...(status === 'accepted' && !held.acceptedOn ? { acceptedOn: deps.today() } : {}) }))
    },
    remove: (scope, id) => scope === here && land(deps, { type: 'principle.remove', id }) === undefined,
    setGroups: (scope, groups) => {
      if (scope !== here) return
      const kept = new Set(groups.map((one) => one.id))
      // A group taken away is taken off its principles in the same step; none of them goes (§3).
      const off = principleList(deps.session.indexed()).filter((one) => one.groups.some((id) => !kept.has(id)))
      land(deps, {
        type: 'transaction',
        commands: [
          { type: 'project.settings', patch: { principleGroups: [...groups] } },
          ...off.map((one): Command => ({ type: 'principle.update', id: one.id, patch: { groups: one.groups.filter((id) => kept.has(id)) } })),
        ],
      })
    },
    relate: (scope, id, relation) => {
      if (scope !== here) return
      update(id, (held) => relations([...(held.relations ?? []).filter((one) => !(one.kind === relation.kind && one.to.scope === relation.to.scope && one.to.id === relation.to.id)), relation]))
    },
    unrelate: (scope, id, relation) => {
      if (scope !== here) return
      update(id, (held) => relations((held.relations ?? []).filter((one) => !(one.kind === relation.kind && one.to.scope === relation.to.scope && one.to.id === relation.to.id))))
    },
    merge: (scope, into, from) => {
      if (scope !== here) return
      const survivor = heldHere(into)
      const absorbed = from.map(heldHere).filter((one): one is Principle => one !== undefined && one.id !== into)
      if (!survivor || absorbed.length === 0) return
      const merged = mergePrinciples(survivor, absorbed)
      land(deps, {
        type: 'transaction',
        commands: [
          { type: 'principle.update', id: into, patch: merged.survivor },
          ...merged.absorbed.map((one): Command => ({ type: 'principle.update', id: one.id, patch: { mergedInto: into } })),
        ],
      })
    },
    open: (ref) => (ref.scope === here ? deps.openHere(ref.id) : deps.openThere?.(ref.scope, ref.id)),
    mayWrite: (scope) => scope === here && !deps.session.readOnly,
    today: deps.today,
  }
}

/**
 * The access for the open scope, made again when its principles change, the
 * index moves or the scope does; read through a ref inside, so a screen
 * holding it reads the latest.
 */
export function usePrinciplesAccess(deps: PrinciplesDeps): PrinciplesAccess {
  const latest = useRef(deps)
  latest.current = deps
  const { model } = deps.session
  const version = useRef(0)
  return useMemo(() => {
    version.current += 1
    return principlesAccess(latest.current, version.current)
    // A new model or a new index is a new reading; the rest is read through the ref.
  }, [model.principles, model.principleGroups, deps.index, deps.scope, deps.session.readOnly])
}
