// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: a scope's address.
 *
 * The path a scope is addressed by, and the arithmetic over paths. The name
 * most often imported and the lightest, so it is apart from everything a
 * scope holds: what names an address loads nothing else.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { ROOT_SCOPE, ancestorScopes, isSafeScopePath, isWithinScope, parentScope, scopePathLabel, scopeSegments } from '../../projects/scopePath'
export type { ScopePath } from '../../projects/scopePath'
