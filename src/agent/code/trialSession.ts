// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope tried on a copy (ADR-0050): the session a script's calls are
 * answered over, so that what a script changes is changed nowhere yet.
 *
 * A trial holds one scope's model as it was when the script first touched it
 * and every command the script's calls made of it since. A call is answered
 * by the handler itself over {@link Trial.over} — the trial's model, with the
 * call's own rights — so a write is built, checked and refused by the code
 * that builds, checks and refuses a plain one, and applied through the one
 * reducer; a read of the same scope later in the script sees what the script
 * did. Nothing reaches the scope until the commands are landed, as one step,
 * by whoever runs the simulation (`simulate.ts`).
 *
 * **Ids are the trial's own**, and the same every time the same script is
 * tried on the same scope at the same revision: a new element's is its
 * name's key, kept clear of what the model and the tree hold; an id with no
 * name behind it is a fingerprint of the script, the scope, the revision and
 * its place in the run. So what a simulation answers is what its run lands,
 * and trying a script twice does not use anything up.
 *
 * **What a trial is not.** It has no screen, takes no picture, saves nothing
 * and undoes nothing; and it is one scope, so the three seams a session
 * lands other scopes through are not on it (`SessionView.inScript`).
 */
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import { claimKey } from '../../model/keys'
import type { IdPolicy, MakeId } from '../../model/keys'
import { toArrays } from '../../model/normalised'
import type { Model } from '../../model/normalised'
import { apply } from '../../model/reducer'
import type { SessionView } from '../handle'

export type Trial = {
  readonly scope: string
  /** The scope's revision when the trial began: what its commands are held to when they land. */
  readonly base: number
  /** The model as it was then. */
  readonly before: Model
  /** The model as the script has left it. */
  model(): Model
  /** Every command the script's calls made, in order. */
  commands(): readonly Command[]
  /** The view a command made the one in front, where one did. */
  activeDiagramId(): string | undefined
  /** The session one call is answered over: the trial's model, and that call's own rights. */
  over(session: SessionView): SessionView
}

/** FNV-1a, 32 bits, as hex: a fingerprint for an id, not a secret. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5
  for (let at = 0; at < text.length; at++) {
    hash ^= text.charCodeAt(at)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * A trial of the scope `session` is on, for the script with this
 * fingerprint. `session` is the scope as the host holds it now; the trial
 * copies nothing, since a model is never changed in place.
 */
export function trialOf(session: SessionView, script: string): Trial {
  const scope = session.scopePath()
  const base = session.revision()
  const before = session.indexed()
  let model = before
  let current: HostModel | undefined
  let active: string | undefined
  const commands: Command[] = []
  const seed = `${script}\n${scope}\n${base}`

  let minted = 0
  const makeId: MakeId = (prefix) => `${prefix}-${fingerprint(`${seed}\n${minted += 1}`)}`

  const handedOut = new Set<string>()
  const taken = (): Set<string> => new Set([
    ...model.order.elements, ...model.order.relations, ...model.order.diagrams, ...(session.takenIds?.() ?? []), ...handedOut,
  ])
  let connections = 0
  const ids: IdPolicy = {
    element(name) {
      const key = claimKey(name, taken())
      handedOut.add(key)
      return key
    },
    connection() {
      const held = taken()
      let id: string
      do {
        id = `c#${connections += 1}-${fingerprint(seed)}`
      } while (held.has(id))
      handedOut.add(id)
      return id
    },
    refresh() {},
  }

  return {
    scope, base, before,
    model: () => model,
    commands: () => commands,
    activeDiagramId: () => active,
    over(call) {
      // What lands other scopes, draws, saves or takes back is left off: a trial is one scope, tried.
      const {
        changeAcross: _across, landSteps: _steps, followScopeTypes: _follow, undoRun: _undoRun, addImage: _addImage, renderer: _renderer,
        ...rest
      } = call
      void [_across, _steps, _follow, _undoRun, _addImage, _renderer]
      return {
        ...rest,
        inScript: true,
        indexed: () => model,
        current: () => (current ??= toArrays(model)),
        activeDiagramId: () => active ?? call.activeDiagramId(),
        dispatch: (command, options) => {
          const result = apply(model, command)
          if (!result.ok) return undefined
          model = result.model
          current = undefined
          commands.push(command)
          if (options?.activeDiagramId) active = options.activeDiagramId
          return (current = toArrays(model))
        },
        ids,
        makeId,
        // The revision the script decides against is the one it was tried at, whatever it has changed since.
        revision: () => base,
        undo: () => {},
        save: () => Promise.reject(new Error('a trial saves nothing')),
      }
    },
  }
}
