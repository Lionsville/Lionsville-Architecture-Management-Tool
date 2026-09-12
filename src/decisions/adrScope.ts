/**
 * The page's idea of WHERE a decision lives, as one string a tree node and a
 * list can be keyed by: this scope, one subject in it, or a scope above.
 *
 * **One list, not three** (ADR-0012 §7). A record is about any element the
 * scope knows — an application, a capability, a journey step — or about the
 * scope itself; and a scope ABOVE this one has records of its own, read up the
 * tree and read-only here, because a record is edited where it lives. What
 * used to be `group | landscape | app:<id>` is therefore
 * `landscape | subject:<id> | from:<path>`, and the one that changed meaning
 * is the last: it is a scope's path rather than "the group", and there can be
 * several.
 *
 * Deliberately not in `model/`: the lists exist there as one array and a
 * `subjectId`, which is all a store needs. The scope key is the page's
 * navigation state, and the labels beside it are screen words.
 */
import type { StringKey } from '../i18n'
import type { Adr, AdrStatus, AdrVerdict } from './adr'

export type ScopeKey = 'landscape' | `subject:${string}` | `from:${string}`

/**
 * One scope above this one, and what it holds (ADR-0012 §7).
 *
 * A plain `string` path rather than a `ScopePath`: `decisions` may not import
 * `projects`, and what a path IS belongs there. Nearest ancestor first, which
 * is the order the tree draws them in.
 */
export type AncestorRecords = {
  path: string
  /** What that scope is called, for the section heading. */
  name: string
  decisions: readonly Adr[]
}

export function subjectScope(subjectId: string): ScopeKey {
  return `subject:${subjectId}`
}

/** The element a `subject:` scope names; nothing for the others. */
export function scopeSubjectId(key: ScopeKey): string | undefined {
  return key.startsWith('subject:') ? key.slice('subject:'.length) : undefined
}

export function fromScope(path: string): ScopeKey {
  return `from:${path}`
}

/** The scope a `from:` key names — the empty string is the organisation. */
export function scopeFromPath(key: ScopeKey): string | undefined {
  return key.startsWith('from:') ? key.slice('from:'.length) : undefined
}

/** Which scope a record filed in THIS scope's list belongs to. */
export function projectScopeOf(adr: Pick<Adr, 'subjectId'>): ScopeKey {
  return adr.subjectId ? subjectScope(adr.subjectId) : 'landscape'
}

/**
 * What each scope is called. Published because the global search lists decisions
 * too and must not name this module's string keys to label them.
 */
export const SCOPE_LABEL = {
  group: 'adr.scopeGroup',
  landscape: 'adr.scopeLandscape',
  application: 'adr.scopeApplications',
} as const satisfies Record<string, StringKey>

export const STATUS_LABEL: Record<AdrStatus, StringKey> = {
  proposed: 'adr.statusProposed',
  reviewing: 'adr.statusReviewing',
  accepted: 'adr.statusAccepted',
  rejected: 'adr.statusRejected',
  superseded: 'adr.statusSuperseded',
}

/** MUI chip colours per status: the two end states stand out, the rest are quiet. */
export const STATUS_COLOR: Record<AdrStatus, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  proposed: 'default',
  reviewing: 'info',
  accepted: 'success',
  rejected: 'error',
  superseded: 'warning',
}

export const VERDICT_LABEL: Record<AdrVerdict | 'pending', StringKey> = {
  pending: 'adr.verdictPending',
  approved: 'adr.verdictApproved',
  rejected: 'adr.verdictRejected',
}
