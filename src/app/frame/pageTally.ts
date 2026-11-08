// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The tree beside a record page: how many of that page's records each scope
 * keeps itself, so a person sees at once which scopes have decisions, or
 * observations, and goes there without leaving the page.
 *
 * Each count is the scope's own, never what is under it: the page already
 * shows the scopes below where it reads them (Observations' *below*), and a
 * rolled-up number on every row would say the same records once per scope
 * above them. Each is counted by the rule the page itself counts by, off what
 * the shell already read for the tree (`holdings`, the index): one fold per
 * read of the tree, no read of a scope for it.
 */
import type { Page } from '../../agent/screen'
import type { StringKey } from '../../i18n'
import { flattenScopes } from '../../projects/scope'
import type { ScopeModel, ScopeSummary } from '../../projects/scope'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import type { Holdings } from '../organisation/holdings'

/** The pages whose records are kept per scope, and so are counted on the tree beside them. */
export const TALLIED = ['documentation', 'decisions', 'observations', 'roadmap', 'principles', 'blocks'] as const
export type Tallied = (typeof TALLIED)[number]

/**
 * Which tally a page shows, if any. An element's record is the documentation
 * page on one element, and a building block's page is one row of the blocks.
 */
export function talliedPage(page: Page | undefined): Tallied | undefined {
  if (page === 'document') return 'documentation'
  return (TALLIED as readonly string[]).includes(page ?? '') ? page as Tallied : undefined
}

/**
 * Whether a scope can hold the page, so a row of the tree beside it keeps the
 * page there. Documentation opens on an element and is refused where the scope
 * keeps none, stand-ins included (`useWorkspaceRequests`), which left the scope
 * open on its empty place; the rest are lists, and an empty list is still the
 * page. A scope not read yet is not known to hold anything.
 */
export function holdsPage(kind: Tallied, path: ScopePath, models: readonly ScopeModel[]): boolean {
  if (kind !== 'documentation') return true
  return (models.find((one) => one.path === path)?.model.elements.length ?? 0) > 0
}

/** What the tree says of a tally: the column's head, its *With …* tab, and one count in words. */
export const TALLY_WORDS: Record<Tallied, { head: StringKey; with: StringKey; one: StringKey; other: StringKey }> = {
  documentation: { head: 'frame.tallyElements', with: 'frame.tallyWithElements', one: 'frame.tallyElementOne', other: 'frame.tallyElementOther' },
  decisions: { head: 'frame.tallyDecisions', with: 'frame.tallyWithDecisions', one: 'org.heldDecisionOne', other: 'org.heldDecisionOther' },
  observations: { head: 'frame.tallyObservations', with: 'frame.tallyWithObservations', one: 'org.heldObservationOne', other: 'org.heldObservationOther' },
  roadmap: { head: 'frame.tallyPlans', with: 'frame.tallyWithPlans', one: 'org.heldPlanOne', other: 'org.heldPlanOther' },
  principles: { head: 'frame.tallyPrinciples', with: 'frame.tallyWithPrinciples', one: 'org.heldPrincipleOne', other: 'org.heldPrincipleOther' },
  blocks: { head: 'frame.tallyBlocks', with: 'frame.tallyWithBlocks', one: 'frame.tallyBlockOne', other: 'frame.tallyBlockOther' },
}

export type Tally = {
  readonly kind: Tallied
  /** How many the scope keeps itself. */
  readonly own: (path: ScopePath) => number
  /** Every scope keeping one, or with one kept under it: what *With …* keeps. Never one only its reader sees. */
  readonly within: ReadonlySet<ScopePath>
}

/**
 * Each scope's own records of a page, by the page's rule:
 *
 * - documentation: the elements the scope keeps — not a stand-in of another
 *   scope's, whose page is its owner's — which is what the page lists and
 *   filters when no view is open (`documentedElements`);
 * - decisions: the records in the scope's decisions folder, an element's
 *   included, as the page lists them (`decisionCount`);
 * - observations: the live ones, not archived, merged or moved (`liveObservations`,
 *   the one rule of `chain.ts`);
 * - plans: every plan the scope keeps, as the roadmap's rows;
 * - principles: the standing ones, not retired and not taken into another (`principleCounts`);
 * - building blocks: the blocks the scope keeps, as the register groups them by scope.
 */
export function tallyOf(kind: Tallied, tree: ScopeSummary, models: readonly ScopeModel[], holdings: Holdings, index: ScopeIndex): Tally {
  const counts = new Map<ScopePath, number>()
  if (kind === 'documentation') {
    for (const one of models) counts.set(one.path, one.model.elements.reduce((sum, element) => (element.ref === undefined ? sum + 1 : sum), 0))
  } else if (kind === 'blocks') {
    for (const kept of index.buildingBlocks()) counts.set(kept.scope, (counts.get(kept.scope) ?? 0) + 1)
  } else {
    const field = kind === 'roadmap' ? 'plans' : kind
    for (const scope of flattenScopes(tree)) counts.set(scope.path, holdings.own(scope.path)[field])
  }
  const within = new Set<ScopePath>()
  const walk = (scope: ScopeSummary): boolean => {
    // Every child is walked, so a branch past the first with records is marked too.
    const below = scope.children.map((child) => walk(child) && !child.personal).some(Boolean)
    const has = below || (counts.get(scope.path) ?? 0) > 0
    if (has && !holdings.personal.has(scope.path)) within.add(scope.path)
    return has
  }
  walk(tree)
  return { kind, own: (path) => counts.get(path) ?? 0, within }
}
