// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The step ids a folder has applied, and the scope each went to
 * (`ScopeRepository.apply`: a step lands once, and is refused for any other
 * scope; the ids are remembered for at least a day).
 *
 * **Never in the folder.** A file of ours in a person's folder is one they see,
 * one git shows, and one a copy of the folder carries to where the ids mean
 * nothing; and the folder's `.git` is git's, which nothing but git writes. So
 * the ids are kept wherever whoever composes the folder says (`StepStore`):
 * on the desktop, in its own data folder beside what it does about each
 * folder, keyed by the folder (`desktop/desktopStepStore.ts`), which keeps them
 * through a restart. Where nobody says — a browser's folder, whose handle has
 * no identity storage can be keyed by — they are kept for as long as the
 * repositories are open, and ADR-0031's record of the build says so.
 *
 * Remembered for two days and then forgotten: the promise is one, and a step
 * sent again after that is a new step.
 */
import type { ScopeId } from '../../projects/scopeState'

/**
 * Each applied step id, the scope it went to, and when, in epoch milliseconds;
 * and, for a step whose write was begun and is not known to have landed, what
 * the scope's files were to be fingerprinted as once it had.
 */
export type AppliedSteps = Record<string, [ScopeId, number] | [ScopeId, number, string]>

/** Where a step went, and — while its write is not known to have landed — what the scope was to be after it. */
export type StepPlace = { scope: ScopeId; expected?: string }

/** Where a folder's applied step ids are kept between one opening of it and the next. */
export type StepStore = {
  read(): Promise<AppliedSteps | undefined>
  write(steps: AppliedSteps): Promise<void>
}

/** Kept for as long as the repositories are open, and no longer. */
export function stepsInMemory(): StepStore {
  let held: AppliedSteps | undefined
  return {
    read: () => Promise.resolve(held && structuredClone(held)),
    write: (steps) => {
      held = structuredClone(steps)
      return Promise.resolve()
    },
  }
}

/** How long an id is remembered: twice the day the contract promises. */
const REMEMBERED_MS = 2 * 24 * 60 * 60 * 1000

type Held = Map<string, { scope: ScopeId; at: number; expected?: string }>

export class StepMemory {
  private held: Held | undefined

  constructor(private readonly store: StepStore = stepsInMemory(), private readonly now: () => number = Date.now) {}

  private async load(): Promise<Held> {
    if (this.held) return this.held
    const held: Held = new Map()
    for (const [id, [scope, at, expected]] of Object.entries(await this.store.read() ?? {})) {
      held.set(id, { scope, at, ...(typeof expected === 'string' ? { expected } : {}) })
    }
    this.held = held
    return held
  }

  /** Where a step id went, within the time it is remembered; with what was expected, where its write was begun and not known to have landed. */
  async where(stepId: string): Promise<StepPlace | undefined> {
    const found = (await this.load()).get(stepId)
    if (!found || this.now() - found.at >= REMEMBERED_MS) return undefined
    return { scope: found.scope, ...(found.expected !== undefined ? { expected: found.expected } : {}) }
  }

  /**
   * Steps whose write is about to begin, each with what its scope's files are
   * to be fingerprinted as once it has: remembered before the write, so that a
   * step sent again after a stop part way lands where its scope did not change,
   * and is known as landed where it did.
   */
  async pend(steps: readonly { stepId: string; scope: ScopeId; expected: string }[]): Promise<void> {
    if (steps.length === 0) return
    const held = await this.load()
    const now = this.now()
    for (const { stepId, scope, expected } of steps) held.set(stepId, { scope, at: now, expected })
    await this.keep(held, now)
  }

  /** Steps applied, each to its scope; what is older than the memory is let go of on the way. */
  async remember(applied: readonly { stepId: string; scope: ScopeId }[]): Promise<void> {
    if (applied.length === 0) return
    const held = await this.load()
    const now = this.now()
    for (const { stepId, scope } of applied) held.set(stepId, { scope, at: now })
    await this.keep(held, now)
  }

  private async keep(held: Held, now: number): Promise<void> {
    for (const [id, { at }] of held) if (now - at >= REMEMBERED_MS) held.delete(id)
    await this.store.write(Object.fromEntries([...held].map(([id, { scope, at, expected }]) =>
      [id, expected === undefined ? [scope, at] : [scope, at, expected]])))
  }
}
