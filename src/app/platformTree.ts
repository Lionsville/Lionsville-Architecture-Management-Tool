// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The platform tree off the index (ADR-0013, ADR-0014, ADR-0012 §3): what a
 * platform is filed under, what it is, whether it is the organisation's, and
 * the day it is gone — all facts of the scope that defines it, which a
 * stand-in here does not carry.
 *
 * Said once for the two readers that need it: the open scope's workspace,
 * and a scope's home, whose roadmap card reads the same findings the roadmap
 * page does and would otherwise name a different first one.
 */
import type { PlatformTree } from '../model/hosting'
import type { ScopeIndex } from '../projects/scopeIndex'

export function platformTreeOf(index: Pick<ScopeIndex, 'lookup'>): PlatformTree {
  return {
    parentOf: (platformId) => index.lookup(platformId)?.parentId,
    archetypeOf: (platformId) => index.lookup(platformId)?.platformArchetype,
    outsideOf: (platformId) => index.lookup(platformId)?.outside,
    retiredOf: (id) => index.lookup(id)?.retired,
  }
}
