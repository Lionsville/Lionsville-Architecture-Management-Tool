/**
 * Where the snapshots of this working directory are kept.
 *
 * The seam over layer two of ADR-0003. Deliberately not "git": what the shell
 * needs is somewhere to record a version and something to read one back from,
 * and git is the answer this build happens to have. A folder on a server, a
 * sync service's own version history, or nothing at all are all answers that
 * fit behind these six lines.
 *
 * **Everything may say no.** A machine without git, a folder nobody has opted
 * in for, a repository with no commits yet: all three are ordinary, and none of
 * them may stop a save. That is why `available()` is the first thing here and
 * why every caller is expected to ask it before offering anything.
 */
import type { ProjectSnapshot } from '../projects/project'
import type { ProjectRef } from '../projects/projectRef'
import type { LabelOutcome } from '../platform/history'
import type { PullOutcome, PushOutcome, ResolveOutcome, SyncRemote, SyncSide } from '../platform/sync'

/** One snapshot, as a person reads a list of them. */
export type HistoryEntry = {
  /** Opaque; hand it back to read that version. */
  id: string
  /** What the snapshot said it was. */
  subject: string
  /** Epoch milliseconds. */
  at: number
  author: string
  /** What people have called this version since (ADR-0008); usually none. */
  labels: readonly string[]
}

/** One thing's worth of a project's history: the project, and its paths. */
export type HistoryScope = {
  ref: ProjectRef
  /** Relative to the project folder; a `*` matches within a name. */
  paths: readonly string[]
}

export interface ProjectHistory {
  /** Can this machine keep a history at all? */
  available(): Promise<boolean>
  /** Is this working directory keeping one? */
  keeping(): Promise<boolean>
  /** Start keeping one. The opt-in, and the only thing that begins a history. */
  start(): Promise<void>
  /**
   * Record everything as it now stands.
   *
   * `false` when there was nothing to record, which is ordinary: the stores
   * write only what changed, so two snapshots with no editing between them
   * genuinely have nothing between them.
   */
  snapshot(message: string): Promise<boolean>
  /**
   * The snapshots, newest first.
   *
   * With `of`, only the ones that touched one thing (ADR-0008): a project, and
   * paths inside it as `projects/historyPath.ts` names them. The question is
   * the adapter's to answer because only it knows how cheaply — a history that
   * is git answers it in one command, and a history that is not may answer it
   * by reading every entry, which is its business.
   */
  entries(limit?: number, of?: HistoryScope): Promise<HistoryEntry[]>
  /**
   * One project as it was at a snapshot, or `undefined` when it was not there.
   *
   * A whole project rather than a diff: what "changed" means is the model's
   * question (`model/diff.ts`), and a seam that answered it would be deciding
   * how a landscape is compared.
   */
  projectAt(ref: ProjectRef, entry: string): Promise<ProjectSnapshot | undefined>
  /**
   * Call a snapshot something, afterwards (ADR-0008). A mark beside the
   * subject, never a rewrite of it, and one the history carries to whoever
   * else reads it. Refused as a value when the name is taken or is nothing.
   */
  label(entry: string, name: string): Promise<LabelOutcome>
  /**
   * The remote, where this history has one to talk to (ADR-0005). Absent
   * rather than answering "no" — a history that can be kept but not shared,
   * such as one a test supplies, offers nothing about syncing.
   */
  sync?: ProjectSync
}

/**
 * Push, pull, and the one question a person answers when the sides disagree.
 *
 * Each answers with a value, never an exception — a refusal is an ordinary
 * answer here — and none of them may interrupt a save. `resolve` leaves the
 * folder as it was when it refuses.
 */
export interface ProjectSync {
  remote(): Promise<SyncRemote | undefined>
  pull(): Promise<PullOutcome>
  push(): Promise<PushOutcome>
  resolve(side: SyncSide): Promise<ResolveOutcome>
}
