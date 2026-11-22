// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: scopes.
 *
 * A scope as a document: what it is, what it says about itself, its settings,
 * its revision, and the small rules over one.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { labelSlug } from '../../projects/label'
export { standInOf } from '../../projects/library'
export { isLinkList, isSafeLinkUrl } from '../../projects/links'
export { blank } from '../../projects/organisationWork'
export { commentAsIndexed } from '../../projects/readdress'
export { fingerprint } from '../../projects/revision'
export { bareScope, flattenScopes, isScopeKind } from '../../projects/scope'
export type { ScopeKind, ScopeSnapshot, ScopeSummary } from '../../projects/scope'
export { HOLDS_NOTHING, holdsOf, readWhole } from '../../projects/scopeHolds'
export type { ScopeHolds } from '../../projects/scopeHolds'
export { typedByUnitType } from '../../projects/scopeType'
export { patchSettings } from '../../projects/settings'
export type { Settings, SettingsPatch } from '../../projects/settings'
export { summariseStep } from '../../projects/stepSummary'
export { bytesFromText, stableJson, textFromBytes } from '../../projects/text'
export { TOPICS_PLACE, topicFiledUnder } from '../../projects/topics'
