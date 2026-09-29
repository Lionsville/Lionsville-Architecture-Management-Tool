// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The step ids a folder has applied, and the scope each went to
 * (`ScopeRepository.apply`: a step lands once, and is refused for any other
 * scope; the ids are remembered for at least a day).
 *
 * **Kept where a person does not look.** A folder that keeps a history has a
 * `.git` folder, which is the history's own and which no file manager, no
 * `git status` and no copy of the work shows; the ids are a small file in it.
 * A folder that keeps none has nowhere of the kind, and a file of ours beside
 * a person's work is what ADR-0023 took out of it — so there the ids are
 * remembered for as long as the repositories are open, and that is said in
 * ADR-0031's record of the build.
 *
 * Remembered for two days and then forgotten: the promise is one, and a step
 * sent again after that is a new step.
 */
import { parseJson, stableJson } from '../../projects/fileText'
import type { ScopeId } from '../../projects/scopeState'
import type { DirectoryHandleLike } from './DirectoryHandle'
import { folderAt, textAt, writeAt } from './handles'

/** Where in `.git` the ids are kept. */
const KEPT_AT = '.git/lionsville-architect/applied-steps.json'

/** How long an id is remembered: twice the day the contract promises. */
const REMEMBERED_MS = 2 * 24 * 60 * 60 * 1000

type Held = Map<string, { scope: ScopeId; at: number }>

export class StepMemory {
  private held: Held | undefined

  constructor(private readonly root: DirectoryHandleLike, private readonly now: () => number = Date.now) {}

  /** Whether the folder has somewhere to keep the ids that a person does not see. */
  private async kept(): Promise<boolean> {
    return (await folderAt(this.root, '.git').catch(() => undefined)) !== undefined
  }

  private async load(): Promise<Held> {
    if (this.held) return this.held
    const held: Held = new Map()
    const text = await this.kept() ? await textAt(this.root, KEPT_AT).catch(() => undefined) : undefined
    const read = text === undefined ? undefined : parseJson(text)
    const steps = read && typeof read === 'object' ? (read as { steps?: unknown }).steps : undefined
    if (steps && typeof steps === 'object') {
      for (const [id, row] of Object.entries(steps as Record<string, unknown>)) {
        const [scope, at] = Array.isArray(row) ? row as unknown[] : []
        if (typeof scope === 'string' && typeof at === 'number') held.set(id, { scope, at })
      }
    }
    this.held = held
    return held
  }

  /** The scope a step id was applied to, where it was, within the time it is remembered. */
  async where(stepId: string): Promise<ScopeId | undefined> {
    const found = (await this.load()).get(stepId)
    return found && this.now() - found.at < REMEMBERED_MS ? found.scope : undefined
  }

  /** Steps applied, each to its scope; what is older than the memory is let go of on the way. */
  async remember(applied: readonly { stepId: string; scope: ScopeId }[]): Promise<void> {
    if (applied.length === 0) return
    const held = await this.load()
    const now = this.now()
    for (const { stepId, scope } of applied) held.set(stepId, { scope, at: now })
    for (const [id, { at }] of held) if (now - at >= REMEMBERED_MS) held.delete(id)
    if (!await this.kept()) return
    const steps = Object.fromEntries([...held].map(([id, { scope, at }]) => [id, [scope, at]]))
    await writeAt(this.root, KEPT_AT, stableJson({ version: 1, steps }))
  }
}
