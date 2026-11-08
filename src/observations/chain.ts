// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The analysis as a chain to be led through (ADR-0021, ADR-0026): what waits and
 * in which order, where a record stands, and how much of a large scope's map is
 * drawn when it opens. No words and no React, so the page and its tests read the
 * same answer.
 *
 * **The order is the order it should be picked up in.** Problems and bright spots
 * come before what was only noted down neutrally, and within those the heaviest
 * and the most often seen first: most of a real register has no cause, and a
 * waiting list in the order of its numbers says nothing about where to start.
 *
 * **A map opens readable.** Scaled to fit, a large scope drew every card too small
 * to read. So it opens on the chains that weigh most, with long lists folded and
 * the records with no chain in one pile, and the rest is offered.
 *
 * **What is here comes first.** A scope is read for its own work: a chain that
 * holds a record of this scope stands before one that holds only the scopes
 * below's, however heavy, so what a window keeps back is never this scope's while
 * anything below is drawn.
 */
import { isNoted, liveObservations, isRootCause, toneOf } from './observation'
import type { Cause, Observation, ObservationImpact, ScopeAnalysis } from './observation'
import { absorbedKeys, pictureKey, pictureLinks } from './graph'
import { solutionKey } from './graph'
import { isLive, implementedOn, seenSinceImplemented, solutionPhase, SOLUTION_PHASES } from './solution'
import type { Solution, SolutionPlan } from './solution'

const WEIGHT: Record<ObservationImpact, number> = { critical: 3, major: 2, minor: 1 }

/** Compared as the waiting list reads: a problem or a bright spot first, then by impact, sightings, and the newest. */
export function byPickUp(a: Observation, b: Observation): number {
  const asked = (one: Observation) => (toneOf(one) === 'neutral' ? 0 : 1)
  return asked(b) - asked(a) || WEIGHT[b.impact] - WEIGHT[a.impact] || b.seen - a.seen || b.number - a.number
}

export type SeenSplit = { waiting: Observation[]; explained: Observation[]; noted: Observation[] }

/**
 * The live observations in the three heads of the Seen list: what waits for a
 * why, what has one, and what was read and asked no further. Something explained
 * and also noted is explained: the mark says nobody is waiting on it, which an
 * answer says better.
 */
export function splitSeen(list: readonly Observation[], isExplained: (id: string) => boolean): SeenSplit {
  const split: SeenSplit = { waiting: [], explained: [], noted: [] }
  for (const one of liveObservations(list)) {
    if (isExplained(one.id)) split.explained.push(one)
    else if (isNoted(one)) split.noted.push(one)
    else split.waiting.push(one)
  }
  split.waiting.sort(byPickUp)
  split.explained.sort(byPickUp)
  split.noted.sort(byPickUp)
  return split
}

export type WhySplit = { openEnds: Cause[]; causes: Cause[]; roots: Cause[] }

/** The live causes as the Why list reads them: what is not finished first, the root causes last. */
export function splitWhy(causes: readonly Cause[], isOpenEnd: (cause: Cause) => boolean): WhySplit {
  const split: WhySplit = { openEnds: [], causes: [], roots: [] }
  for (const cause of causes) {
    if (isRootCause(cause)) split.roots.push(cause)
    else if (isOpenEnd(cause)) split.openEnds.push(cause)
    else split.causes.push(cause)
  }
  return split
}

/** How far on a solution is, for the Solve list: a live one furthest on last, so what has just begun is met first. */
export function byProgress(plans: readonly Pick<SolutionPlan, 'id' | 'status'>[]) {
  const place = (one: Solution) => SOLUTION_PHASES.indexOf(solutionPhase(one, plans))
  return (a: Solution, b: Solution) => place(a) - place(b) || b.number - a.number
}

export type ResultSplit = {
  /** Built, and something under it was seen since. Said first: it is the reason to look. */
  seenAgain: { solution: Solution; since: string }[]
  quiet: { solution: Solution; since: string }[]
  /** Adopted, with the plan that builds it not done yet. */
  waiting: Solution[]
}

/** Did it work: what was built and has come back, what was built and has stayed away, and what is still being built. */
export function splitResults(
  solutions: readonly Solution[], analysis: Parameters<typeof seenSinceImplemented>[1], below: Parameters<typeof seenSinceImplemented>[2],
  plans: readonly SolutionPlan[],
): ResultSplit {
  const split: ResultSplit = { seenAgain: [], quiet: [], waiting: [] }
  for (const solution of solutions) {
    if (!isLive(solution)) continue
    const since = implementedOn(solution, plans)
    if (since !== undefined) {
      if (seenSinceImplemented(solution, analysis, below, plans).length > 0) split.seenAgain.push({ solution, since })
      else split.quiet.push({ solution, since })
    } else if (solution.state === 'adopted') split.waiting.push(solution)
  }
  return split
}

/** The four stages, for the stepper on a record. */
export type ChainStep = 'seen' | 'why' | 'solve' | 'results'

export const CHAIN_STEPS: readonly ChainStep[] = ['seen', 'why', 'solve', 'results']

/** Where an observation's chain has got to: seen, explained, something is being done, or it has been built. */
export function standingOf(facts: { explained: boolean; solved: boolean; built: boolean }): ChainStep {
  if (facts.built) return 'results'
  if (facts.solved) return 'solve'
  return facts.explained ? 'why' : 'seen'
}

// --- how much of a map is drawn ----------------------------------------------------------

/** How many chains a map opens on, and how many more a press brings. */
export const CHAINS_FIRST = 6
export const CHAINS_MORE = 10
/** *Show all*, as the number it is kept by: a seam keeps a positive number and reads anything else as nothing kept. */
export const CHAINS_ALL = 1_000_000
/** The observations of a chain drawn before the rest fold into *and 11 more*. */
export const FOLD_FROM = 4

/** A chain: records joined by a line, and what it weighs. */
export type Chain = {
  /** Its first observation's key, or its first record's: what a fold is opened by. */
  readonly id: string
  readonly keys: readonly string[]
  /** Its observations' keys, heaviest first. */
  readonly observations: readonly string[]
  readonly weight: number
  readonly seen: number
}

export type MapRecords = {
  /** Every chain, those holding a record of this scope first, heaviest first within each. */
  readonly chains: readonly Chain[]
  /**
   * The observations no line reaches and nobody noted, this scope's first, in
   * pick-up order: what waits for a why, and one pile on the map. A noted one
   * wants no cause, so it is neither on the pile nor counted as waiting.
   */
  readonly loose: readonly string[]
  /**
   * How many were seen in the scopes in view, by the one rule every count of
   * observations reads (`seenBelow`): live in its own scope's list — not
   * archived, merged or moved — and not taken in by one here. `here` of them
   * in this scope.
   */
  readonly seen: { readonly here: number; readonly below: number }
}

/**
 * How many observations the scopes below saw, by the rule `chainsOf` counts
 * the scopes in view by: each scope's live ones. What a home and a tree say.
 */
export function seenBelow(below: readonly Pick<ScopeAnalysis, 'observations'>[]): number {
  return below.reduce((sum, one) => sum + liveObservations(one.observations).length, 0)
}

/**
 * The scopes in view as chains. Every live record is in one chain or, where it
 * is an observation nothing explains, on the pile; a cause or a solution with no
 * line is a chain of its own, since it is what somebody wrote down to work on.
 */
export function chainsOf(scopes: readonly ScopeAnalysis[], here: string): MapRecords {
  const gone = absorbedKeys(scopes, here)
  const observations = new Map<string, Observation>()
  const others: string[] = []
  const seen = { here: 0, below: 0 }
  for (const { scope, observations: held, causes, solutions } of scopes) {
    const live = new Set(liveObservations(held))
    for (const one of held) {
      const key = pictureKey(here, scope, one.id)
      if (gone.has(key) || !live.has(one)) continue
      observations.set(key, one)
      if (scope === here) seen.here += 1
      else seen.below += 1
    }
    for (const one of causes) {
      const key = pictureKey(here, scope, one.id)
      if (!gone.has(key)) others.push(key)
    }
    for (const one of solutions) if (isLive(one)) others.push(pictureKey(here, scope, solutionKey(one.id)))
  }
  const known = new Set([...observations.keys(), ...others])
  const parent = new Map([...known].map((key) => [key, key]))
  const find = (key: string): string => {
    let at = key
    while (parent.get(at) !== at) at = parent.get(at) as string
    return at
  }
  const joined = new Set<string>()
  for (const link of pictureLinks(scopes, here)) {
    if (link.kind === 'tests' || !known.has(link.from) || !known.has(link.to)) continue
    joined.add(link.from)
    joined.add(link.to)
    parent.set(find(link.from), find(link.to))
  }
  const groups = new Map<string, string[]>()
  for (const key of known) {
    if (observations.has(key) && !joined.has(key)) continue
    const root = find(key)
    groups.set(root, [...(groups.get(root) ?? []), key])
  }
  const isHere = (key: string) => scopeOfKey(key, here) === here
  const heaviestFirst = (a: string, b: string) => Number(isHere(b)) - Number(isHere(a)) || byPickUp(observations.get(a) as Observation, observations.get(b) as Observation)
  const chains = [...groups.values()].map((keys): Chain => {
    const seen = keys.filter((key) => observations.has(key)).sort(heaviestFirst)
    return {
      id: seen[0] ?? keys[0], keys, observations: seen,
      weight: Math.max(0, ...seen.map((key) => WEIGHT[(observations.get(key) as Observation).impact])),
      seen: seen.reduce((sum, key) => sum + (observations.get(key) as Observation).seen, 0),
    }
  }).sort((a, b) => Number(b.keys.some(isHere)) - Number(a.keys.some(isHere)) || b.weight - a.weight || b.seen - a.seen || (a.id < b.id ? -1 : 1))
  const loose = [...observations.keys()].filter((key) => !joined.has(key) && !isNoted(observations.get(key) as Observation)).sort(heaviestFirst)
  return { chains, loose, seen }
}

/** A card standing for records not drawn: a chain's *and 11 more*, or the pile of records with no chain. */
export type MoreCard = {
  readonly key: string
  readonly kind: 'fold' | 'pile'
  readonly count: number
  /** The scope whose lane it stands in. */
  readonly scope: string
  /** What its line runs to. */
  readonly to: readonly string[]
  /** The chain a fold opens. */
  readonly chain?: string
}

export type MapWindow = {
  /** The records drawn. */
  readonly drawn: ReadonlySet<string>
  /** Their order down the first lane, so a chain's cards stand together. */
  readonly order: ReadonlyMap<string, number>
  readonly cards: readonly MoreCard[]
  readonly shownChains: number
  readonly totalChains: number
}

export type MapChoice = {
  /** How many chains; `all` draws every record, the way it always was. */
  readonly limit: number | 'all'
  /** The chains whose long lists were opened. */
  readonly opened: ReadonlySet<string>
}

/** The scope a key names: `scope#id` for a record below, the bare id for one here. */
function scopeOfKey(key: string, here: string): string {
  const at = key.lastIndexOf('#')
  return at < 0 ? here : key.slice(0, at)
}

/**
 * What a map draws for a choice. With a filter on, `visible` narrows it first, so
 * a filter that keeps three records draws those three however light they are:
 * a record somebody searched for is not left behind *Show 10 more*.
 */
export function mapWindow(
  records: MapRecords, here: string, choice: MapChoice, links: readonly { from: string; to: string }[], visible?: ReadonlySet<string>,
): MapWindow {
  const keep = (key: string) => visible === undefined || visible.has(key)
  const chains = records.chains
    .map((chain) => ({ ...chain, keys: chain.keys.filter(keep), observations: chain.observations.filter(keep) }))
    .filter((chain) => chain.keys.length > 0)
  const loose = records.loose.filter(keep)
  const all = choice.limit === 'all' || visible !== undefined
  const shown = all ? chains : chains.slice(0, choice.limit as number)
  const drawn = new Set<string>()
  const order = new Map<string, number>()
  const cards: MoreCard[] = []
  let place = 0
  for (const chain of shown) {
    const open = all || choice.opened.has(chain.id) || chain.observations.length <= FOLD_FROM + 1
    const folded = open ? [] : chain.observations.slice(FOLD_FROM)
    const hidden = new Set(folded)
    for (const key of chain.keys) if (!hidden.has(key)) drawn.add(key)
    for (const key of chain.observations) if (!hidden.has(key)) order.set(key, place++)
    if (folded.length > 0) {
      const key = `more:${chain.id}`
      const to = links.filter((link) => hidden.has(link.from)).map((link) => link.to).filter((one, index, list) => list.indexOf(one) === index)
      cards.push({ key, kind: 'fold', count: folded.length, scope: scopeOfKey(chain.id, here), to, chain: chain.id })
      order.set(key, place++)
    }
  }
  if (all) for (const key of loose) { drawn.add(key); order.set(key, place++) }
  else if (loose.length > 0) {
    cards.push({ key: 'more:pile', kind: 'pile', count: loose.length, scope: here, to: [] })
    order.set('more:pile', place)
  }
  return { drawn, order, cards, shownChains: shown.length, totalChains: chains.length }
}
