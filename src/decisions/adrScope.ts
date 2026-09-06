/**
 * The page's idea of WHERE a decision lives, as one string a tree node and a
 * list can be keyed by: the group, the landscape level, or one application.
 *
 * Deliberately not in `core`: the three lists exist there as two arrays and an
 * `applicationId`, which is all a store needs. The scope key is the page's
 * navigation state, and the labels beside it are screen words.
 */
import type { StringKey } from '../i18n'
import type { Adr, AdrStatus, AdrVerdict } from './adr'

export type ScopeKey = 'group' | 'landscape' | `app:${string}`

export function appScope(applicationId: string): ScopeKey {
  return `app:${applicationId}`
}

/** The application an `app:` scope names; nothing for the other two. */
export function scopeApplicationId(key: ScopeKey): string | undefined {
  return key.startsWith('app:') ? key.slice(4) : undefined
}

/** Which scope a record filed in a project list belongs to. */
export function projectScopeOf(adr: Pick<Adr, 'applicationId'>): ScopeKey {
  return adr.applicationId ? appScope(adr.applicationId) : 'landscape'
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
