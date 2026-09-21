/**
 * The technology register: every platform service and platform in the
 * organisation, derived (ADR-0014 §2.6).
 *
 * The application register is every application in the tree, off the index;
 * there was no equivalent for technology, so the platform scope's own element
 * list was the only list there was — and only if every platform happened to
 * be mastered there. This is the same fold over the same index, beside it:
 * every service and every platform defined anywhere, keyed by id, with the
 * scope that answers for it, the scopes that draw it, and what the rows say
 * about it — who maintains a service, whether it is shared, how many
 * applications consume it and from how many scopes, what realises it; what a
 * platform is, what it realises, what it hosts with everything under it, and
 * the service it belongs to where there is one.
 *
 * **Nothing is materialised**, for the reason `register.ts` gives: a
 * materialised list is a merge conflict every domain touches, and a derived
 * one is right by construction. Pure, and tested in node, so the card and the
 * page cannot disagree.
 */
import { matchesQuery } from '../../model'
import type { ElementId, PlatformArchetype } from '../../model'
import type { Finding } from '../../projects/checks'
import type { IndexEntry, ScopeIndex } from '../../projects/scopeIndex'
import { isWithinScope, ROOT_SCOPE } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'

export type TechnologyKind = 'platformService' | 'platform'

/** A thing named beside its id, for a cell a person reads. */
export type Named = { id: ElementId; name: string }

/** One service or platform, as the register draws it. */
export type TechnologyRow = {
  id: ElementId
  kind: TechnologyKind
  /** The master's name, or the only name anybody wrote down. */
  name: string
  /** The scope that answers for it; absent is the dangling case. */
  master?: ScopePath
  /** The scopes above the master that declare it. */
  declarations: readonly ScopePath[]
  /** Every scope holding a stand-in: who else draws it. */
  drawnIn: readonly ScopePath[]
  /** Nobody in this organisation runs it (§4). */
  outside?: true
  /** Whose it is, named, where that has been said. */
  party?: string
  /** The findings that concern it, one of each kind. */
  findings: readonly Finding[]

  // --- a service ------------------------------------------------------------
  /** Offered beyond the team that maintains it, as its master says. */
  shared?: true
  /** The actors it is `assigned` to. */
  maintainers: readonly Named[]
  /** How many applications consume it, and from how many scopes. */
  consumers: { applications: number; scopes: number }
  /** The platforms that realise it. Empty is a real gap. */
  realisedBy: readonly Named[]

  // --- a platform -----------------------------------------------------------
  /** What it is, as its master says; `service` where unsaid. */
  platformArchetype?: PlatformArchetype
  /** The services it realises. */
  realises: readonly Named[]
  /** How many things are hosted on it or on anything filed under it. */
  hosts: number
  /** What it is filed under. */
  partOf?: Named
  /** The service it belongs to: the first it or anything above it realises. */
  service?: Named
}

/** The line the card says, and the line under the page's heading. */
export type TechnologySummary = {
  services: number
  platforms: number
  /** Services offered beyond their team, as said. */
  shared: number
  /** Services used by another team and not marked shared. */
  offeredNotShared: number
  /** Services nothing realises. */
  unrealised: number
  definedTwice: number
  stale: number
}

/**
 * Every service and platform in the tree, by name, with the findings about
 * each.
 *
 * The findings come in rather than being computed here, as the application
 * register takes them: one fold over the index answers for the whole
 * organisation, and the screen that draws this already has them.
 */
export function technologyRows(
  index: ScopeIndex,
  findings: readonly Finding[] = [],
): TechnologyRow[] {
  const about = new Map<string, Finding[]>()
  for (const finding of findings) {
    const held = about.get(finding.id) ?? []
    if (held.some((one) => one.key === finding.key)) continue
    held.push(finding)
    about.set(finding.id, held)
  }
  const named = (id: ElementId): Named => ({ id, name: index.lookup(id)?.name ?? id })
  const entries = index.entries().filter((entry) => entry.kind === 'platform' || entry.kind === 'platformService')
  const platforms = entries.filter((entry) => entry.kind === 'platform')

  /** What a platform sits in, nearest first; a loop stops itself. */
  const ancestors = (entry: IndexEntry): IndexEntry[] => {
    const chain: IndexEntry[] = []
    const seen = new Set<ElementId>([entry.id])
    let held = entry.parentId === undefined ? undefined : index.lookup(entry.parentId)
    while (held && held.kind === 'platform' && !seen.has(held.id)) {
      seen.add(held.id)
      chain.push(held)
      held = held.parentId === undefined ? undefined : index.lookup(held.parentId)
    }
    return chain
  }
  const realisesOf = (platformId: ElementId): Named[] => [...new Set(
    index.rowsOf(platformId)
      .filter(({ relation }) => relation.type === 'realises' && relation.sourceId === platformId)
      .map(({ relation }) => relation.targetId),
  )].map(named)

  return entries.map((entry): TechnologyRow => {
    const party = entry.partyId !== undefined ? index.lookup(entry.partyId)?.name : undefined
    const base = {
      id: entry.id,
      kind: entry.kind as TechnologyKind,
      name: entry.name,
      ...(entry.master !== undefined ? { master: entry.master } : {}),
      declarations: entry.declarations,
      drawnIn: entry.drawnIn,
      ...(entry.outside ? { outside: entry.outside } : {}),
      ...(party !== undefined ? { party } : {}),
      findings: about.get(entry.id) ?? [],
    }
    if (entry.kind === 'platformService') {
      const consumed = index.rowsTo(entry.id, ['uses'])
      const applications = new Set<ElementId>()
      for (const { relation } of consumed) {
        const consumer = index.lookup(relation.sourceId)
        applications.add(consumer?.kind === 'component' && consumer.parentId !== undefined ? consumer.parentId : relation.sourceId)
      }
      return {
        ...base,
        ...(entry.shared ? { shared: entry.shared } : {}),
        maintainers: [...new Set(index.rowsTo(entry.id, ['assigned']).map(({ relation }) => relation.sourceId))].map(named),
        consumers: { applications: applications.size, scopes: new Set(consumed.map(({ scope }) => scope)).size },
        realisedBy: [...new Set(index.rowsTo(entry.id, ['realises']).map(({ relation }) => relation.sourceId))].map(named),
        realises: [],
        hosts: 0,
      }
    }
    // What is hosted on it or on anything under it (ADR-0014 §2.7).
    const under = platforms.filter((other) => other.id !== entry.id && ancestors(other).some((above) => above.id === entry.id))
    const hosted = new Set<ElementId>()
    for (const platform of [entry, ...under]) {
      for (const { relation } of index.rowsTo(platform.id, ['hostedOn'])) hosted.add(relation.sourceId)
    }
    const realises = realisesOf(entry.id)
    const service = [realises, ...ancestors(entry).map((above) => realisesOf(above.id))].find((held) => held.length > 0)?.[0]
    const parent = entry.parentId === undefined ? undefined : index.lookup(entry.parentId)
    return {
      ...base,
      maintainers: [...new Set(index.rowsTo(entry.id, ['assigned']).map(({ relation }) => relation.sourceId))].map(named),
      consumers: { applications: 0, scopes: 0 },
      realisedBy: [],
      platformArchetype: entry.platformArchetype ?? 'service',
      realises,
      hosts: hosted.size,
      ...(parent ? { partOf: named(parent.id) } : {}),
      ...(service ? { service } : {}),
    }
  }).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}

export function technologySummary(rows: readonly TechnologyRow[]): TechnologySummary {
  const has = (row: TechnologyRow, key: Finding['key']) => row.findings.some((finding) => finding.key === key)
  const services = rows.filter((row) => row.kind === 'platformService')
  return {
    services: services.length,
    platforms: rows.length - services.length,
    shared: services.filter((row) => row.shared).length,
    offeredNotShared: services.filter((row) => has(row, 'check.offeredNotShared')).length,
    unrealised: services.filter((row) => row.realisedBy.length === 0).length,
    definedTwice: rows.filter((row) => has(row, 'check.conflict')).length,
    stale: rows.filter((row) => has(row, 'check.drift')).length,
  }
}

/** The rows a scope's home can speak for, as `registerWithin` decides it. */
export function technologyWithin(rows: readonly TechnologyRow[], at: ScopePath): TechnologyRow[] {
  if (at === ROOT_SCOPE) return [...rows]
  return rows.filter((row) => (
    (row.master !== undefined && isWithinScope(row.master, at))
    || row.drawnIn.some((path) => isWithinScope(path, at))
  ))
}

/** The rows a filter box leaves: over the name, the id, the scope that answers for it, and the maintainers. */
export function matchingTechnology(rows: readonly TechnologyRow[], query: string): TechnologyRow[] {
  const asked = query.trim()
  if (!asked) return [...rows]
  return rows.filter((row) => matchesQuery(asked, [row.name, row.id, row.master ?? '', ...row.maintainers.map((one) => one.name)]))
}

export type TechnologyOrder = 'name' | 'kind' | 'scope'

/**
 * The rows in the order the page shows them: by name; by kind, the services
 * first because they are what a team asks for; or by the scope that answers,
 * with the ones nobody defines last.
 */
export function sortTechnology(rows: readonly TechnologyRow[], by: TechnologyOrder): TechnologyRow[] {
  if (by === 'name') return [...rows]
  if (by === 'kind') {
    return [...rows].sort((a, b) => (
      Number(a.kind === 'platform') - Number(b.kind === 'platform') || a.name.localeCompare(b.name)
    ))
  }
  return [...rows].sort((a, b) => {
    if ((a.master === undefined) !== (b.master === undefined)) return a.master === undefined ? 1 : -1
    return (a.master ?? '').localeCompare(b.master ?? '') || a.name.localeCompare(b.name)
  })
}
