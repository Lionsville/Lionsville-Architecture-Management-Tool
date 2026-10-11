// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every finding at or under a home, from what the shell already holds, for
 * the Checks page and the counts on the home (ADR-0036, amended 11 October
 * 2026).
 *
 * **Four producers, none worked out afresh.** The tree's findings, the
 * register's and the technology rows', and at the organisation the operating
 * model's — what *Needs attention* has always listed (`attention.ts`); the
 * dates' of every scope, worked out over the records, rows and plans the
 * index read with each scope (`model/checks.ts`, as its roadmap works them
 * out); and the Conway map's over the home, at the organisation over the
 * whole of it (`model/conway.ts`, as a map kept there draws it). A unit over
 * its type's limit is one instance, whichever of the two found it.
 *
 * **What only an open scope can say is not counted here.** A record on no
 * view, the owner's detail on a stand-in, a row's end nobody holds, a shape
 * pointing at nothing, the business layer's two and a cause explaining an
 * observation below are worked out from a scope's whole document, which the
 * index does not hold: the page says so for those checks rather than a
 * count that would be wrong ({@link FOUND_WHERE_OPEN}).
 *
 * Each instance says where it is fixed — a scope opened on a page, or a
 * person on the People page — and carries the finding as it was worked out,
 * which a mark as intended is made from and split by.
 */
import type { Translate } from '../../i18n'
import { CHECK_CATALOGUE, CHECK_CATEGORIES, CHECK_KEYS, CONWAY_CHECK, DATE_CHECK } from '../../model/checkCatalogue'
import type { CheckCategory, CheckEntry, CheckKey, CheckWeight } from '../../model/checkCatalogue'
import { splitMarked } from '../../model/checkMarks'
import type { AnyFinding, CheckMark, KeptCheckMark } from '../../model/checkMarks'
import { findings as dateFindings } from '../../model/checks'
import { conwayMap } from '../../model/conway'
import type { ConwayFinding } from '../../model/conway'
import type { PlatformTree } from '../../model/hosting'
import type { HostModel } from '../../model/hostModel'
import { checkMarkScope } from '../../projects/checkMarks'
import type { ScopeModel } from '../../projects/scope'
import type { ScopeIndex } from '../../projects/scopeIndex'
import { isWithinScope, ROOT_SCOPE } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { findingTarget } from '../../roadmap/findingTarget'
import { findingWords } from '../../roadmap/ui/FindingSentence'
import type { InitialPage } from '../App'
import { findingText } from '../units/conwayWords'
import { conwayInputHere, unitViewsHere } from '../units/unitViewsHere'
import { findingKind } from './attention'
import type { AttentionItem } from './attention'

/**
 * The checks worked out from a scope's whole document, which only the scope
 * that is open has (`projects/checks.documentFindings`): listed on the page
 * with their explanation, and not counted.
 */
export const FOUND_WHERE_OPEN: ReadonlySet<CheckKey> = new Set<CheckKey>([
  'check.notDrawn', 'check.ownedElsewhere', 'check.danglingEnd', 'check.drawingLinkMissing',
  'check.unmapped', 'check.uncovered', 'check.causeExplainsObservationBelow',
])

/** Where an instance is fixed: a scope opened on a page, or a person on the People page. */
export type CheckPlace = { readonly scope: ScopePath; readonly page: InitialPage } | { readonly person: string }

/** One finding, as the Checks page lists it. */
export type CheckInstance = {
  readonly key: CheckKey
  /** The scope it is found in, said beside it; absent where the tree knows none. */
  readonly scope: ScopePath | undefined
  /** The scope the dates were checked in, for one of theirs: what its mark is matched against. */
  readonly checkedIn?: ScopePath
  /** The finding in its own sentence, as the list it comes from says it. */
  readonly text: string
  /** As worked out: what a mark is made of, and split by. */
  readonly finding: AnyFinding
  /** What tells it from the others while it is found. */
  readonly id: string
  /** Where it is fixed; nothing where there is nowhere to go. */
  readonly opens?: CheckPlace
  /** What something outside points at it by: the kind's word (`data-finding`), and a test id. */
  readonly attributes: Readonly<Record<string, string>>
}

/** What the tree holds that the instances are worked out from. */
export type TreeChecksInput = {
  /** The home's tree, register, technology and operating model findings (`attentionItems`), already within it. */
  attention: readonly AttentionItem[]
  /** Every scope's records, rows and plans as the index read them: the dates'. */
  models: readonly ScopeModel[]
  /** The home: only what is filed at or under it. */
  at: ScopePath
  today: string
  platformTree?: PlatformTree | undefined
  /** The index, and the home's own document: the Conway map over the home. Absent while either is being read, and then the map's are not yet listed. */
  index?: ScopeIndex | undefined
  home?: HostModel | undefined
  t: Translate
}

/** The tree's findings, where *Needs attention* opened each: the record, its view, the operating model, or the person. */
function fromTree(item: AttentionItem): CheckInstance {
  const opens: CheckPlace = item.key === 'check.personOverloaded' && item.person !== undefined
    ? { person: item.person }
    : item.view !== undefined
      ? { scope: item.scope, page: { page: 'board', id: item.view } }
      : item.page === 'operating'
        ? { scope: ROOT_SCOPE, page: { page: 'operating', id: item.id } }
        : { scope: item.scope, page: { page: 'element', id: item.id } }
  return {
    key: item.key, scope: item.scope, text: item.text, finding: item, id: `${item.key}|${item.scope}|${item.id}`, opens,
    // The home's own row id and kind word, so whatever pointed at a row of Needs attention finds it here.
    attributes: { 'data-testid': `attention-${item.scope}-${item.id}`, 'data-finding': item.kind },
  }
}

/** Each scope's dates, checked as its roadmap checks them, opened where its roadmap opens them. */
function fromDates({ models, at, today, platformTree, t }: TreeChecksInput): CheckInstance[] {
  return models.filter((one) => at === ROOT_SCOPE || isWithinScope(one.path, at)).flatMap(({ path, model }) => {
    const checked = dateFindings({
      model: { elements: [...model.elements], relations: [...model.relations], ...(model.transitions ? { transitions: [...model.transitions] } : {}) },
      today, ...(platformTree ? { platformTree } : {}),
    })
    return checked.map((problem): CheckInstance => {
      const target = findingTarget(problem, model.relations)
      return {
        key: DATE_CHECK[problem.kind], scope: path, checkedIn: path, text: findingWords(problem, t), finding: problem,
        id: `${problem.kind}|${path}|${problem.id}`, ...(target ? { opens: { scope: path, page: target } } : {}),
        attributes: { 'data-testid': `checks-${path}-${problem.id}`, 'data-finding': problem.kind },
      }
    })
  })
}

/** What a Conway map's finding is about, first: what opening it opens. */
function conwaySubject(finding: ConwayFinding): string {
  switch (finding.kind) {
    case 'undeclared': return finding.flow.sourceId
    case 'unused': return finding.interaction.sourceId
    case 'unowned': return finding.applicationId
    case 'overLimit': return finding.unitId
  }
}

/** The Conway map over the home, as a map kept there draws it; its over-limit where the tree has not said it already. */
function fromConway(input: TreeChecksInput): CheckInstance[] {
  const { index, at, home, today, attention, t } = input
  if (!index || !home) return []
  const here = unitViewsHere(index, at, home)
  const map = conwayMap(conwayInputHere(index, at, home, here, today), today)
  const saidOverLimit = new Set(attention.filter((one) => one.key === 'check.unitOverLimit').map((one) => one.id))
  return map.findings.filter((one) => one.kind !== 'overLimit' || !saidOverLimit.has(one.unitId)).map((finding): CheckInstance => {
    const key = CONWAY_CHECK[finding.kind]
    const subject = conwaySubject(finding)
    const opensIn = here.scopeOf(subject)
    return {
      key, scope: checkMarkScope(index, finding) ?? opensIn, text: findingText(finding, here, t), finding,
      id: `${key}|${subject}|${finding.kind === 'undeclared' ? finding.flow.id : finding.kind === 'unused' ? finding.interaction.id : ''}`,
      ...(opensIn !== undefined ? { opens: { scope: opensIn, page: { page: 'element', id: subject } } } : {}),
      attributes: { 'data-testid': `checks-conway-${subject}`, 'data-finding': findingKind(key) },
    }
  })
}

/** Every finding at or under the home, the tree's first, then the dates', then the Conway map's. */
export function treeInstances(input: TreeChecksInput): CheckInstance[] {
  return [...input.attention.map(fromTree), ...fromDates(input), ...fromConway(input)]
}

/** An instance marked as intended, its mark, and the scope that keeps it. */
export type MarkedInstance = { instance: CheckInstance; mark: CheckMark; keptIn: ScopePath }

/**
 * The instances split by the marks, as every list splits its findings: one
 * said about a scope by that scope's marks, one of the dates' by those of the
 * scope they were checked in, a Conway map's by a mark wherever it is kept.
 */
export function splitInstances(instances: readonly CheckInstance[], marks: readonly KeptCheckMark[]): { shown: CheckInstance[]; marked: MarkedInstance[] } {
  const byChecked = new Map<ScopePath | undefined, CheckInstance[]>()
  for (const one of instances) byChecked.set(one.checkedIn, [...byChecked.get(one.checkedIn) ?? [], one])
  const silenced = new Map<AnyFinding, { mark: CheckMark; keptIn: ScopePath }>()
  for (const [checkedIn, some] of byChecked) {
    const { marked } = splitMarked(some.map((one) => one.finding), marks, checkedIn !== undefined ? { scope: checkedIn } : {})
    for (const one of marked) silenced.set(one.finding, { mark: one.mark, keptIn: one.scope })
  }
  const shown: CheckInstance[] = []
  const marked: MarkedInstance[] = []
  for (const instance of instances) {
    const held = silenced.get(instance.finding)
    if (held) marked.push({ instance, ...held })
    else shown.push(instance)
  }
  return { shown, marked }
}

/** One check on the page: its entry, what is found of it and what was marked, and whether the tree can count it. */
export type CheckRow = {
  readonly key: CheckKey
  readonly entry: CheckEntry
  readonly shown: readonly CheckInstance[]
  readonly marked: readonly MarkedInstance[]
  /** False for a check only an open scope can work out ({@link FOUND_WHERE_OPEN}): the page says so rather than a count. */
  readonly counted: boolean
}

const RANK: Readonly<Record<CheckWeight, number>> = { fix: 0, review: 1, note: 2 }

/**
 * Every check of the catalogue, by category in the catalogue's order, fix
 * before review before note within one, each with what was found of it —
 * none too, because the page is of the checks and not only of the findings.
 */
export function checksByCategory(split: { shown: readonly CheckInstance[]; marked: readonly MarkedInstance[] }): { category: CheckCategory; rows: CheckRow[] }[] {
  const shown = new Map<CheckKey, CheckInstance[]>()
  for (const one of split.shown) shown.set(one.key, [...shown.get(one.key) ?? [], one])
  const marked = new Map<CheckKey, MarkedInstance[]>()
  for (const one of split.marked) marked.set(one.instance.key, [...marked.get(one.instance.key) ?? [], one])
  return CHECK_CATEGORIES.map((category) => ({
    category,
    rows: CHECK_KEYS.filter((key) => CHECK_CATALOGUE[key].category === category)
      .sort((a, b) => RANK[CHECK_CATALOGUE[a].weight] - RANK[CHECK_CATALOGUE[b].weight])
      .map((key) => ({
        key, entry: CHECK_CATALOGUE[key], shown: shown.get(key) ?? [], marked: marked.get(key) ?? [], counted: !FOUND_WHERE_OPEN.has(key),
      })),
  })).filter((one) => one.rows.length > 0)
}

/**
 * The first check of a weight with anything found, in the page's order: what
 * the home's count of that weight opens the page on.
 */
export function firstOfWeight(rows: ReturnType<typeof checksByCategory>, weight: CheckWeight): CheckKey | undefined {
  return rows.flatMap((one) => one.rows).find((row) => row.entry.weight === weight && row.shown.length > 0)?.key
}
