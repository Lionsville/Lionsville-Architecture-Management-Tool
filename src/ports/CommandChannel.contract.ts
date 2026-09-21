/**
 * What every command channel must do — written once, run by all of them.
 *
 * The same posture `ScopeStore.contract.ts` takes, and for the same reason: a
 * seam that exists only as a TypeScript interface pins down shapes, not
 * behaviour. A second filling typechecks perfectly well while handing two
 * subscribers two different orders, sequencing a retry twice, or letting a
 * create quietly overwrite what the head already holds — and those are exactly
 * the faults that only surface with two authors on one scope, which is the
 * hardest thing to be looking at when it happens.
 *
 * So the behaviour lives here, and adding a channel is:
 *
 * ```ts
 * // src/adapters/somewhere/SomeCommandChannel.test.ts
 * describeCommandChannel('somewhere', (options) => ({ connect: (by) => … }))
 * ```
 *
 * The clauses are written against `apply` from `model/reducer` and nothing
 * else, because that is the whole claim: two sides that apply the same
 * commands in the same order hold the same model (ADR-0002).
 *
 * **The maker takes what the suite needs and the port does not carry.** Two
 * things: the head each scope starts from, and who a step published through
 * this way in was made by. Neither belongs on `CommandChannel` — a channel
 * knows its own identity and keeps its own head — so they sit on the maker,
 * the way `describeScopeStore`'s maker takes the root it is over.
 *
 * Named `.contract.ts` and not `.test.ts` on purpose: the runner must not pick
 * it up on its own, because without a filling there is nothing to run.
 */
import { describe, expect, it } from 'vitest'
import type { Command } from '../model/commands'
import { fromArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import type { HostModel } from '../model/hostModel'
import { apply } from '../model/reducer'
import type { DesignElement } from '../model/types'
import type { ScopePath } from '../projects/scopePath'
import type { CommandChannel, PublishAnswer, SequencedStep } from './CommandChannel'

export const SAMPLE_SCOPE: ScopePath = 'acme/landscape'

function element(id: string, name: string): DesignElement {
  return { id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {} }
}

/** Two applications and a landscape to draw them on. Enough to make steps over. */
export function sampleHead(): HostModel {
  return {
    name: 'Application landscape',
    elements: [element('crews', 'Crews'), element('depot', 'Depot')],
    relations: [],
    diagrams: [{ id: 'l7', kind: 'layer7', name: 'Landscape', members: [], geometry: { nodes: [] } }],
  }
}

/** A scope the channel is to start from. */
export type SeededScope = { scope: ScopePath; model: Model }

export type ChannelOptions = {
  /** The head of every scope the suite will publish on. */
  seed: readonly SeededScope[]
  /**
   * How many steps per scope the channel keeps. A channel's log is bounded,
   * and the suite sets this small so the gap clause has something to fall off
   * the end of. A filling free to keep everything still has to answer `onGap`
   * for an `after` it never issued.
   */
  keep?: number
}

/**
 * One channel, and the ways in to it. `connect` is called once per author: two
 * calls are two sessions over one channel, which is what most of the clauses
 * below are about.
 */
export type ChannelUnderTest = { connect(by: string): CommandChannel }

export type MakeCommandChannel = (options: ChannelOptions) => ChannelUnderTest

let minted = 0
/** A step id, the way a session mints one. Predictable here, so a failure reads. */
function stepId(): string {
  return `step-${++minted}`
}

/** Collect everything a subscription hands out, and whether it saw a gap. */
function listen(channel: CommandChannel, after = 0) {
  const seen: SequencedStep[] = []
  let gaps = 0
  const stop = channel.subscribe(SAMPLE_SCOPE, after, (step) => seen.push(step), () => { gaps++ })
  return { seen, stop, gaps: () => gaps }
}

/** Every step, in the order it was given, over the head the channel started from. */
function replay(steps: readonly SequencedStep[], from: Model = fromArrays(sampleHead())): Model {
  let model = from
  for (const step of steps) {
    const result = apply(model, step.command)
    if (!result.ok) throw new Error(`a sequenced step was refused on replay: ${result.reason}`)
    model = result.model
  }
  return model
}

/** The sequence number answered, or the failure said out loud. */
function seqOf(answer: PublishAnswer): number {
  if ('refused' in answer) throw new Error(`refused: ${answer.refused}`)
  return answer.seq
}

async function publish(
  channel: CommandChannel, command: Command, over: Partial<{ base: number; stepId: string }> = {},
): Promise<PublishAnswer> {
  return channel.publish({
    scope: SAMPLE_SCOPE,
    stepId: over.stepId ?? stepId(),
    base: over.base ?? 0,
    command,
    at: Date.UTC(2026, 8, 21),
  })
}

const addBilling: Command = { type: 'element.create', element: element('billing', 'Billing') }
const renameCrews: Command = { type: 'element.update', id: 'crews', patch: { name: 'Crew planning' } }
const renameDepot: Command = { type: 'element.update', id: 'depot', patch: { name: 'Depot planning' } }

export function describeCommandChannel(name: string, make: MakeCommandChannel): void {
  describe(`CommandChannel contract: ${name}`, () => {
    const one = (options: Partial<ChannelOptions> = {}): ChannelUnderTest =>
      make({ seed: [{ scope: SAMPLE_SCOPE, model: fromArrays(sampleHead()) }], ...options })

    /**
     * The whole claim, and the reason this is a seam rather than a rewrite:
     * two sides that apply the same commands in the same order hold the same
     * model. Everything else here exists to make sure they get the same order.
     */
    it('leaves two sessions holding the same model after interleaved steps', async () => {
      const channel = one()
      const mine = channel.connect('me')
      const theirs = channel.connect('you')
      const here = listen(mine)
      const there = listen(theirs)

      await publish(mine, addBilling)
      await publish(theirs, renameCrews)
      await publish(mine, renameDepot)
      await publish(theirs, { type: 'diagram.rename', id: 'l7', name: 'The landscape' })

      expect(here.seen.map((step) => step.seq)).toEqual(there.seen.map((step) => step.seq))
      expect(replay(here.seen)).toStrictEqual(replay(there.seen))
      expect(replay(here.seen).elements.billing.name).toBe('Billing')
      expect(replay(here.seen).elements.crews.name).toBe('Crew planning')
      here.stop()
      there.stop()
    })

    /** Its own step comes back too: that is how a sender learns the seq it got. */
    it('hands a sender its own step back, with the seq the publish answered', async () => {
      const channel = one()
      const mine = channel.connect('me')
      const here = listen(mine)
      const answer = await publish(mine, addBilling, { stepId: 'mine-1' })
      expect(here.seen).toHaveLength(1)
      expect(here.seen[0].stepId).toBe('mine-1')
      expect(here.seen[0].seq).toBe(seqOf(answer))
      here.stop()
    })

    it('says who made a step, from its own knowledge and not the sender’s claim', async () => {
      const channel = one()
      const theirs = channel.connect('you')
      const here = listen(channel.connect('me'))
      await publish(theirs, renameCrews)
      expect(here.seen.map((step) => step.by)).toEqual(['you'])
    })

    /** A sender that has been away asks from where it got to. */
    it('gives a subscriber from `after` exactly what it missed, and nothing twice', async () => {
      const channel = one()
      const mine = channel.connect('me')
      const first = seqOf(await publish(mine, addBilling))
      await publish(mine, renameCrews)
      await publish(mine, renameDepot)

      const late = listen(channel.connect('you'), first)
      expect(late.gaps()).toBe(0)
      expect(late.seen.map((step) => step.seq)).toEqual([first + 1, first + 2])

      // And from the head: nothing, until there is something.
      const current = late.seen[late.seen.length - 1].seq
      const caughtUp = listen(channel.connect('another'), current)
      expect(caughtUp.seen).toEqual([])
      await publish(mine, { type: 'diagram.rename', id: 'l7', name: 'Later' })
      expect(caughtUp.seen.map((step) => step.seq)).toEqual([current + 1])
      late.stop()
      caughtUp.stop()
    })

    it('stops when it is stopped', async () => {
      const channel = one()
      const mine = channel.connect('me')
      const here = listen(mine)
      here.stop()
      await publish(mine, addBilling)
      expect(here.seen).toEqual([])
    })

    /**
     * A refusal is the reducer's, answered at the head. The step never
     * happened as far as anybody else is concerned — which is the only honest
     * answer, because the sender applied it to a model nobody else ever had.
     */
    it('refuses a step the reducer refuses at the head, and sequences nothing', async () => {
      const channel = one()
      const mine = channel.connect('me')
      const here = listen(mine)
      const before = seqOf(await publish(mine, addBilling))
      expect(await publish(mine, { type: 'element.update', id: 'nope', patch: {} }))
        .toEqual({ refused: 'command.gone' })
      expect(here.seen.map((step) => step.seq)).toEqual([before])
      expect(seqOf(await publish(mine, renameCrews))).toBe(before + 1)
      here.stop()
    })

    /**
     * A create on an id the head already holds is `command.taken` (the
     * reducer's own key). It is the one refusal two authors meet in ordinary
     * work: ids are minted against what is taken, and two people adding
     * *Billing* in the same second both mint `billing`. The second one mints
     * again rather than overwriting the first.
     */
    it('refuses a create on an id the head already holds', async () => {
      const channel = one()
      const mine = channel.connect('me')
      const theirs = channel.connect('you')
      const here = listen(mine)
      await publish(mine, addBilling)
      expect(await publish(theirs, addBilling)).toEqual({ refused: 'command.taken' })
      expect(here.seen).toHaveLength(1)

      // Minted again, it lands.
      const again: Command = { type: 'element.create', element: element('billing-2', 'Billing') }
      expect('seq' in (await publish(theirs, again))).toBe(true)
      expect(replay(here.seen).elements['billing-2'].name).toBe('Billing')
      here.stop()
    })

    /**
     * A step that changes nothing is not a refusal and is not news. The
     * sequence stands still and nobody is woken, or an Activity list somewhere
     * fills up with steps nobody made.
     */
    it('answers a step that changes nothing with the sequence as it stands, and tells nobody', async () => {
      const channel = one()
      const mine = channel.connect('me')
      const here = listen(mine)
      const at = seqOf(await publish(mine, addBilling))
      expect(await publish(mine, { type: 'diagram.rename', id: 'l7', name: 'Landscape' })).toEqual({ seq: at })
      expect(here.seen).toHaveLength(1)
      here.stop()
    })

    /**
     * A sender that did not hear the answer sends the same envelope again. It
     * has to land once: the second publish repeats what the first answered and
     * sequences nothing.
     */
    it('repeats the answer to a stepId it has already answered, and sequences nothing', async () => {
      const channel = one()
      const mine = channel.connect('me')
      const here = listen(mine)
      const first = await publish(mine, addBilling, { stepId: 'retried' })
      const again = await publish(mine, addBilling, { stepId: 'retried' })
      expect(again).toEqual(first)
      expect(here.seen).toHaveLength(1)

      // Including a refusal: the answer is the answer, whichever it was.
      const bad: Command = { type: 'element.update', id: 'nope', patch: {} }
      expect(await publish(mine, bad, { stepId: 'refused-once' })).toEqual({ refused: 'command.gone' })
      expect(await publish(mine, bad, { stepId: 'refused-once' })).toEqual({ refused: 'command.gone' })
      expect(here.seen).toHaveLength(1)
      here.stop()
    })

    /**
     * A log is bounded, so a session that has been away longer than the
     * channel keeps cannot be given what it missed. Saying so is the point:
     * the alternative is an incomplete run applied in silence, and a model
     * that is quietly not everybody else's.
     */
    it('calls onGap for an `after` further back than it keeps', async () => {
      const channel = one({ keep: 2 })
      const mine = channel.connect('me')
      const from = seqOf(await publish(mine, addBilling))
      await publish(mine, renameCrews)
      await publish(mine, renameDepot)
      await publish(mine, { type: 'diagram.rename', id: 'l7', name: 'Later' })

      const late = listen(channel.connect('you'), from - 1)
      expect(late.gaps()).toBe(1)
      expect(late.seen).toEqual([])
      late.stop()
    })

    it('names the subscribers, where it can say', async () => {
      const channel = one()
      const mine = channel.connect('me')
      if (!mine.presence) return
      const here = listen(mine)
      const theirs = channel.connect('you')
      expect(await mine.presence?.(SAMPLE_SCOPE)).toEqual(['me'])
      const there = listen(theirs)
      expect([...(await mine.presence?.(SAMPLE_SCOPE) ?? [])].sort()).toEqual(['me', 'you'])
      there.stop()
      expect(await mine.presence?.(SAMPLE_SCOPE)).toEqual(['me'])
      here.stop()
    })
  })
}
