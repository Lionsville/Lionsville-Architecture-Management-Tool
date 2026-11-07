// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What each kind of scope is called, and what a scope's badge says: read on every
 * home and in the tree, so it is not in the settings page's script.
 */
import type { StringKey, Translate } from '../../i18n'
import type { ScopeKind } from '../../projects/scope'
import type { ScopeTyped } from '../../projects/scopeType'

/**
 * What each kind is called. A word for this page to offer and never a branch
 * ({@link ScopeKind}) — the screen reads it, nothing switches on it.
 */
export const SCOPE_KIND_LABEL = {
  organisation: 'org.kindOrganisation',
  domain: 'org.kindDomain',
  programme: 'org.kindProgramme',
  team: 'org.kindTeam',
  landscape: 'org.kindLandscape',
  topic: 'org.kindTopic',
} as const satisfies Record<ScopeKind, StringKey>

/**
 * The same words, counted (`countScopeKinds`), so a home's line and its
 * tree's badges cannot come to call one scope two things. A scope that says
 * nothing about itself is counted as a scope.
 */
export const SCOPE_KIND_COUNT = {
  organisation: { one: 'org.organisationsOne', other: 'org.organisationsOther' },
  domain: { one: 'org.domainsOne', other: 'org.domainsOther' },
  programme: { one: 'org.programmesOne', other: 'org.programmesOther' },
  team: { one: 'org.teamsOne', other: 'org.teamsOther' },
  landscape: { one: 'org.landscapeScopesOne', other: 'org.landscapeScopesOther' },
  topic: { one: 'org.topicsOne', other: 'org.topicsOther' },
  unsaid: { one: 'org.scopesOne', other: 'org.scopesOther' },
} as const satisfies Record<ScopeKind | 'unsaid', { one: StringKey; other: StringKey }>

/**
 * What a scope's badge says (ADR-0036, amended 17 October 2026): its unit
 * type's name where it says one and the operating model holds it, *Unknown
 * type* where it says one the model does not, else its kind's word.
 */
export function scopeTypeLabel(scope: ScopeTyped, typeName: ((unitTypeId: string) => string | undefined) | undefined, s: Translate): string {
  if (scope.unitTypeId !== undefined) return typeName?.(scope.unitTypeId) ?? s('org.typeGoneBadge')
  return scope.kind ? s(SCOPE_KIND_LABEL[scope.kind]) : ''
}
