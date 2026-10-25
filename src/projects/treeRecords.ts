// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The tree's principles, topics and building blocks folded for a reader with
 * no screen (`model/treeRecords.ts`): the same index and the same topic rules
 * the pages read, so `principles.list` in force at a scope is what its
 * Principles page lists.
 */
import type { TreeRecords, TreeTopic } from '../model/treeRecords'
import type { ScopeIndex } from './scopeIndex'
import { ancestorScopes, parentScope } from './scopePath'
import type { ScopePath } from './scopePath'
import { relevantPlaces, topicsInForce, topicsOf } from './topics'
import type { TopicNode } from './topics'

/** A scope as the fold needs it: its path, its name and its topic links. */
export type RecordScope = TopicNode & { readonly name: string }

export function treeRecords(index: Pick<ScopeIndex, 'principleScopes' | 'principlesAt' | 'buildingBlocks' | 'evaluations'>, scopes: readonly RecordScope[], day: string): TreeRecords {
  const own = (path: ScopePath) => index.principlesAt(path)
  const live = (path: ScopePath) => own(path).principles.filter((one) => one.mergedInto === undefined)
  return {
    principleScopes: () => index.principleScopes(),
    principlesAt: own,
    inForce: (path) => [
      ...live(path).map((principle) => ({ scope: path, via: 'here' as const, principle })),
      ...ancestorScopes(path).flatMap((above) => live(above).map((principle) => ({ scope: above, via: 'above' as const, principle }))),
      ...topicsInForce(path, scopes, day).filter((topic) => topic !== path)
        .flatMap((topic) => live(topic).map((principle) => ({ scope: topic, via: 'topic' as const, principle }))),
    ],
    topics: () => {
      const held = topicsOf(scopes)
      const paths = new Set(held.map((one) => one.path))
      const named = new Map(scopes.map((one) => [one.path, one.name]))
      return held.map((one): TreeTopic => {
        const parent = parentScope(one.path)
        return {
          path: one.path, name: named.get(one.path) ?? one.path,
          ...(parent !== undefined && paths.has(parent) ? { parent } : {}),
          links: one.relevantTo ?? [],
          relevantTo: relevantPlaces(one.path, scopes, day),
        }
      })
    },
    blocks: () => index.buildingBlocks(),
    evaluations: () => index.evaluations(),
  }
}
