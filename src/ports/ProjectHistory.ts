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

/** One snapshot, as a person reads a list of them. */
export type HistoryEntry = {
  /** Opaque; hand it back to read that version. */
  id: string
  /** What the snapshot said it was. */
  subject: string
  /** Epoch milliseconds. */
  at: number
  author: string
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
  /** The snapshots, newest first. */
  entries(limit?: number): Promise<HistoryEntry[]>
  /**
   * One project as it was at a snapshot, or `undefined` when it was not there.
   *
   * A whole project rather than a diff: what "changed" means is the model's
   * question (`model/diff.ts`), and a seam that answered it would be deciding
   * how a landscape is compared.
   */
  projectAt(ref: ProjectRef, entry: string): Promise<ProjectSnapshot | undefined>
}
