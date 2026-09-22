// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A command channel in memory: for tests, and for anywhere two sessions have
 * to be put in one order without anything outliving the process.
 *
 * Per scope it keeps a head model, a bounded log of the steps that made it,
 * and the subscribers. A publish runs `apply` against the head — the same
 * reducer the sessions ran it against, which is the whole of why this works —
 * gives it the next sequence number, appends it and hands it to everybody,
 * the sender included.
 *
 * `connect(by)` is one way in per author, over the same scopes. The channel
 * itself is a way in too, under whatever `by` it was made with, so the common
 * case of one author reads as one object.
 *
 * Two things are deliberately **not** here. There is no check for two steps
 * that touch the same thing: putting steps in one order is what a channel
 * owes, and deciding that two of them overlap is a judgement about the
 * landscape that belongs to whoever is holding the other end. And the head is
 * only ever the steps applied in order — this channel keeps no document and
 * writes nothing down, which is what "in memory" means here.
 */
import { fromArrays } from '../../model/normalised'
import type { Model } from '../../model/normalised'
import type { HostModel } from '../../model/hostModel'
import { apply } from '../../model/reducer'
import type { ScopePath } from '../../projects/scopePath'
import type { CommandChannel, PublishAnswer, SequencedStep, StepEnvelope } from '../../ports/CommandChannel'

/** A scope the channel starts from, rather than from nothing. */
export type SeededScope = { scope: ScopePath; model: Model | HostModel }

export type InMemoryCommandChannelOptions = {
  /** Who this way in publishes as. Another author is `connect`. */
  by?: string
  /** The head each scope starts from. A scope nobody seeded starts empty. */
  seed?: readonly SeededScope[]
  /**
   * How many steps per scope to keep. A channel's log is bounded — a session
   * that has been away longer than the window is told so (`onGap`) rather than
   * handed an incomplete run — and here it is a number so that can be tested
   * without publishing thousands of steps.
   */
  keep?: number
}

type Subscriber = { by: string; on: (step: SequencedStep) => void }

type ScopeState = {
  head: Model
  seq: number
  log: SequencedStep[]
  /** Every stepId this channel has answered, so a retry lands once. */
  answered: Map<string, PublishAnswer>
  subscribers: Set<Subscriber>
}

const EMPTY: HostModel = { name: '', elements: [], relations: [], diagrams: [] }

function indexed(model: Model | HostModel): Model {
  return Array.isArray(model.elements) ? fromArrays(model as HostModel) : model as Model
}

export class InMemoryCommandChannel implements CommandChannel {
  readonly id = 'memory'
  private readonly by: string
  private readonly keep: number
  private readonly scopes = new Map<ScopePath, ScopeState>()

  constructor(options: InMemoryCommandChannelOptions = {}) {
    this.by = options.by ?? 'me'
    this.keep = options.keep ?? Number.POSITIVE_INFINITY
    for (const seeded of options.seed ?? []) this.at(seeded.scope).head = indexed(seeded.model)
  }

  /** Another way in to the same scopes, as another author. */
  connect(by: string): CommandChannel {
    return {
      id: this.id,
      publish: (step) => this.send(by, step),
      subscribe: (scope, after, on, onGap) => this.listen(by, scope, after, on, onGap),
      presence: (scope) => this.who(scope),
    }
  }

  publish(step: StepEnvelope): Promise<PublishAnswer> {
    return this.send(this.by, step)
  }

  subscribe(
    scope: ScopePath, after: number,
    on: (step: SequencedStep) => void, onGap: () => void,
  ): () => void {
    return this.listen(this.by, scope, after, on, onGap)
  }

  presence(scope: ScopePath): Promise<readonly string[]> {
    return this.who(scope)
  }

  /** The head of a scope, for a test to read what the channel believes. */
  head(scope: ScopePath): Model {
    return this.at(scope).head
  }

  private at(scope: ScopePath): ScopeState {
    let state = this.scopes.get(scope)
    if (!state) {
      state = { head: fromArrays(EMPTY), seq: 0, log: [], answered: new Map(), subscribers: new Set() }
      this.scopes.set(scope, state)
    }
    return state
  }

  private send(by: string, step: StepEnvelope): Promise<PublishAnswer> {
    const state = this.at(step.scope)
    const already = state.answered.get(step.stepId)
    if (already) return Promise.resolve(already)

    // `base` is carried and not read: it is what a side that decides two steps
    // overlap would decide with, and that decision is not this channel's.
    const result = apply(state.head, step.command)
    if (!result.ok) return Promise.resolve(this.answered(state, step.stepId, { refused: result.reason }))
    // The reducer hands back the model it was given when a command changed
    // nothing. Nobody needs telling, and the sequence stands still.
    if (result.model === state.head) {
      return Promise.resolve(this.answered(state, step.stepId, { seq: state.seq }))
    }

    state.head = result.model
    const sequenced: SequencedStep = {
      scope: step.scope,
      seq: ++state.seq,
      stepId: step.stepId,
      command: step.command,
      by,
      at: step.at,
    }
    state.log.push(sequenced)
    while (state.log.length > this.keep) state.log.shift()
    const answer = this.answered(state, step.stepId, { seq: sequenced.seq })
    // A copy, because a subscriber is free to stop inside its own handler.
    for (const subscriber of [...state.subscribers]) subscriber.on(sequenced)
    return Promise.resolve(answer)
  }

  /**
   * Remember what a step was answered, within the same window the log keeps —
   * which is as long as a retry of it could still arrive.
   */
  private answered(state: ScopeState, stepId: string, answer: PublishAnswer): PublishAnswer {
    state.answered.set(stepId, answer)
    while (state.answered.size > this.keep) {
      const oldest = state.answered.keys().next()
      if (oldest.done) break
      state.answered.delete(oldest.value)
    }
    return answer
  }

  private listen(
    by: string, scope: ScopePath, after: number,
    on: (step: SequencedStep) => void, onGap: () => void,
  ): () => void {
    const state = this.at(scope)
    const subscriber: Subscriber = { by, on }
    state.subscribers.add(subscriber)

    // The furthest back this channel can still answer from. With nothing in
    // the log that is where the sequence stands: there is nothing to have
    // missed, whatever has been forgotten.
    const earliest = state.log.length > 0 ? state.log[0].seq - 1 : state.seq
    if (after < earliest) onGap()
    else for (const step of state.log) if (step.seq > after) on(step)

    return () => { state.subscribers.delete(subscriber) }
  }

  private who(scope: ScopePath): Promise<readonly string[]> {
    const names: string[] = []
    for (const subscriber of this.at(scope).subscribers) {
      if (!names.includes(subscriber.by)) names.push(subscriber.by)
    }
    return Promise.resolve(names)
  }
}
