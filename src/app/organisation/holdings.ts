// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What each scope holds, here and below: the one number a row of the tree has
 * room for, what *With work* keeps, what a hover names, and where the nearest
 * work is from a scope with none.
 *
 * Off what the shell already read: the listing's count of views and the
 * index's records per scope. No load of its own (ADR-0004), and pure, so a row
 * and a home cannot come to disagree about the same scope. Most scopes hold
 * nothing and that is ordinary; a scope no index has reached counts its views
 * alone, and never reads as more than it is.
 */
import { liveCauses, liveObservations } from '../../observations/observation'
import { flattenScopes } from '../../projects/scope'
import type { ScopeModel, ScopeSummary } from '../../projects/scope'
import { parentScope, ROOT_SCOPE } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'

/** One scope's own, by what it is. Every count is a thing a person kept: a generated row is not one. */
export type Held = {
  readonly views: number
  readonly observations: number
  readonly causes: number
  readonly solutions: number
  readonly decisions: number
  readonly plans: number
  readonly principles: number
}

const NOTHING: Held = { views: 0, observations: 0, causes: 0, solutions: 0, decisions: 0, plans: 0, principles: 0 }

const totalOf = (held: Held): number => Object.values(held).reduce((sum, one) => sum + one, 0)

/**
 * The one number a row says: the views and the records worked on there. The
 * principles are left out of it, as guidance rather than work — kept at the
 * organisation, fifty of them made its row look heavier than everything
 * under it — and are still in the breakdown and in *With work*.
 */
const workOf = (held: Held): number => totalOf(held) - held.principles

export type Holdings = {
  /** What the scope keeps itself. */
  own: (path: ScopePath) => Held
  /** What it and everything under it keep. */
  all: (path: ScopePath) => Held
  /** {@link all}, as the one number. */
  count: (path: ScopePath) => number
  /** What a row says it holds: {@link all} without the principles (`workOf`). */
  work: (path: ScopePath) => number
  /** Every scope with something at or below it: the tree's *With work*. */
  withWork: ReadonlySet<ScopePath>
}

function heldBy(views: number, model: ScopeModel['model'] | undefined): Held {
  if (!model) return { ...NOTHING, views }
  return {
    views,
    observations: liveObservations(model.observations ?? []).length,
    causes: liveCauses(model.causes ?? []).length,
    solutions: (model.solutions ?? []).length,
    decisions: model.decisionCount ?? 0,
    plans: (model.transitions ?? []).length,
    principles: (model.principles ?? []).filter((one) => one.mergedInto === undefined && one.status !== 'retired').length,
  }
}

function added(a: Held, b: Held): Held {
  return {
    views: a.views + b.views, observations: a.observations + b.observations, causes: a.causes + b.causes, solutions: a.solutions + b.solutions,
    decisions: a.decisions + b.decisions, plans: a.plans + b.plans, principles: a.principles + b.principles,
  }
}

export function holdingsOf(tree: ScopeSummary, models: readonly ScopeModel[]): Holdings {
  const modelAt = new Map(models.map((one) => [one.path, one.model]))
  const own = new Map<ScopePath, Held>()
  const all = new Map<ScopePath, Held>()
  const walk = (scope: ScopeSummary): Held => {
    const here = heldBy(scope.diagrams, modelAt.get(scope.path))
    own.set(scope.path, here)
    // A scope only its reader sees keeps its own counts and adds nothing to the organisation's.
    const whole = scope.children.reduce((sum, child) => {
      const theirs = walk(child)
      return child.personal ? sum : added(sum, theirs)
    }, here)
    all.set(scope.path, whole)
    return whole
  }
  walk(tree)
  const allAt = (path: ScopePath) => all.get(path) ?? NOTHING
  return {
    own: (path) => own.get(path) ?? NOTHING,
    all: allAt,
    count: (path) => totalOf(allAt(path)),
    work: (path) => workOf(allAt(path)),
    withWork: new Set([...all].filter(([, held]) => totalOf(held) > 0).map(([path]) => path)),
  }
}

export type NearbyWork = {
  readonly path: ScopePath
  readonly name: string
  /** Where it stands from the scope asked about. */
  readonly stands: 'below' | 'beside' | 'above'
  readonly held: Held
}

/**
 * Where the work nearest an empty scope is: under it first, then beside it,
 * then up the tree, nearest first. A scope keeping something of its own is
 * named, not a parent that merely holds it further down, so the press lands
 * somewhere with something on it.
 */
export function nearestWork(tree: ScopeSummary, at: ScopePath, holdings: Holdings, most = 3): NearbyWork[] {
  const nodes = flattenScopes(tree)
  const hasOwn = (path: ScopePath) => totalOf(holdings.own(path)) > 0
  const row = (scope: ScopeSummary, stands: NearbyWork['stands']): NearbyWork => ({ path: scope.path, name: scope.name, stands, held: holdings.own(scope.path) })
  const home = nodes.find((one) => one.path === at)
  if (!home) return []
  const below = flattenScopes(home).slice(1).filter((one) => hasOwn(one.path)).map((one) => row(one, 'below'))
  const up: NearbyWork[] = []
  const beside: NearbyWork[] = []
  for (let path: ScopePath | undefined = parentScope(at); path !== undefined; path = path === ROOT_SCOPE ? undefined : parentScope(path)) {
    const above = nodes.find((one) => one.path === path)
    if (!above) continue
    for (const sibling of above.children) {
      if (sibling.path === at || at.startsWith(`${sibling.path}/`)) continue
      beside.push(...flattenScopes(sibling).filter((one) => hasOwn(one.path)).map((one) => row(one, 'beside')))
    }
    if (hasOwn(above.path)) up.push(row(above, 'above'))
  }
  return [...below, ...beside, ...up].slice(0, most)
}
