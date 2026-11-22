// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: a scope's state.
 *
 * A scope's address, identity, revision and state, the step, and the one
 * writer every repository shares (ADR-0031 §1). Apart from the document,
 * because the writer reaches the reducer.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { STEP_ELSEWHERE, applySteps, emptyContent, partlyReadRefusal, putBackOf } from '../../projects/scopeState'
export type {
  DescribeCommand, ImageCommand, ReplaceCommand, Revision, ScopeAddress, ScopeCommand, ScopeContent, ScopeDescription, ScopeId, ScopeRefusal,
  ScopeState, ScopeStep,
} from '../../projects/scopeState'
