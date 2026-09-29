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
import type { Repositories } from './Repositories'
import type { Applied, Created, Moved, NewScope, Refused, Removed, StepsFor } from './ScopeRepository'

/** One implementation under test, and what the suites need of it that the seams do not carry. */
export type RepositoriesUnderTest = {
  repositories: Repositories
  /**
   * Close an entry on every scope a step has changed since the last one:
   * whatever this implementation does to make applied steps into a history
   * entry — record a version, let a quiet moment pass. The subject is what
   * the entry says it was, where the implementation keeps one. A scope that
   * nothing changed since gets no entry.
   */
  cut(subject?: string): Promise<void>
  /**
   * Resolves when everything these repositories were asked to do has reached
   * everything that follows it — the index, the history. Optional: an
   * implementation that does its work before it answers has nothing to wait for.
   */
  settled?(): Promise<void>
  /**
   * Make one scope's state one the implementation cannot read whole, the way
   * a part of it refusing to be read does. Optional: only an implementation
   * that can meet such a state has anything to show about it.
   */
  spoil?(scope: ScopeId): void | Promise<void>
}

/** Repositories to test, fresh and empty but for the organisation. */
export type MakeRepositories = () => RepositoriesUnderTest | Promise<RepositoriesUnderTest>

export function element(id: string, name: string, description?: string): DesignElement {
  return {
    id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {},
    ...(description !== undefined ? { description } : {}),
  }
}

let minted = 0
let lastAt = 0

/**
 * A step, the way a session makes one: predictable ids, so a failure reads,
 * and the time it was made — never before the last one, so a history read
 * newest first is also read latest first.
 */
export function step(command: ScopeCommand): ScopeStep {
  minted += 1
  lastAt = Math.max(Date.now(), lastAt + 1)
  return { stepId: `contract-step-${minted}`, command, at: lastAt }
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
 * The repositories under test with a settle folded into every write, so that
 * a clause looks only once the write has reached everything that follows it.
 */
export function over(under: RepositoriesUnderTest) {
  const { scopes, index, history, images, settings } = under.repositories
  const settle = (): Promise<void> => Promise.resolve(under.settled?.())
  const settled = async <T>(answer: Promise<T>): Promise<T> => {
    const value = await answer
    await settle()
    return value
  }
  return {
    scopes, index, history, images, settings, settle,
    apply: (work: readonly StepsFor[]): Promise<Applied | Refused> => settled(scopes.apply(work)),
    create: (at: ScopeAddress, scope: NewScope): Promise<Created | Refused> => settled(scopes.create(at, scope)),
    move: (scope: ScopeId, to: ScopeAddress, expects?: Revision): Promise<Moved | Refused> =>
      settled(scopes.move(scope, to, expects)),
    remove: (scope: ScopeId, expects?: Revision): Promise<Removed | Refused> => settled(scopes.remove(scope, expects)),
    /** Steps on one scope, which must land. */
    steps: async (scope: ScopeId, ...commands: ScopeCommand[]): Promise<Revision> =>
      ok(await settled(scopes.apply([{ scope, steps: commands.map(step) }]))).revisions[0],
    /** A new scope, which must be created. */
    scope: async (at: ScopeAddress, name: string): Promise<ScopeId> => ok(await settled(scopes.create(at, { name }))).id,
    cut: async (subject?: string): Promise<void> => {
      await under.cut(subject)
      await settle()
    },
    /** The organisation's identity. */
    root: async (): Promise<ScopeId> => (await scopes.tree()).root.id,
    /** A scope's state, which must be there. */
    state: async (scope: ScopeId): Promise<ScopeState> => {
      const found = await scopes.state(scope)
      expect(found, `a state for ${scope}`).toBeDefined()
      return found!
    },
  }
}

export type Over = ReturnType<typeof over>
