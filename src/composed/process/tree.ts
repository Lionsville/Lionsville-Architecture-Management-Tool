// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: the tree of scopes.
 *
 * What is read and written over a tree of scopes: the index, a scope asked of
 * the repositories, the tree changed, and what the tree says about itself.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { CHECK_LABEL, documentFindings, findingsOfOrganisation, identityFindings, organisationAt, organisationFindings } from '../../projects/checks'
export type { Finding } from '../../projects/checks'
export { copyExampleInto } from '../../projects/examples/copy'
export { mayApplyPatch } from '../../projects/mayEdit'
export { carriedOf, changeScope, drawingPicturesOf, nodeAt, nodesOf, readScope, snapshotOf, summaryOf } from '../../projects/scopeAccess'
export { indexScopes } from '../../projects/scopeIndex'
export type { ScopeIndex } from '../../projects/scopeIndex'
export { createScopeAt, describeScopeAt, fileTopicsPlace, moveScopeUnder, removeScopeAt, serveScopeBy } from '../../projects/scopeTree'
export type { TreeScopes } from '../../projects/scopeTree'
export { technologyRows } from '../../projects/technologyRegister'
export { treeRecords } from '../../projects/treeRecords'
