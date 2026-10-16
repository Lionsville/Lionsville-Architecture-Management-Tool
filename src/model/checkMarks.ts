// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A finding marked as intended (ADR-0036, amended 11 October 2026: findings
 * you can act on).
 *
 * A review asks a question and a note states a fact, and often the answer is
 * *yes, that is how it is meant*: two teams declared that they work together
 * and no interface runs between them, because they design together. A mark
 * says so, once, with a reason, and the finding stops being listed among the
 * ones to look at — it is listed apart, as accepted, where it can be taken
 * back.
 *
 * **A record in the model.** A mark is about the model and everybody sees it,
 * so it is kept like one: a list on the scope's model, a step with an
 * inverse (`commands/checkMarks.ts`), in the Activity list, the diff, a
 * thing's history and a restore, and on disk under `_checks/` (format 12).
 * It is kept in the scope of the finding's first subject — for the tree's
 * findings the scope the finding is about, for the dates' the scope they were
 * checked in, for the Conway map's the scope that keeps the row or the
 * element it is about.
 *
 * **Only a review or a note.** A fix says the model contradicts itself, and
 * the answer to that is in the model; the writer refuses to mark one
 * (`command.markFix`), and a mark on a fix that a file carries anyway silences
 * nothing ({@link splitMarked}).
 *
 * **The key is the instance.** A mark names its check and a key made of the
 * ids of the finding's subjects ({@link findingKey}), said per kind: the
 * interaction and its two units, the unit and the role, the responsibility
 * and the roles accountable for it. Change a subject so the key no longer
 * matches — re-point the interaction, make another role accountable — and
 * the finding is back, because what was accepted is not what is there now.
 * A key is unique among the instances of a kind that can be marked; a fix's
 * may be shared by two of its instances, and is never marked.
 *
 * **An agent reads marks and never makes them** (`agent/tools.ts`): a quality
 * signal is silenced by a person, for a reason a person gives.
 */
import type { StringKey } from '../i18n/strings'
import { checkEntry, CONWAY_CHECK, DATE_CHECK } from './checkCatalogue'
import type { CheckKey, TECHNOLOGY_CHECK_KEYS, TreeCheckKey } from './checkCatalogue'
import type { Finding as DateFinding, FindingKind } from './checks'
import type { ConwayFinding } from './conway'

/** One finding marked as intended, in the scope that keeps it. */
export type CheckMark = {
  /** The check the finding is of: a review or a note of the catalogue, never a fix. */
  check: CheckKey
  /** The instance: its subjects' ids, as {@link findingKey} says them. */
  key: string
  /** Why it is meant to be so, where somebody said. Asked for, never required. */
  reason?: string
  /** The day it was marked, `yyyy-mm-dd`. */
  on: string
}

/**
 * A mark's id on the model: its check and its key, which a scope holds one
 * mark of at most. Said rather than stored, so the file holds the four fields
 * a person reads and nothing derived from them.
 */
export type CheckMarkId = string

export function checkMarkId(mark: Pick<CheckMark, 'check' | 'key'>): CheckMarkId {
  return `${mark.check} ${mark.key}`
}

/** Whether a check's findings may be marked as intended: a review's or a note's, never a fix's or an unknown kind's. */
export function isMarkable(check: string): boolean {
  const weight = checkEntry(check)?.weight
  return weight === 'review' || weight === 'note'
}

/**
 * A finding said about a scope: `projects/checks`'s `Finding`, structurally,
 * and anything a list keys by a check with the scope it is about and the
 * record it names (the organisation's *Needs attention*). The model may not
 * import `projects`, so the shape is said here, as `agent/tree.ts` says it.
 */
export type ScopedFinding = {
  readonly key: CheckKey
  /** The scope the finding is about: where its mark is kept, and the only one whose marks silence it. */
  readonly scope: string
  readonly id: string
  readonly fields?: readonly string[]
  readonly scopes?: readonly string[]
  readonly person?: string
}

/** Every shape a finding is worked out in: the tree's, the dates' and the Conway map's. */
export type AnyFinding = ScopedFinding | DateFinding | ConwayFinding

/**
 * Which shape a finding is in. Said about a scope first: a list's item may
 * carry a `kind` of its own beside its key (the organisation's *Needs
 * attention* does), and neither the dates' nor the map's finding has a key.
 */
function isScoped(finding: AnyFinding): finding is ScopedFinding {
  return 'key' in finding && 'scope' in finding
}

function isDateFinding(finding: AnyFinding): finding is DateFinding {
  return !isScoped(finding) && 'subject' in finding
}

/** The keys a finding said about a scope is of: the tree's and the technology rows'. */
type ScopedCheckKey = TreeCheckKey | (typeof TECHNOLOGY_CHECK_KEYS)[number]

/** The record it is about. */
const own = (finding: ScopedFinding): string[] => [finding.id]
/** The record, and the other records its `fields` name. */
const withFields = (finding: ScopedFinding): string[] => [finding.id, ...(finding.fields ?? [])]

/**
 * The subjects of a finding said about a scope, by its check. A `Record` over
 * the tree's and the technology rows' keys, so a kind added there without a
 * key here does not compile; a finding of another kind put in this shape is
 * its record and its fields.
 */
const SCOPED_SUBJECTS: Record<ScopedCheckKey, (finding: ScopedFinding) => string[]> = {
  'check.conflict': own,
  'check.drift': own,
  'check.dangling': own,
  /** The row, and the end nobody holds. */
  'check.danglingEnd': withFields,
  'check.proposal': own,
  /** The stand-in, and the owner's fields written on it: another field written is another question. */
  'check.ownedElsewhere': withFields,
  'check.unattributed': own,
  'check.notDrawn': own,
  /** The shape (`view:shape`), and the element it points at. */
  'check.drawingLinkMissing': withFields,
  'check.unmapped': own,
  'check.uncovered': own,
  /** The service, and the applications using it from another team: a new one is a new conversation. */
  'check.offeredNotShared': withFields,
  /** The cause, the scope below and the observation there: not the cause it suggests linking instead. */
  'check.causeExplainsObservationBelow': (finding) => [finding.id, ...(finding.scopes ?? []).slice(0, 1), ...(finding.fields ?? []).slice(0, 1)],
  /** The responsibility, and the roles accountable for it where there are several. */
  'check.accountability': withFields,
  'check.unitTypeNowhere': own,
  /** The unit and the role. */
  'check.roleVacant': withFields,
  'check.roleOverMax': withFields,
  /** The unit, and the type of the unit it sits in. */
  'check.unitMisplaced': withFields,
  'check.unitSpans': own,
  /** The unit — the Conway map's over-limit is the same instance. */
  'check.unitOverLimit': own,
  /** The unit, and the assignment. */
  'check.assignmentEnded': withFields,
  /** The assignment: its unit is not there. */
  'check.assignmentOrphaned': own,
  /** The unit, and the type that ended. */
  'check.unitTypeEnded': withFields,
  /** The person, by register id, in each scope that keeps one of their assignments. */
  'check.personOverloaded': (finding) => [finding.person ?? finding.id],
  /** The capability, the unit and the `assigned` row. */
  'check.unitNotServing': withFields,
  /** The unit and role a line runs from, and where it lands: the line's target changed is another question. */
  'check.reportingLoop': withFields,
  'check.reportingDangling': withFields,
  'check.reportingAmbiguous': withFields,
  'check.reportingVacant': withFields,
  'check.unrealised': own,
}

/** The subjects of each of the dates' findings: what it is about, and for a plan overdue the day it was due. */
const DATE_SUBJECTS: Record<FindingKind, (finding: DateFinding) => string[]> = {
  retiresWithDependants: (finding) => [finding.id],
  successorTooLate: (finding) => [finding.id],
  successorMissing: (finding) => [finding.id],
  lineOutlivesEnd: (finding) => [finding.id],
  /** A fix, never marked: two containers of one application on platforms that go first share it. */
  platformRetiresFirst: (finding) => [finding.id],
  /** The first of the container lines, which is what *Accept* finds them by. */
  impliedInterface: (finding) => [finding.id],
  /** The plan and the day it was due: a plan given a new end and overdue again is asked again. */
  planOverdue: (finding) => [finding.id, ...(finding.detail !== undefined ? [finding.detail] : [])],
}

/**
 * The subjects of each of the Conway map's findings. An interface and an
 * interaction are the row and its two ends — never the columns they were
 * drawn in, which change with how the map is grouped.
 */
function conwaySubjects(finding: ConwayFinding): string[] {
  switch (finding.kind) {
    case 'undeclared': return [finding.flow.id, finding.flow.sourceId, finding.flow.targetId]
    case 'unused': return [finding.interaction.id, finding.interaction.sourceId, finding.interaction.targetId]
    case 'unowned': return [finding.applicationId]
    case 'overLimit': return [finding.unitId]
  }
}

/** The check a finding is of, whichever shape it was worked out in. */
export function findingCheck(finding: AnyFinding): CheckKey {
  if (isScoped(finding)) return finding.key
  if (isDateFinding(finding)) return DATE_CHECK[finding.kind]
  return CONWAY_CHECK[finding.kind]
}

/**
 * The ids a finding is about, first the one it is mostly about — the subject
 * whose scope keeps its mark — then the others that make it this instance.
 */
export function findingSubjects(finding: AnyFinding): string[] {
  if (isScoped(finding)) return ((SCOPED_SUBJECTS as Partial<Record<CheckKey, (one: ScopedFinding) => string[]>>)[finding.key] ?? withFields)(finding)
  if (isDateFinding(finding)) return DATE_SUBJECTS[finding.kind](finding)
  return conwaySubjects(finding)
}

/** The instance's identity: its subjects' ids, a space between each. */
export function findingKey(finding: AnyFinding): string {
  return findingSubjects(finding).join(' ')
}

/** The mark a person makes of a finding, on a day, with the reason they gave; a blank reason is none. */
export function checkMarkFor(finding: AnyFinding, made: { on: string; reason?: string }): CheckMark {
  const reason = made.reason?.trim()
  return { check: findingCheck(finding), key: findingKey(finding), ...(reason ? { reason } : {}), on: made.on }
}

/**
 * What marking a finding and taking a mark back say on screen: *Mark as
 * intended…*, the question it asks, *Accepted (N)* with each mark's reason
 * and day, and *Take back* — one table, handed to the two pieces that draw
 * them (`widgets/FindingMarks`), which may not read the model themselves.
 */
export const CHECK_MARK_WORDS = {
  open: 'check.mark.open',
  title: 'check.mark.title',
  about: 'check.mark.about',
  reason: 'check.mark.reason',
  reasonHelp: 'check.mark.reasonHelp',
  confirm: 'check.mark.confirm',
  cancel: 'common.cancel',
  accepted: 'check.mark.accepted',
  on: 'check.mark.on',
  noReason: 'check.mark.noReason',
  takeBack: 'check.mark.takeBack',
  /** Where a list of every check says why a fix offers no mark. */
  never: 'check.mark.never',
} as const satisfies Record<string, StringKey>

/** A mark and the scope that keeps it: what the index lists across the tree. */
export type KeptCheckMark = { readonly scope: string; readonly mark: CheckMark }

/** A finding that a mark silences, the mark, and the scope that keeps it. */
export type MarkedFinding<F> = { finding: F; mark: CheckMark; scope: string }

/**
 * Findings split into those still shown and those marked as intended, given
 * the marks of the tree (`ScopeIndex.checkMarks`, with the open scope's own
 * laid over it). Each list keeps the order the findings came in.
 *
 * A mark silences a finding of its check with its key, kept in the scope the
 * finding is about: a finding said about a scope is matched to that scope's
 * marks alone, and one of the dates' to those of `scope`, the scope they were
 * checked in, where it is given. A Conway map's finding is about the tree and
 * is matched to a mark wherever it is kept. A mark on a fix silences nothing.
 */
export function splitMarked<F extends AnyFinding>(
  findings: readonly F[], marks: readonly KeptCheckMark[], options: { scope?: string } = {},
): { shown: F[]; marked: MarkedFinding<F>[] } {
  const byId = new Map<CheckMarkId, KeptCheckMark[]>()
  for (const kept of marks) {
    if (!isMarkable(kept.mark.check)) continue
    const id = checkMarkId(kept.mark)
    byId.set(id, [...byId.get(id) ?? [], kept])
  }
  const shown: F[] = []
  const marked: MarkedFinding<F>[] = []
  for (const finding of findings) {
    const held = byId.get(checkMarkId({ check: findingCheck(finding), key: findingKey(finding) }))
    const where = isScoped(finding) ? finding.scope : isDateFinding(finding) ? options.scope : undefined
    const kept = held?.find((one) => where === undefined || one.scope === where)
    if (kept) marked.push({ finding, mark: kept.mark, scope: kept.scope })
    else shown.push(finding)
  }
  return { shown, marked }
}
