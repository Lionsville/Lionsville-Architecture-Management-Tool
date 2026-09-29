// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the five repository suites share: the maker every implementation
 * hands them, and the few lines each clause is written with.
 *
 * One maker for all five, because a source brings its repositories as one
 * value (`Repositories`) and they answer over the same scopes: a step applied
 * through one is what the others follow. Each suite is its own `describe…`,
 * so an implementation runs them one by one and a failure says which seam it
 * is in:
 *
 * ```ts
 * // beside the implementation
 * describeScopeRepository('somewhere', makeSomewhere)
 * describeOrganisationIndex('somewhere', makeSomewhere)
 * describeHistoryRepository('somewhere', makeSomewhere)
 * describeImageRepository('somewhere', makeSomewhere)
 * describeSettingsRepository('somewhere', makeSomewhere)
 * ```
 *
 * **The maker may be async, and the repositories may say when they have
 * settled**, for the reason the command channel's suite lets them: something
 * that answers over a network is connected before it is a repository, and an
 * index that follows the steps may follow them a moment later. Every clause
 * goes through {@link over}, which settles after every write, so no clause can
 * forget.
 *
 * Named `.contract.ts` so the runner does not pick it up on its own.
 */
import { expect } from 'vitest'
import type { Command } from '../model/commands'
import type { HostModel } from '../model/hostModel'
import { fromArrays, toArrays } from '../model/normalised'
import { apply } from '../model/reducer'
import type { DesignElement } from '../model/types'
import type { Revision, ScopeAddress, ScopeCommand, ScopeId, ScopeState, ScopeStep } from '../projects/scopeState'
import type { HistoryRepository } from './HistoryRepository'
import type { ImageRepository } from './ImageRepository'
import type { Repositories } from './Repositories'
import type {
  Applied, Created, Moved, NewScope, Refused, Removed, ScopeNode, ScopeRepository, StepsFor,
} from './ScopeRepository'
import type { SettingsRepository } from './SettingsRepository'

/**
 * One implementation under test, and what the suites need of it that the
 * seams do not carry.
 *
 * **The maker configures the implementation so that an entry closes only at
 * `record`** while the suites run: no quiet window closing one on a timer, no
 * implementation deciding a run has ended. The history clauses count entries,
 * and an entry closed by anything but the clause's own `record` is one they
 * did not ask for.
 */
export type RepositoriesUnderTest = {
  repositories: Repositories
  /**
   * Resolves when everything these repositories were asked to do has reached
   * everything that follows it — the index, the history. Optional: an
   * implementation that does its work before it answers has nothing to wait for.
   */
  settled?(): Promise<void>
  /**
   * Make one scope's state one the implementation cannot read whole: the way
   * a part of it refusing to be read does (`damaged`), or the way a later
   * version of the app writing it does (`later`). Optional, and `false` for a
   * way the implementation cannot meet: only one that can meet such a state
   * has anything to show about it.
   */
  spoil?(scope: ScopeId, how: Spoiled): void | boolean | Promise<void | boolean>
}

/** How a scope is made one an implementation cannot read whole (`RepositoriesUnderTest.spoil`). */
export type Spoiled = 'damaged' | 'later'

/** Repositories to test, fresh and empty but for the organisation. */
export type MakeRepositories = () => RepositoriesUnderTest | Promise<RepositoriesUnderTest>

export function element(id: string, name: string, description?: string): DesignElement {
  return {
    id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {},
    ...(description !== undefined ? { description } : {}),
  }
}

let lastAt = 0

/**
 * A step, the way a session makes one: an id nobody else will mint, and the
 * time it was made — never before the last one, so a history read newest
 * first is also read latest first.
 */
export function step(command: ScopeCommand): ScopeStep {
  lastAt = Math.max(Date.now(), lastAt + 1)
  return { stepId: crypto.randomUUID(), command, at: lastAt }
}

export const addCrews: Command = { type: 'element.create', element: element('crews', 'Crews', 'Plans the crews.') }
export const addDepot: Command = { type: 'element.create', element: element('depot', 'Depot') }
export const renameCrews: Command = { type: 'element.update', id: 'crews', patch: { name: 'Crew planning' } }
export const addLandscape: Command = {
  type: 'diagram.create',
  diagram: { id: 'l7', kind: 'layer7', name: 'Landscape', members: {}, groups: {}, nodes: {}, boxes: {}, order: { members: [], routes: [], groups: [] } },
}

/** A model, as the reducer makes it from the one given by applying the commands in order. */
export function replayed(model: HostModel, commands: readonly Command[]): HostModel {
  let held = fromArrays(model)
  for (const command of commands) {
    const result = apply(held, command)
    if (!result.ok) throw new Error(`the reducer refused ${command.type}: ${result.reason}`)
    held = result.model
  }
  return toArrays(held)
}

/** The value of an answer, or the refusal said out loud. */
export function ok<T extends object>(answer: T): Exclude<T, { refused: unknown }> {
  if ('refused' in answer) throw new Error(`refused: ${String(answer.refused)}`)
  return answer as Exclude<T, { refused: unknown }>
}

/** The refusal an answer carries, or the success said out loud. */
export function refusal(answer: object): string {
  if (!('refused' in answer)) throw new Error(`answered ${JSON.stringify(answer)} where a refusal was expected`)
  return String(answer.refused)
}

/** A state without what a repository stamps on it, for comparing two reads of what it holds. */
export function held(state: ScopeState | undefined): Omit<ScopeState, 'revision' | 'updatedAt'> {
  if (!state) throw new Error('no state')
  const { revision: _revision, updatedAt: _updatedAt, ...rest } = state
  return rest
}

/**
 * The repositories under test with a settle folded into every write — a step,
 * a change to the tree, a record, a label, bytes put, settings written, a
 * scope spoiled — so that a clause looks only once the write has reached
 * everything that follows it. Every clause reaches the repositories through
 * this, and never through `under.repositories`.
 */
export function over(under: RepositoriesUnderTest) {
  const { scopes, index, history, images, settings } = under.repositories
  const settle = (): Promise<void> => Promise.resolve(under.settled?.())
  const settled = async <T>(answer: Promise<T>): Promise<T> => {
    const value = await answer
    await settle()
    return value
  }
  const written = {
    scopes: {
      id: scopes.id,
      tree: () => scopes.tree(),
      state: (scope) => scopes.state(scope),
      apply: (work) => settled(scopes.apply(work)),
      create: (at, scope) => settled(scopes.create(at, scope)),
      move: (scope, to, expects) => settled(scopes.move(scope, to, expects)),
      remove: (scope, expects) => settled(scopes.remove(scope, expects)),
    } satisfies ScopeRepository,
    history: {
      id: history.id,
      record: (wanted) => settled(history.record(wanted)),
      entries: (wanted) => history.entries(wanted),
      stateAt: (scope, entry) => history.stateAt(scope, entry),
      label: (scope, entry, name) => settled(history.label(scope, entry, name)),
      ...(history.unreadAt ? { unreadAt: (scope: ScopeId, entry: string) => history.unreadAt!(scope, entry) } : {}),
    } satisfies HistoryRepository,
    images: {
      id: images.id,
      put: (scope, name, bytes) => settled(images.put(scope, name, bytes)),
      list: (scope, within) => images.list(scope, within),
      find: (scope, name) => images.find(scope, name),
      bytes: (scope, name) => images.bytes(scope, name),
    } satisfies ImageRepository,
    settings: {
      id: settings.id,
      read: (of) => settings.read(of),
      write: (of, patch) => settled(settings.write(of, patch)),
    } satisfies SettingsRepository,
  }
  return {
    ...written, index, settle,
    apply: (work: readonly StepsFor[]): Promise<Applied | Refused> => written.scopes.apply(work),
    create: (at: ScopeAddress, scope: NewScope): Promise<Created | Refused> => written.scopes.create(at, scope),
    move: (scope: ScopeId, to: ScopeAddress, expects?: Revision): Promise<Moved | Refused> =>
      written.scopes.move(scope, to, expects),
    remove: (scope: ScopeId, expects?: Revision): Promise<Removed | Refused> => written.scopes.remove(scope, expects),
    /** Steps on one scope, which must land. */
    steps: async (scope: ScopeId, ...commands: ScopeCommand[]): Promise<Revision> =>
      ok(await written.scopes.apply([{ scope, steps: commands.map(step) }])).revisions[0],
    /** A new scope, which must be created. */
    scope: async (at: ScopeAddress, name: string): Promise<ScopeId> => ok(await written.scopes.create(at, { name })).id,
    /** Close every open entry, as a person's *Snapshot* does. */
    record: (subject?: string) => written.history.record(subject === undefined ? {} : { subject }),
    /** Spoil a scope, where the implementation can; `false` where it cannot. */
    spoil: async (scope: ScopeId, how: Spoiled = 'damaged'): Promise<boolean> => {
      if (!under.spoil) return false
      const done = await under.spoil(scope, how)
      await settle()
      return done !== false
    },
    /** The organisation's identity. */
    root: async (): Promise<ScopeId> => (await scopes.tree()).root.id,
    /** The identity of the scope at an address, which must be there. */
    scopeAt: async (address: ScopeAddress): Promise<ScopeId> => {
      const nodes = (node: ScopeNode): ScopeNode[] => [node, ...node.children.flatMap(nodes)]
      const found = nodes((await scopes.tree()).root).find((node) => node.address === address)
      expect(found, `a scope at ${address}`).toBeDefined()
      return found!.id
    },
    /** A scope's state, which must be there. */
    state: async (scope: ScopeId): Promise<ScopeState> => {
      const found = await scopes.state(scope)
      expect(found, `a state for ${scope}`).toBeDefined()
      return found!
    },
  }
}

export type Over = ReturnType<typeof over>
