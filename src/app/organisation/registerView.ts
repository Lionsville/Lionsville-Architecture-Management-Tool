// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the register's three tabs show, as data: one row type each, one meaning
 * per column, and the sums the page says over them. The two registers shared a
 * table once, and a column that meant *maintained by* on one row and *sits in* on
 * the next could not be read down; a tab each is what stopped that.
 *
 * Every shown column is what Find looks in, so what can be seen can be found.
 * Findings are joined here from what the Checks page lists, so the register and
 * Checks cannot disagree about the same row. Pure, as `register.ts` is.
 */
import type { CheckWeight } from '../../model/checkCatalogue'
import { CHECK_CATALOGUE } from '../../model/checkCatalogue'
import type { ListHow } from '../../widgets/kit/listView'
import type { TechnologyRow } from '../../projects/technologyRegister'
import type { ScopePath } from '../../projects/scopePath'
import type { RegisterRow } from './register'
import type { CheckInstance } from './treeChecks'

export const REGISTER_TABS = ['applications', 'services', 'platforms'] as const
export type RegisterTab = (typeof REGISTER_TABS)[number]

export function isRegisterTab(value: string): value is RegisterTab {
  return (REGISTER_TABS as readonly string[]).includes(value)
}

/** The rows of a tab, out of the technology register's one fold. */
export const servicesOf = (rows: readonly TechnologyRow[]) => rows.filter((row) => row.kind === 'platformService')
export const platformsOf = (rows: readonly TechnologyRow[]) => rows.filter((row) => row.kind === 'platform')

/** Every finding about each record, by the record's id. */
export function findingsByRecord(instances: readonly CheckInstance[]): ReadonlyMap<string, readonly CheckInstance[]> {
  const by = new Map<string, CheckInstance[]>()
  for (const one of instances) {
    if (one.about === undefined) continue
    by.set(one.about, [...by.get(one.about) ?? [], one])
  }
  return by
}

/** How many of each weight, fix first: a mark and a count on the row, the sentences in the preview. */
export function weightsOf(instances: readonly CheckInstance[] | undefined): Readonly<Record<CheckWeight, number>> {
  const counted: Record<CheckWeight, number> = { fix: 0, review: 0, note: 0 }
  for (const one of instances ?? []) counted[CHECK_CATALOGUE[one.key].weight] += 1
  return counted
}

/** A note may well be intended, so it does not make a row one with findings. */
const hasFindings = (held: readonly CheckInstance[] | undefined) => {
  const weights = weightsOf(held)
  return weights.fix + weights.review > 0
}

/** How many scopes keep the rows, and how many sit in the one that keeps most. */
export function keptIn(rows: readonly { readonly master?: ScopePath }[]): { readonly scopes: number; readonly most: number } {
  const counts = new Map<ScopePath, number>()
  for (const row of rows) if (row.master !== undefined) counts.set(row.master, (counts.get(row.master) ?? 0) + 1)
  return { scopes: counts.size, most: Math.max(0, ...counts.values()) }
}

/** The words a list is read by; handed in, so this file holds none. */
export type RegisterWords = {
  readonly scopeName: (path: ScopePath) => string
  readonly owner: (row: RegisterRow) => string
  /** Which of the four answers the owner field gives: what Filter offers. */
  readonly ownerKind: (row: RegisterRow) => 'unit' | 'named' | 'outside' | 'nobody'
  readonly lifecycle: (row: Pick<RegisterRow, 'lifecycle' | 'lifecycleDates'>) => string
  readonly archetype: (row: TechnologyRow) => string
  readonly shared: (row: TechnologyRow, offered: boolean) => string
  readonly partOf: (row: TechnologyRow) => string
  readonly delivers: (row: TechnologyRow) => string
  readonly deliveredBy: (row: TechnologyRow) => string
  readonly maintainedBy: (row: TechnologyRow) => string
  readonly hasFindings: (has: boolean) => string
  readonly nobody: string
}

const names = (held: readonly { readonly name: string }[]) => held.map((one) => one.name).join(', ')

const group = (text: string) => ({ id: text, label: text })

export function applicationHow(words: RegisterWords, found: ReadonlyMap<string, readonly CheckInstance[]>, language: string): ListHow<RegisterRow> {
  const kept = (row: RegisterRow) => (row.master !== undefined ? words.scopeName(row.master) : words.nobody)
  return {
    language,
    words: (row) => [row.name, row.id, kept(row), row.category ?? '', words.lifecycle(row), words.owner(row), row.vendor ?? '', row.technology ?? ''],
    filterBy: {
      lifecycle: (row) => row.lifecycle ?? 'live',
      owner: (row) => words.ownerKind(row),
      master: (row) => row.master ?? '',
      category: (row) => row.category ?? '',
      findings: (row) => (hasFindings(found.get(row.id)) ? 'yes' : 'no'),
    },
    sortBy: {
      '': (row) => row.name,
      master: kept,
      category: (row) => row.category ?? null,
      lifecycle: (row) => row.lifecycleDates?.retired ?? row.lifecycleDates?.retiring ?? (row.lifecycle ?? 'live'),
      owner: (row) => words.owner(row),
      vendor: (row) => row.vendor ?? null,
      technology: (row) => row.technology ?? null,
      drawn: (row) => row.drawnIn.length,
      findings: (row) => { const weights = weightsOf(found.get(row.id)); return weights.fix * 1000 + weights.review },
    },
    groupBy: {
      master: (row) => group(kept(row)),
      category: (row) => group(row.category ?? words.nobody),
      lifecycle: (row) => group(words.lifecycle({ ...(row.lifecycle ? { lifecycle: row.lifecycle } : {}) })),
      owner: (row) => group(words.owner(row)),
      findings: (row) => group(words.hasFindings(hasFindings(found.get(row.id)))),
    },
  }
}

export function serviceHow(words: RegisterWords, found: ReadonlyMap<string, readonly CheckInstance[]>, language: string): ListHow<TechnologyRow> {
  const offered = (row: TechnologyRow) => (found.get(row.id) ?? []).some((one) => one.key === 'check.offeredNotShared')
  const kept = (row: TechnologyRow) => (row.master !== undefined ? words.scopeName(row.master) : words.nobody)
  return {
    language,
    words: (row) => [row.name, row.id, kept(row), words.maintainedBy(row), words.shared(row, offered(row)), words.deliveredBy(row)],
    filterBy: {
      shared: (row) => (row.shared ? 'shared' : offered(row) ? 'offered' : 'own'),
      delivered: (row) => (row.realisedBy.length > 0 ? 'yes' : 'no'),
      findings: (row) => (hasFindings(found.get(row.id)) ? 'yes' : 'no'),
    },
    sortBy: {
      '': (row) => row.name,
      master: kept,
      maintained: words.maintainedBy,
      shared: (row) => words.shared(row, offered(row)),
      used: (row) => row.consumers.applications,
      delivered: words.deliveredBy,
      findings: (row) => { const weights = weightsOf(found.get(row.id)); return weights.fix * 1000 + weights.review },
    },
    groupBy: {
      master: (row) => group(kept(row)),
      maintained: (row) => group(words.maintainedBy(row)),
      findings: (row) => group(words.hasFindings(hasFindings(found.get(row.id)))),
    },
  }
}

export function platformHow(words: RegisterWords, found: ReadonlyMap<string, readonly CheckInstance[]>, language: string): ListHow<TechnologyRow> {
  const kept = (row: TechnologyRow) => (row.master !== undefined ? words.scopeName(row.master) : words.nobody)
  return {
    language,
    words: (row) => [row.name, row.id, kept(row), words.archetype(row), words.partOf(row), words.delivers(row), names(row.maintainers)],
    filterBy: {
      archetype: (row) => row.platformArchetype ?? 'service',
      findings: (row) => (hasFindings(found.get(row.id)) ? 'yes' : 'no'),
    },
    sortBy: {
      '': (row) => row.name,
      master: kept,
      archetype: words.archetype,
      partOf: words.partOf,
      hosts: (row) => row.hosts,
      delivers: words.delivers,
      findings: (row) => { const weights = weightsOf(found.get(row.id)); return weights.fix * 1000 + weights.review },
    },
    groupBy: {
      archetype: (row) => group(words.archetype(row)),
      master: (row) => group(kept(row)),
      partOf: (row) => group(words.partOf(row)),
      findings: (row) => group(words.hasFindings(hasFindings(found.get(row.id)))),
    },
  }
}
