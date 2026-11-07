// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the Conway map comes to, for a person reading it (ADR-0036 §7, as
 * amended for the verdict and the pair grid): one sum that reconciles, how each
 * two units stand once the marks as intended are held against them, and what
 * can be said of one pair, one unit and one application.
 *
 * **One sum.** Every interface that is not inside one unit is either judged,
 * because both ends have an owner, or not, because one end has none. A person
 * who adds the sentence up gets the total, which is what the old header, the
 * table and the findings each failed at on their own.
 *
 * **Coverage comes first.** With half the applications unowned the map cannot
 * answer, whatever it finds in the rest: `lowCoverage` is that state, said
 * before anything about pairs.
 *
 * Pure, with no words, over `conwayMap`'s answer and the findings still shown.
 */
import type { ConwayApplication, ConwayFinding, ConwayInteraction, ConwayLine, ConwayMap, ConwayPair } from './conway'
import type { ElementId } from './types'
import type { UnitLike } from './units'

/** The two ends of a pair as an address holds them: an end nobody owns is empty. */
export function pairId(a: ElementId | undefined, b: ElementId | undefined): string {
  return `${a ?? ''},${b ?? ''}`
}

/** What {@link pairId} wrote, or nothing for what it did not. */
export function readPairId(said: string | undefined): { a?: ElementId; b?: ElementId } | undefined {
  if (!said) return undefined
  const comma = said.indexOf(',')
  if (comma < 0) return undefined
  const [a, b] = [said.slice(0, comma), said.slice(comma + 1)]
  if (a === '' && b === '') return undefined
  return { ...(a !== '' ? { a } : {}), ...(b !== '' ? { b } : {}) }
}

/**
 * How two units stand: something to look at, in agreement, said with no system
 * between them, not to be judged for want of an owner, or looked at and marked
 * as intended.
 */
export type PairStanding = 'attention' | 'agree' | 'unused' | 'unowned' | 'accepted'

export type PairReading = {
  a?: ElementId
  b?: ElementId
  standing: PairStanding
  /** Every interface between the two. */
  lines: ConwayLine[]
  /** Those with nothing said and no mark as intended: what the cell counts. */
  open: ConwayLine[]
  interactions: ConwayInteraction[]
}

/** The interfaces between two columns, either way round. */
function between(map: Pick<ConwayMap, 'lines'>, pair: Pick<ConwayPair, 'a' | 'b'>): ConwayLine[] {
  return map.lines.filter((line) => line.from !== line.to
    && ((line.from === pair.a && line.to === pair.b) || (line.from === pair.b && line.to === pair.a)))
}

/** Each cell of the map, read against the findings still shown: a marked one no longer asks for anything. */
export function conwayPairs(map: Pick<ConwayMap, 'lines' | 'pairs'>, shown: readonly ConwayFinding[]): PairReading[] {
  const asking = new Set(shown.flatMap((one) => (one.kind === 'undeclared' ? [one.flow.id] : [])))
  const unused = new Set(shown.flatMap((one) => (one.kind === 'unused' ? [one.interaction.id] : [])))
  return map.pairs.map((pair) => {
    const lines = between(map, pair)
    const open = lines.filter((line) => line.status === 'undeclared' && asking.has(line.flow.id))
    return {
      ...(pair.a !== undefined ? { a: pair.a } : {}), ...(pair.b !== undefined ? { b: pair.b } : {}),
      standing: standingOf(pair, open, unused), lines, open, interactions: pair.interactions,
    }
  })
}

function standingOf(pair: ConwayPair, open: readonly ConwayLine[], unused: ReadonlySet<string>): PairStanding {
  switch (pair.state) {
    case 'undeclared': return open.length > 0 ? 'attention' : 'accepted'
    case 'unused': return pair.interactions.some((row) => unused.has(row.id)) ? 'unused' : 'accepted'
    case 'unowned': return 'unowned'
    case 'declared': return 'agree'
  }
}

export type ConwaySum = {
  applications: number
  /** Applications with no unit for an owner: nobody's, or a name that is not a unit. */
  noOwner: number
  /** Interfaces that are not inside one unit: `judged` and `unjudged` add up to this. */
  interfaces: number
  judged: number
  unjudged: number
  /** Of `unjudged`, those with no owner at either end, which cross nothing known. */
  bothEnds: number
  /** Of `judged`, those with nothing said and no mark as intended. */
  judgedUnsaid: number
  attention: number
  agree: number
  unused: number
  accepted: number
  /** Half the applications or more have no owner: the map cannot answer yet. */
  lowCoverage: boolean
}

/** The one sum the verdict says. */
export function conwaySum(map: Pick<ConwayMap, 'groups' | 'lines'>, pairs: readonly PairReading[]): ConwaySum {
  const applications = map.groups.reduce((sum, group) => sum + group.applications.length, 0)
  const noOwner = map.groups.find((group) => group.unitId === undefined)?.applications.length ?? 0
  const crossing = map.lines.filter((line) => line.status !== 'inside')
  const unjudged = crossing.filter((line) => line.status === 'unowned')
  const count = (standing: PairStanding) => pairs.filter((pair) => pair.standing === standing).length
  return {
    applications, noOwner,
    interfaces: crossing.length, judged: crossing.length - unjudged.length, unjudged: unjudged.length,
    bothEnds: unjudged.filter((line) => line.from === undefined && line.to === undefined).length,
    judgedUnsaid: pairs.reduce((sum, pair) => sum + pair.open.length, 0),
    attention: count('attention'),
    agree: pairs.filter((pair) => pair.standing === 'agree' && pair.lines.length > 0).length,
    unused: count('unused'), accepted: count('accepted'),
    lowCoverage: applications > 0 && noOwner * 2 >= applications,
  }
}

/** Each application on the map, with the unit that owns it where it has a column of its own or sits under one. */
function ownersOf(map: Pick<ConwayMap, 'groups'>): ReadonlyMap<ElementId, ElementId> {
  const owners = new Map<ElementId, ElementId>()
  for (const group of map.groups) {
    if (group.unitId === undefined) continue
    for (const app of group.applications) if (app.partyId !== undefined) owners.set(app.id, app.partyId)
  }
  return owners
}

/**
 * The interfaces of a pair that may be finer than the columns: between the two
 * columns, or, under a grouping, between the two owning units beneath them.
 */
export function linesOfPair(map: Pick<ConwayMap, 'groups' | 'lines'>, a: ElementId | undefined, b: ElementId | undefined): ConwayLine[] {
  const columns = between(map, { ...(a !== undefined ? { a } : {}), ...(b !== undefined ? { b } : {}) })
  if (columns.length > 0 || a === undefined || b === undefined) return columns
  const owners = ownersOf(map)
  return map.lines.filter((line) => {
    const [from, to] = [owners.get(line.flow.sourceId), owners.get(line.flow.targetId)]
    return (from === a && to === b) || (from === b && to === a)
  })
}

export type UnderPair = { a: ElementId; b: ElementId; lines: ConwayLine[]; open: ConwayLine[] }

/**
 * The owning units beneath a pair of columns, each two with the interfaces
 * between them, those with nothing said first: what a press on a rolled-up cell
 * lists. Nothing where the columns are the owners themselves.
 */
export function pairsUnder(map: Pick<ConwayMap, 'groups'>, lines: readonly ConwayLine[], open: readonly ConwayLine[]): UnderPair[] {
  const owners = ownersOf(map)
  const asking = new Set(open.map((line) => line.flow.id))
  const held = new Map<string, UnderPair>()
  for (const line of lines) {
    const [from, to] = [owners.get(line.flow.sourceId), owners.get(line.flow.targetId)]
    if (from === undefined || to === undefined) continue
    if (from === line.from && to === line.to) return []
    const [a, b] = from < to ? [from, to] : [to, from]
    const one = held.get(pairId(a, b)) ?? { a, b, lines: [], open: [] }
    held.set(pairId(a, b), one)
    one.lines.push(line)
    if (asking.has(line.flow.id)) one.open.push(line)
  }
  return [...held.values()].sort((x, y) => y.open.length - x.open.length || y.lines.length - x.lines.length)
}

/** What the map can say about one unit: what it owns, who it works with, and which of its pairs ask for something. */
export function unitOnMap(map: Pick<ConwayMap, 'groups' | 'interactions'>, pairs: readonly PairReading[], unitId: ElementId): {
  owns: ConwayApplication[]
  worksWith: ConwayInteraction[]
  openPairs: PairReading[]
} {
  return {
    owns: map.groups.flatMap((group) => group.applications.filter((app) => app.partyId === unitId || (group.unitId === unitId && app.partyId === undefined))),
    worksWith: map.interactions.filter((row) => row.sourceId === unitId || row.targetId === unitId),
    openPairs: pairs.filter((pair) => pair.standing === 'attention' && (pair.a === unitId || pair.b === unitId)),
  }
}

/** The application on the map, and the interfaces it is an end of. */
export function applicationOnMap(map: Pick<ConwayMap, 'groups' | 'lines'>, id: ElementId): { app: ConwayApplication; lines: ConwayLine[] } | undefined {
  const app = map.groups.flatMap((group) => group.applications).find((one) => one.id === id)
  return app && { app, lines: map.lines.filter((line) => line.flow.sourceId === id || line.flow.targetId === id) }
}

/** Whether a grouping asked for rolls anything up: some column on the map is a unit of that type. */
export function groupingRollsUp(map: Pick<ConwayMap, 'groups'>, units: readonly UnitLike[], groupBy: string | undefined): boolean {
  if (groupBy === undefined) return true
  return map.groups.some((group) => group.unitId !== undefined && units.some((unit) => unit.id === group.unitId && unit.unitTypeId === groupBy))
}
