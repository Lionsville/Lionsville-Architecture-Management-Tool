// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the principles screens read and write through, filled from the open
 * scope (ADR-0041): its own principles and groups from the session, each
 * change one step there — undone with ⌘Z, in the Activity list — and the
 * principles of every scope above, and of every topic relevant here or above
 * (ADR-0042 §4), from the index, read-only here because a record is edited
 * where it lives (ADR-0012 §7).
 *
 * The citations (§7) are read the same way — the open scope's from its
 * session, every other scope's from the index — so how a principle is used
 * is counted across the tree, and one cited anywhere is not removed. What the
 * principle says about a citation (fixed, retired) is asked here, where the
 * principle is read, before the step; the reducer asks the rest.
 */
import { useMemo, useRef } from 'react'
import { apply } from '../../model/reducer'
import type { Command } from '../../model/commands'
import { principleList } from '../../model/normalised'
import { formatPrincipleNumber, mergePrinciples, nextPrincipleNumber } from '../../model/principle'
import type { Principle, PrincipleGroup, PrincipleRelation, PrincipleStatus } from '../../model/principle'
import { isAboutRecord, isCiting } from '../../model/citable'
import type { HostModel } from '../../model/hostModel'
import { RECORD_LISTS } from '../../model/recordKey'
import type { RecordKey } from '../../model/recordKey'
import type { PrincipleRef } from '../../model/principle'
import { citationRefusal } from '../../principles/principle'
import type { Citation, CitationRefusal, CitingRecord } from '../../principles/principle'
import { newAdr, nextAdrNumber } from '../../decisions/adr'
import type { Translate } from '../../i18n'
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
  /**
   * The topics whose principles are in force at a scope today (ADR-0042 §4):
   * relevant to it or to a scope above it. None where absent.
   */
  topics?: (scope: ScopePath) => readonly ScopePath[]
  /** The tree's index as it stands: the principles of every other scope. */
  index: Pick<ScopeIndex, 'principlesAt' | 'citations'>
  /** What a scope is called, as the tree says it. */
  scopeLabel: (path: ScopePath) => string
  makeId: (prefix: string) => string
  today: () => string
  /** The principles page of the open scope, on a principle. */
  openHere: (id?: string) => void
  /** Another scope's principles page, on a principle: where it is kept. */
  openThere?: (scope: ScopePath, id: string) => void
  /** The decisions page, on a decision: where a departure made from an element lands. */
  openDecision?: (id: string) => void
  /** The words a new decision is written in. */
  t?: Translate
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

/** One scope's citations, as the screens read them: the session's for the open scope, the index's for any other. */
function citationsIn(deps: PrinciplesDeps, scope: ScopePath): Citation[] {
  const kept = scope === deps.scope
    ? deps.session.model.citations ?? []
    : deps.index.citations().filter((one) => one.scope === scope).map((one) => one.citation)
  return kept.flatMap((one) => (isCiting(one.about.kind) ? [{ ...one, about: { kind: one.about.kind, id: one.about.id }, scope }] : []))
}

/** Every citation in the tree: the open scope's as its session holds them, every other's off the index. */
function everyCitation(deps: PrinciplesDeps): Citation[] {
  const elsewhere = deps.index.citations().filter((one) => one.scope !== deps.scope)
  const scopes = [...new Set(elsewhere.map((one) => one.scope))]
  return [...citationsIn(deps, deps.scope), ...scopes.flatMap((scope) => citationsIn(deps, scope))]
}

/** A record of the open scope as a citation names it: its label where it has a number, and its title or name. */
function recordLabelIn(model: HostModel, about: RecordKey): string {
  const list = (RECORD_LISTS as Record<string, keyof HostModel>)[about.kind]
  const held = (list ? model[list] as readonly { id: string; number?: number; title?: string; name?: string }[] | undefined : undefined)?.find((one) => one.id === about.id)
  if (!held) return about.id
  const prefix = LABEL_PREFIX[about.kind]
  const label = prefix && held.number !== undefined ? `${prefix}-${String(held.number).padStart(4, '0')} ` : ''
  return `${label}${held.title ?? held.name ?? about.id}`
}

const LABEL_PREFIX: Partial<Record<string, string>> = { decision: 'ADR', transition: 'TR', solution: 'SO', observation: 'OB' }

/**
 * What other records about the same subject cite (ADR-0041 §9): a decision
 * about an element, and the element, read each other's — the records that
 * say what a design should follow.
 */
function citedNearby(model: HostModel, citations: readonly Citation[], about: CitingRecord): PrincipleRef[] {
  const subjectOf = (record: RecordKey): string | undefined => {
    if (record.kind === 'element') return record.id
    if (record.kind === 'decision') return model.decisions?.find((one) => one.id === record.id)?.subjectId
    return undefined
  }
  const subject = subjectOf(about)
  if (subject === undefined) return []
  return citations
    .filter((one) => !isAboutRecord(one, about) && subjectOf(one.about) === subject)
    .map((one) => one.principle)
}

/**
 * *Deviates…* from an element (ADR-0041 §9): a new decision about it, proposed,
 * citing the principle it departs from with the reason, as one step; then the
 * decision, opened to be written.
 */
function deviate(deps: PrinciplesDeps, about: CitingRecord, ref: PrincipleRef, aspect: number | undefined, reason: string): CitationRefusal | undefined {
  if (about.kind !== 'element' || !deps.t) return 'stanceNotHere'
  const found = ownOf(deps, ref.scope).principles.find((one) => one.id === ref.id)
  if (!found) return 'principleRetired'
  const refused = citationRefusal(found, 'decision', 'deviates', reason)
  if (refused) return refused
  const model = deps.session.model
  const name = model.elements.find((one) => one.id === about.id)?.name ?? about.id
  const principle = `${formatPrincipleNumber(found.number)} ${found.title}`
  const decision = newAdr({
    id: deps.makeId('adr'), number: nextAdrNumber(model.decisions ?? []), date: deps.today(), t: deps.t, subjectId: about.id,
    title: deps.t('principles.deviateDecision', { name, principle }),
  })
  const failed = land(deps, {
    type: 'transaction',
    commands: [
      { type: 'decision.add', decision },
      { type: 'citation.add', citation: { id: deps.makeId('ci'), about: { kind: 'decision', id: decision.id }, principle: ref, ...(aspect !== undefined ? { aspect } : {}), stance: 'deviates', reason, on: deps.today() } },
    ],
  })
  if (failed) return 'stanceNotHere'
  deps.openDecision?.(decision.id)
  return undefined
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
  const sources = (scope: ScopePath): ScopePath[] => [...new Set([scope, ...ancestorScopes(scope), ...(deps.topics?.(scope) ?? [])])]
  const inForce = (scope: ScopePath): PrincipleInForce[] => sources(scope).flatMap((at) => {
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
    sourceOf: (at: ScopePath, scope: ScopePath): PrincipleSource => (scope === at
      ? { kind: 'here' }
      : ancestorScopes(at).includes(scope) ? { kind: 'above', scope } : { kind: 'topic', scope }),
    find: (ref) => inForce(here).find((one) => one.scope === ref.scope && one.principle.id === ref.id)
      ?? own(ref.scope).principles.filter((one) => one.id === ref.id).map((principle) => ({ scope: ref.scope, principle, groups: own(ref.scope).groups }))[0],
    citationsOf: (about, scope) => citationsIn(deps, scope).filter((one) => isAboutRecord(one, about)),
    citationsTo: (ref) => everyCitation(deps).filter((one) => one.principle.scope === ref.scope && one.principle.id === ref.id),
    recordLabel: (citation) => (citation.scope === here ? recordLabelIn(deps.session.model, citation.about) : citation.about.id),
    citedNearby: (about, scope) => (scope === here ? citedNearby(deps.session.model, citationsIn(deps, here), about) : []),
    cite: (citation) => {
      if (citation.scope !== here) return 'stanceNotHere'
      const principle = own(citation.principle.scope).principles.find((one) => one.id === citation.principle.id)
      const refused = principle ? citationRefusal(principle, citation.about.kind, citation.stance, citation.reason) : 'principleRetired'
      if (refused) return refused
      const { scope: _scope, ...kept } = citation
      void _scope
      const failed = land(deps, { type: 'citation.add', citation: { ...kept, id: deps.makeId('ci'), on: deps.today() } })
      return failed ? 'stanceNotHere' : undefined
    },
    uncite: (scope, id) => { if (scope === here) land(deps, { type: 'citation.remove', id }) },
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
    // Removed only while nothing anywhere cites it (§8): otherwise the page offers to retire it.
    remove: (scope, id) => scope === here && !everyCitation(deps).some((one) => one.principle.scope === here && one.principle.id === id)
      && land(deps, { type: 'principle.remove', id }) === undefined,
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
    ...(deps.t ? { deviate: (about: CitingRecord, ref: PrincipleRef, aspect: number | undefined, reason: string) => deviate(deps, about, ref, aspect, reason) } : {}),
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
  }, [model.principles, model.principleGroups, deps.index, deps.scope, deps.session.readOnly, deps.topics])
}
