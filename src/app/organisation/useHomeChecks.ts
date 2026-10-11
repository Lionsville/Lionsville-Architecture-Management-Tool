// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the checks find at or under a home, for its counts and its Checks
 * page (ADR-0036, amended 11 October 2026): every instance from what the
 * shell holds (`treeChecks.ts`), split by the marks as intended, by check
 * and by category, and counted by weight. Worked out when what it reads
 * changes — the index read again, the home's document, the day — and never
 * for a render.
 */
import { useMemo } from 'react'
import type { Translate } from '../../i18n'
import { CHECK_CATALOGUE } from '../../model/checkCatalogue'
import type { CheckWeight } from '../../model/checkCatalogue'
import type { KeptCheckMark } from '../../model/checkMarks'
import type { PlatformTree } from '../../model/hosting'
import type { HostModel } from '../../model/hostModel'
import type { Person } from '../../people/person'
import type { Finding } from '../../projects/checks'
import type { ScopeModel } from '../../projects/scope'
import type { ScopeIndex } from '../../projects/scopeIndex'
import { ROOT_SCOPE } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import type { TechnologyRow } from '../../projects/technologyRegister'
import { useCheckMarking } from '../checkMarking'
import { attentionItems } from './attention'
import type { RegisterRow } from './register'
import { checksByCategory, splitInstances, treeInstances } from './treeChecks'

/** The tree as the shell read it: the index, and every scope's records, rows and plans it was built from. */
export type TreeRead = { index: ScopeIndex; models: readonly ScopeModel[] }

export type HomeChecks = ReturnType<typeof useHomeChecks>

export function useHomeChecks(deps: {
  /** The tree's findings by scope; absent before the index has been read, and then nothing is counted. */
  findings: ReadonlyMap<ScopePath, readonly Finding[]> | undefined
  register: readonly RegisterRow[]
  technology: readonly TechnologyRow[]
  at: ScopePath
  /** The home's own document, where it has been read: the operating model at the organisation, and the Conway map over the home. */
  root: { path: ScopePath; model: HostModel } | undefined
  tree: TreeRead | undefined
  /** The tree's marks, where no marking is handed down: what the lists are split by. */
  marks: readonly KeptCheckMark[] | undefined
  people: { people?: readonly Person[] | undefined } | undefined
  platformTree: PlatformTree | undefined
  today: string
  scopeName: (path: ScopePath) => string
  s: Translate
}) {
  const { findings, register, technology, at, tree, platformTree, today, scopeName, s } = deps
  const home = deps.root?.path === at ? deps.root.model : undefined
  const people = deps.people?.people
  const marking = useCheckMarking()
  const marks = marking?.marks ?? deps.marks
  const instances = useMemo(() => {
    if (findings === undefined) return []
    const attention = attentionItems(findings, register, technology, at, s, scopeName, people, at === ROOT_SCOPE ? home : undefined)
    return treeInstances({ attention, models: tree?.models ?? [], at, today, platformTree, index: tree?.index, home, t: s })
  }, [findings, register, technology, at, s, scopeName, people, home, tree, today, platformTree])
  const split = useMemo(() => splitInstances(instances, marks ?? []), [instances, marks])
  const rows = useMemo(() => checksByCategory(split), [split])
  const counts = useMemo(() => {
    const counted: Record<CheckWeight, number> = { fix: 0, review: 0, note: 0 }
    for (const one of split.shown) counted[CHECK_CATALOGUE[one.key].weight] += 1
    return counted
  }, [split])
  return { instances, split, rows, counts }
}
