// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: scopes.
 *
 * A scope as a document and a tree of them: its address, its state and the
 * steps that change it, the index over the tree, and what the tree says about
 * itself.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { CHECK_LABEL, documentFindings, findingsOfOrganisation, identityFindings, organisationAt, organisationFindings } from '../../projects/checks'
export type { Finding } from '../../projects/checks'
export { copyExampleInto } from '../../projects/examples/copy'
export { labelSlug } from '../../projects/label'
export { standInOf } from '../../projects/library'
export { isLinkList, isSafeLinkUrl } from '../../projects/links'
export { mayApplyPatch } from '../../projects/mayEdit'
export { blank } from '../../projects/organisationWork'
export { commentAsIndexed } from '../../projects/readdress'
export { fingerprint } from '../../projects/revision'
export { bareScope, flattenScopes, isScopeKind } from '../../projects/scope'
export type { ScopeKind, ScopeSnapshot, ScopeSummary } from '../../projects/scope'
export { carriedOf, changeScope, drawingPicturesOf, nodeAt, nodesOf, readScope, snapshotOf, summaryOf } from '../../projects/scopeAccess'
export { HOLDS_NOTHING, holdsOf, readWhole } from '../../projects/scopeHolds'
export type { ScopeHolds } from '../../projects/scopeHolds'
export { indexScopes } from '../../projects/scopeIndex'
export type { ScopeIndex } from '../../projects/scopeIndex'
export { ROOT_SCOPE, ancestorScopes, isSafeScopePath, isWithinScope, parentScope, scopePathLabel, scopeSegments } from '../../projects/scopePath'
export type { ScopePath } from '../../projects/scopePath'
export { STEP_ELSEWHERE, applySteps, emptyContent, partlyReadRefusal, putBackOf } from '../../projects/scopeState'
export type {
  DescribeCommand, ImageCommand, ReplaceCommand, Revision, ScopeAddress, ScopeCommand, ScopeContent, ScopeDescription, ScopeId, ScopeRefusal,
  ScopeState, ScopeStep,
} from '../../projects/scopeState'
export { createScopeAt, describeScopeAt, fileTopicsPlace, moveScopeUnder, removeScopeAt, serveScopeBy } from '../../projects/scopeTree'
export type { TreeScopes } from '../../projects/scopeTree'
export { typedByUnitType } from '../../projects/scopeType'
export { patchSettings } from '../../projects/settings'
export type { Settings, SettingsPatch } from '../../projects/settings'
export { summariseStep } from '../../projects/stepSummary'
export { technologyRows } from '../../projects/technologyRegister'
export { bytesFromText, stableJson, textFromBytes } from '../../projects/text'
export { TOPICS_PLACE, topicFiledUnder } from '../../projects/topics'
export { treeRecords } from '../../projects/treeRecords'
