/**
 * A command channel: where a step goes when this session is not the only
 * author of a scope.
 *
 * ADR-0002 is why this is a seam and not a rewrite. Every change is a
 * `Command`, one pure reducer applies it, and the inverse is computed from the
 * state the reducer saw. Two sides that hold the same model and apply the same
 * commands in the same order hold the same model — so the whole of what a
 * second author needs is somebody to put the steps in one order, and one place
 * to hand them over. This is that place; nothing else about the model, the
 * session or the screen changes.
 *
 * The channel is **per scope**, because a session is per scope and a command
 * is built against one model. What crosses scopes — *link*, a refresh of
 * stand-ins, creating or moving a scope, a scope's own settings — does not
 * come through here: it stays on the file channel and the tree feed, the way
 * `useIndex` and `useOrganisation` already read it. That is not a gap. Those
 * gestures are barriers on the undo stack already (ADR-0012 §10), and they are
 * rare enough that *changed on disk* is the right shape for them.
 *
 * Interfaces only. `CommandChannel.contract.ts` beside this file is what a
 * filling has to show, and `adapters/memory/InMemoryCommandChannel.ts` is the
 * one that comes with it.
 */
import type { Command } from '../model/commands'
import type { CommandRefusal } from '../model/reducer'
import type { ScopePath } from '../projects/scopePath'

/**
 * A step as the session made it, on its way out.
 *
 * A step is what the session already records as one `HistoryStep`: one
 * command, usually a transaction, on one scope, summarised by
 * `model/activity.ts` like any other.
 */
export type StepEnvelope = {
  scope: ScopePath
  /**
   * Minted by the sender, so its own step is recognised coming back and a
   * retry lands once. A sender that does not hear an answer — the connection
   * went, the tab was closed mid-send — publishes the same envelope again, and
   * the channel answers what it answered the first time rather than sequencing
   * the step twice.
   */
  stepId: string
  /**
   * The sequence number the command was built against: the `revision` the
   * agent already names (ADR-0011), read across authors instead of within one
   * session.
   *
   * A sender fills it in and a channel need not read it: putting steps in one
   * order does not require knowing what anybody built theirs on. It is carried
   * because a channel that DOES decide two steps overlap has nothing else to
   * decide it with — a step whose `base` is behind the head was built against a
   * model that has since moved, and which of the steps since then it disagrees
   * with is a question only the head can answer. See {@link PublishAnswer} for
   * what such a channel may answer and in which order.
   */
  base: number
  command: Command
  /** When the sender made it, epoch milliseconds. */
  at: number
}

/** A step as the channel hands it out, in order. */
export type SequencedStep = {
  scope: ScopePath
  /**
   * Assigned by the channel, per scope, one up from the last. The first step
   * on a scope is 1, so **0 is "nothing yet"** and a session with no history
   * of a scope subscribes from there.
   */
  seq: number
  stepId: string
  command: Command
  /**
   * Who made it: the channel's word, never the sender's claim. A string
   * identity and nothing more — the channel says what it means by it, and
   * everything above here only ever compares it or shows it.
   */
  by: string
  at: number
}

/**
 * What a `publish` answers.
 *
 * A refusal is a key, never a sentence, for the reason the reducer's are: a
 * caller reads a key and decides. `command.taken` is the reducer's own
 * (`model/reducer.ts`) and arrives here when the head model already holds an
 * id this step creates; `agent.readOnly` is the one refusal that is about the
 * sender rather than the command.
 *
 * **A channel may have one more of its own, and the reducer's comes first.**
 * Deciding that a step whose `base` is behind the head overlaps one sequenced
 * since is a judgement about the landscape and belongs to whoever holds the
 * other end (ADR-0022, *what is deliberately not here*), so the key for it is
 * not defined in this repository and the type is open for it. What IS settled
 * here is the order the two are asked in: **a command the reducer refuses is
 * answered with the reducer's refusal, whatever the step's `base` says.** So a
 * create on an id the head already holds is always `command.taken` — the
 * refusal whose repair is to mint another id and send the step again — and
 * never a staleness key, which would send that sender to re-read a scope it has
 * no reason to re-read. A channel's own refusal is for the steps the reducer
 * would have taken.
 */
export type PublishAnswer =
  | { seq: number }
  | { refused: CommandRefusal | 'agent.readOnly' | (string & Record<never, never>) }

export interface CommandChannel {
  /** Which channel this is, for a diagnostic to name. */
  readonly id: string

  /**
   * Hand one step over. The answer is the sequence number it was given, or the
   * refusal — and a refusal means the step was not sequenced and nobody saw
   * it, so the sender has a model nobody else ever had and must put it back.
   */
  publish(step: StepEnvelope): Promise<PublishAnswer>

  /**
   * Every step on this scope after `after`, including our own, until the
   * returned function is called.
   *
   * Our own comes back too, and deliberately: a sender recognises it by
   * `stepId` and learns the `seq` it was given, which is the same fact
   * `publish` answers and is how a sender that missed the answer catches up.
   *
   * `onGap` when `after` is further back than the channel can answer from,
   * and then nothing is handed out for what is missing. It is not a failure —
   * a channel keeps a bounded log, and a session that has been away longer
   * than that is told to read the scope again rather than handed a silently
   * incomplete run. The subscription stays live for what comes next.
   *
   * A step that changes nothing is not handed out at all: the reducer answers
   * with the model it was given, the sequence stands still, and an Activity
   * list somewhere does not fill up with steps nobody made.
   */
  subscribe(
    scope: ScopePath,
    after: number,
    on: (step: SequencedStep) => void,
    onGap: () => void,
  ): () => void

  /**
   * Who else has this scope open: names only, for the bar to show. Optional,
   * because a channel may have no way to know.
   */
  presence?(scope: ScopePath): Promise<readonly string[]>
}
