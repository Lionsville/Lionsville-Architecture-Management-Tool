/**
 * Git sync, as answers (ADR-0005).
 *
 * Push and pull run the user's own git and everything about them may say no:
 * no remote, a remote that cannot be reached, one that wants a credential the
 * app will never handle, one that does not answer. Each is an ordinary answer
 * here — a value, never an exception — and none of them may interrupt a save.
 * Shared by the electron main process, the channel and the seam, which is why
 * it sits in the one module all three may read.
 *
 * `diverged` and `rejected` are the same fact seen from the two ends: the
 * folder and its remote have both moved on. Neither is merged, rebased or
 * stashed; a person chooses which version stands, and both answers keep
 * everything.
 */
export type SyncRefusal = 'no-remote' | 'unreachable' | 'credentials' | 'timeout'

export type PullOutcome = 'done' | SyncRefusal | 'diverged'
export type PushOutcome = 'done' | SyncRefusal | 'rejected'
export type ResolveOutcome = 'done' | SyncRefusal

/** Which version stands when the two sides disagree. */
export type SyncSide = 'theirs' | 'ours'

/** The remote and branch git would push to. */
export type SyncRemote = {
  readonly name: string
  readonly branch: string
  readonly url?: string
}

export function isSyncRefusal(value: string): value is SyncRefusal {
  return value === 'no-remote' || value === 'unreachable' || value === 'credentials' || value === 'timeout'
}

/**
 * Where the local state goes when *take theirs* is chosen: a branch named for
 * the moment, reachable in any git client, never deleted by this app.
 */
export const BEFORE_SYNC_BRANCH_PREFIX = 'before-sync/'
