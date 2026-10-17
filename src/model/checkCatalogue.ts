// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every kind of finding the app can say, and what each one is to a person
 * (ADR-0036, amended 11 October 2026: findings you can act on).
 *
 * A finding used to be one sentence, said wherever it was listed, with
 * nothing to tell a contradiction from a fact that may well be intended, and
 * nothing to say why it mattered or what would settle it. This is the one
 * place each kind says those things: a name a person recognises, a category,
 * a weight, why it matters, how to fix it, and the actions that fix it.
 *
 * **One list of keys, and a record over it.** {@link CHECK_KEYS} is every
 * kind, said once, gathered from the four places findings are worked out —
 * the tree (`projects/checks.ts`), the dates (`checks.ts` here), the Conway
 * map (`conway.ts` here) and the technology rows the organisation's home
 * reads. {@link CheckKey} is derived from it, and {@link CHECK_CATALOGUE} is
 * a `Record` over it, so a kind added without an entry does not compile;
 * the dates' and the map's own kinds reach their keys through a table each
 * ({@link DATE_CHECK}, {@link CONWAY_CHECK}), which is a `Record` over their
 * kinds for the same reason.
 *
 * **Here, at the bottom, and not beside `projects/checks.ts`.** The agent
 * answers a finding's weight and the Conway map's findings carry a key, and
 * neither `agent` nor the map may import `projects`; every module may import
 * the model.
 *
 * **Keys, never words.** An entry names string keys of the model's own slice
 * (`check.name.*`, `check.why.*`, `check.how.*`), typed so a key the slice
 * does not have, or one that names another kind, is a compile error. The
 * sentence that says one finding stays where it is said; this says the kind.
 *
 * **The weight is the kind's, and the wording follows it.** *Fix*: the model
 * contradicts itself or cannot be true, and it is never waived. *Review*:
 * probably a gap or a risk, worth a person's look; its *how* asks. *Note*:
 * information that may well be intended, stated as a fact and never worded
 * like a fault.
 */
import type { StringKey } from '../i18n/strings'
import type { FindingKind } from './checks'
import type { ConwayFinding } from './conway'

/**
 * What the tree contradicts about itself (`projects/checks.ts`, ADR-0012 §9):
 * the identity of one record across the scopes, a scope's own document, the
 * operating model, and the organisation on a day (ADR-0036).
 */
export const TREE_CHECK_KEYS = [
  'check.conflict', 'check.drift', 'check.dangling', 'check.danglingEnd', 'check.proposal',
  'check.ownedElsewhere', 'check.unattributed', 'check.notDrawn', 'check.drawingLinkMissing',
  'check.unmapped', 'check.uncovered', 'check.offeredNotShared', 'check.causeExplainsObservationBelow',
  'check.accountability', 'check.unitTypeNowhere',
  'check.roleVacant', 'check.roleOverMax', 'check.unitMisplaced', 'check.unitSpans', 'check.unitOverLimit',
  'check.assignmentEnded', 'check.assignmentOrphaned', 'check.unitTypeEnded', 'check.personOverloaded', 'check.unitNotServing',
  'check.reportingLoop', 'check.reportingDangling', 'check.reportingAmbiguous', 'check.reportingVacant',
  'check.scopeTypeDisagrees', 'check.scopeTypeUnserved', 'check.scopeTypeGone',
] as const

/** What the dates contradict (`checks.ts`, ADR-0009): `check.` and the finding's kind. */
export const DATE_CHECK_KEYS = [
  'check.retiresWithDependants', 'check.successorTooLate', 'check.successorMissing', 'check.lineOutlivesEnd',
  'check.platformRetiresFirst', 'check.impliedInterface', 'check.planOverdue',
] as const

/**
 * The Conway map's own (`conway.ts`, ADR-0036 §7). Its fourth, a unit owning
 * more than its type's limit, is the tree's `check.unitOverLimit`: one kind,
 * whichever screen finds it.
 */
export const CONWAY_CHECK_KEYS = ['check.interfaceUndeclared', 'check.interactionUnused', 'check.applicationUnowned'] as const

/**
 * A service nothing delivers, read off the technology rows the organisation's
 * home already counts (`app/organisation/attention.ts`, ADR-0014).
 */
export const TECHNOLOGY_CHECK_KEYS = ['check.unrealised'] as const

/** Every kind of finding, each once, in the order the catalogue lists them. */
export const CHECK_KEYS = [...TREE_CHECK_KEYS, ...DATE_CHECK_KEYS, ...CONWAY_CHECK_KEYS, ...TECHNOLOGY_CHECK_KEYS] as const

export type CheckKey = (typeof CHECK_KEYS)[number]

/** The tree's findings: what `projects/checks.ts` keys a `Finding` by. */
export type TreeCheckKey = (typeof TREE_CHECK_KEYS)[number]

/** Each kind the dates find, as its key. */
export const DATE_CHECK: Record<FindingKind, CheckKey> = {
  retiresWithDependants: 'check.retiresWithDependants',
  successorTooLate: 'check.successorTooLate',
  successorMissing: 'check.successorMissing',
  lineOutlivesEnd: 'check.lineOutlivesEnd',
  platformRetiresFirst: 'check.platformRetiresFirst',
  impliedInterface: 'check.impliedInterface',
  planOverdue: 'check.planOverdue',
}

/** Each kind the Conway map finds, as its key: its over-limit is the tree's. */
export const CONWAY_CHECK: Record<ConwayFinding['kind'], CheckKey> = {
  undeclared: 'check.interfaceUndeclared',
  unused: 'check.interactionUnused',
  unowned: 'check.applicationUnowned',
  overLimit: 'check.unitOverLimit',
}

/** How much a kind matters, in the order every list sorts by. */
export const CHECK_WEIGHTS = ['fix', 'review', 'note'] as const
export type CheckWeight = (typeof CHECK_WEIGHTS)[number]

/** What a kind is about, in the order a page of every check lists them. */
export const CHECK_CATEGORIES = ['landscape', 'plans', 'organisation', 'teams', 'analysis'] as const
export type CheckCategory = (typeof CHECK_CATEGORIES)[number]

/**
 * What can be done about a finding, as ids a screen turns into buttons — each
 * one something a screen does today, and the subject the finding names is
 * what it is done to:
 *
 * - `openElement` — the element it is about, where it is kept;
 * - `openDefinition` — the same record in the other scope it names: the other
 *   definition, or the one that defines it;
 * - `openView` — the view it is in (a drawing);
 * - `openRow` — the row it is about, at the element the row starts from;
 * - `openInterface` — the interface it is about, likewise;
 * - `openPlan` — the plan it is about;
 * - `openUnit` · `openUnits` — the unit, or the two units of an interface or
 *   an interaction;
 * - `openApplication` — the application it is about;
 * - `openType` — the unit type, picked on the operating model's page;
 * - `openOperating` — the responsibility, picked on the operating model's page;
 * - `openPerson` — the person, on the People page;
 * - `openCause` — the cause, on the observations page;
 * - `link` — make the other definition a stand-in of this one (*Link…*);
 * - `acceptInterface` — write the application interface the container lines
 *   imply, and land them on it;
 * - `declareInteraction` · `removeInteraction` — declare how two units work
 *   together, or take a declaration away;
 * - `modelInterface` — the two units' applications, to model the interface
 *   between them from one of them;
 * - `assign` · `endAssignment` — assign someone to the role, or end an
 *   assignment;
 * - `removeAssignment` — take away an assignment whose unit is not there, as
 *   if it had never been made;
 * - `setOwner` — name whose an application is (`partyId`);
 * - `setType` — give the unit another type;
 * - `openScope` — the scope's home, where its type and *Served by* are;
 * - `markShared` — mark the service shared;
 * - `setSuccessor` — name what replaces it.
 */
export const CHECK_ACTIONS = [
  'openElement', 'openDefinition', 'openView', 'openRow', 'openInterface', 'openPlan',
  'openUnit', 'openUnits', 'openApplication', 'openType', 'openOperating', 'openPerson', 'openCause',
  'link', 'acceptInterface', 'declareInteraction', 'removeInteraction', 'modelInterface', 'assign', 'endAssignment',
  'removeAssignment', 'setOwner', 'setType', 'markShared', 'setSuccessor', 'openScope',
] as const
export type CheckAction = (typeof CHECK_ACTIONS)[number]

/** One kind, as a person is told it: the three words are keys of the model's slice. */
export type CheckEntry = {
  /** What it is called, in a list and on its explanation. */
  readonly name: StringKey
  readonly category: CheckCategory
  readonly weight: CheckWeight
  /** Why it matters. */
  readonly why: StringKey
  /** How to fix it: what the actions below do, said for a person. */
  readonly how: StringKey
  /** What fixes it, or opens where it is fixed: first the one most often wanted. */
  readonly actions: readonly CheckAction[]
}

/** A key's kind: `check.conflict` → `conflict`. */
type KindOf<K extends CheckKey> = K extends `check.${infer Kind}` ? Kind : never

/**
 * The words an entry names, each after the kind it is under — so an entry
 * cannot carry another kind's words, and (through {@link CheckEntry}) a key
 * the slice does not have does not compile.
 */
type Said<K extends CheckKey> = {
  readonly name: `check.name.${KindOf<K>}`
  readonly why: `check.why.${KindOf<K>}`
  readonly how: `check.how.${KindOf<K>}`
}

const ENTRIES = {
  // --- the landscape ------------------------------------------------------
  'check.conflict': {
    name: 'check.name.conflict', why: 'check.why.conflict', how: 'check.how.conflict',
    category: 'landscape', weight: 'fix', actions: ['link', 'openElement', 'openDefinition'],
  },
  'check.drift': {
    name: 'check.name.drift', why: 'check.why.drift', how: 'check.how.drift',
    category: 'landscape', weight: 'review', actions: ['openElement', 'openDefinition'],
  },
  'check.dangling': {
    name: 'check.name.dangling', why: 'check.why.dangling', how: 'check.how.dangling',
    category: 'landscape', weight: 'fix', actions: ['openElement'],
  },
  'check.danglingEnd': {
    name: 'check.name.danglingEnd', why: 'check.why.danglingEnd', how: 'check.how.danglingEnd',
    category: 'landscape', weight: 'fix', actions: ['openRow'],
  },
  'check.proposal': {
    name: 'check.name.proposal', why: 'check.why.proposal', how: 'check.how.proposal',
    category: 'landscape', weight: 'note', actions: ['openElement'],
  },
  'check.ownedElsewhere': {
    name: 'check.name.ownedElsewhere', why: 'check.why.ownedElsewhere', how: 'check.how.ownedElsewhere',
    category: 'landscape', weight: 'review', actions: ['openDefinition', 'openElement'],
  },
  'check.unattributed': {
    name: 'check.name.unattributed', why: 'check.why.unattributed', how: 'check.how.unattributed',
    category: 'landscape', weight: 'review', actions: ['setOwner', 'openElement'],
  },
  'check.notDrawn': {
    name: 'check.name.notDrawn', why: 'check.why.notDrawn', how: 'check.how.notDrawn',
    category: 'landscape', weight: 'note', actions: ['openElement'],
  },
  'check.drawingLinkMissing': {
    name: 'check.name.drawingLinkMissing', why: 'check.why.drawingLinkMissing', how: 'check.how.drawingLinkMissing',
    category: 'landscape', weight: 'fix', actions: ['openView'],
  },
  'check.unmapped': {
    name: 'check.name.unmapped', why: 'check.why.unmapped', how: 'check.how.unmapped',
    category: 'landscape', weight: 'review', actions: ['openElement'],
  },
  'check.uncovered': {
    name: 'check.name.uncovered', why: 'check.why.uncovered', how: 'check.how.uncovered',
    category: 'landscape', weight: 'review', actions: ['openElement'],
  },
  // Information in the first pass; a review here, because ADR-0014 calls it
  // a conversation the maintainer has to have, and the register draws it as
  // a warning beside a conflict.
  'check.offeredNotShared': {
    name: 'check.name.offeredNotShared', why: 'check.why.offeredNotShared', how: 'check.how.offeredNotShared',
    category: 'landscape', weight: 'review', actions: ['markShared', 'openElement'],
  },
  'check.impliedInterface': {
    name: 'check.name.impliedInterface', why: 'check.why.impliedInterface', how: 'check.how.impliedInterface',
    category: 'landscape', weight: 'review', actions: ['acceptInterface', 'openElement'],
  },
  'check.unrealised': {
    name: 'check.name.unrealised', why: 'check.why.unrealised', how: 'check.how.unrealised',
    category: 'landscape', weight: 'review', actions: ['openElement'],
  },
  // --- plans and dates ----------------------------------------------------
  'check.retiresWithDependants': {
    name: 'check.name.retiresWithDependants', why: 'check.why.retiresWithDependants', how: 'check.how.retiresWithDependants',
    category: 'plans', weight: 'review', actions: ['openElement'],
  },
  'check.successorTooLate': {
    name: 'check.name.successorTooLate', why: 'check.why.successorTooLate', how: 'check.how.successorTooLate',
    category: 'plans', weight: 'fix', actions: ['openElement'],
  },
  'check.successorMissing': {
    name: 'check.name.successorMissing', why: 'check.why.successorMissing', how: 'check.how.successorMissing',
    category: 'plans', weight: 'review', actions: ['setSuccessor', 'openElement'],
  },
  'check.lineOutlivesEnd': {
    name: 'check.name.lineOutlivesEnd', why: 'check.why.lineOutlivesEnd', how: 'check.how.lineOutlivesEnd',
    category: 'plans', weight: 'fix', actions: ['openRow'],
  },
  'check.platformRetiresFirst': {
    name: 'check.name.platformRetiresFirst', why: 'check.why.platformRetiresFirst', how: 'check.how.platformRetiresFirst',
    category: 'plans', weight: 'fix', actions: ['openElement'],
  },
  'check.planOverdue': {
    name: 'check.name.planOverdue', why: 'check.why.planOverdue', how: 'check.how.planOverdue',
    category: 'plans', weight: 'review', actions: ['openPlan'],
  },
  // --- the organisation ---------------------------------------------------
  'check.accountability': {
    name: 'check.name.accountability', why: 'check.why.accountability', how: 'check.how.accountability',
    category: 'organisation', weight: 'review', actions: ['openOperating'],
  },
  'check.unitTypeNowhere': {
    name: 'check.name.unitTypeNowhere', why: 'check.why.unitTypeNowhere', how: 'check.how.unitTypeNowhere',
    category: 'organisation', weight: 'fix', actions: ['openType'],
  },
  'check.roleVacant': {
    name: 'check.name.roleVacant', why: 'check.why.roleVacant', how: 'check.how.roleVacant',
    category: 'organisation', weight: 'review', actions: ['assign', 'openUnit', 'openType'],
  },
  'check.roleOverMax': {
    name: 'check.name.roleOverMax', why: 'check.why.roleOverMax', how: 'check.how.roleOverMax',
    category: 'organisation', weight: 'review', actions: ['openUnit', 'openType'],
  },
  'check.unitMisplaced': {
    name: 'check.name.unitMisplaced', why: 'check.why.unitMisplaced', how: 'check.how.unitMisplaced',
    category: 'organisation', weight: 'fix', actions: ['openUnit', 'setType', 'openType'],
  },
  'check.unitSpans': {
    name: 'check.name.unitSpans', why: 'check.why.unitSpans', how: 'check.how.unitSpans',
    category: 'organisation', weight: 'review', actions: ['openUnit', 'openType'],
  },
  'check.unitOverLimit': {
    name: 'check.name.unitOverLimit', why: 'check.why.unitOverLimit', how: 'check.how.unitOverLimit',
    category: 'organisation', weight: 'review', actions: ['openUnit', 'openType'],
  },
  'check.assignmentEnded': {
    name: 'check.name.assignmentEnded', why: 'check.why.assignmentEnded', how: 'check.how.assignmentEnded',
    category: 'organisation', weight: 'fix', actions: ['endAssignment', 'openUnit'],
  },
  // A unit deleted is a correction (ADR-0036, amended 12 October 2026): an
  // assignment it left behind is one too, removed rather than ended.
  'check.assignmentOrphaned': {
    name: 'check.name.assignmentOrphaned', why: 'check.why.assignmentOrphaned', how: 'check.how.assignmentOrphaned',
    category: 'organisation', weight: 'fix', actions: ['removeAssignment', 'openPerson'],
  },
  'check.unitTypeEnded': {
    name: 'check.name.unitTypeEnded', why: 'check.why.unitTypeEnded', how: 'check.how.unitTypeEnded',
    category: 'organisation', weight: 'fix', actions: ['setType', 'openUnit', 'openType'],
  },
  'check.personOverloaded': {
    name: 'check.name.personOverloaded', why: 'check.why.personOverloaded', how: 'check.how.personOverloaded',
    category: 'organisation', weight: 'review', actions: ['openPerson'],
  },
  'check.unitNotServing': {
    name: 'check.name.unitNotServing', why: 'check.why.unitNotServing', how: 'check.how.unitNotServing',
    category: 'organisation', weight: 'review', actions: ['openUnit', 'openElement'],
  },
  // A reporting line (ADR-0039 §6): about the unit the line runs from.
  'check.reportingLoop': {
    name: 'check.name.reportingLoop', why: 'check.why.reportingLoop', how: 'check.how.reportingLoop',
    category: 'organisation', weight: 'fix', actions: ['openUnit', 'openType'],
  },
  'check.reportingDangling': {
    name: 'check.name.reportingDangling', why: 'check.why.reportingDangling', how: 'check.how.reportingDangling',
    category: 'organisation', weight: 'fix', actions: ['openUnit', 'openType'],
  },
  'check.reportingAmbiguous': {
    name: 'check.name.reportingAmbiguous', why: 'check.why.reportingAmbiguous', how: 'check.how.reportingAmbiguous',
    category: 'organisation', weight: 'fix', actions: ['openUnit', 'openType'],
  },
  // A scope's type against the units that serve it (ADR-0036, amended 17 October 2026): about the scope.
  'check.scopeTypeDisagrees': {
    name: 'check.name.scopeTypeDisagrees', why: 'check.why.scopeTypeDisagrees', how: 'check.how.scopeTypeDisagrees',
    category: 'organisation', weight: 'review', actions: ['openScope', 'openUnit'],
  },
  'check.scopeTypeUnserved': {
    name: 'check.name.scopeTypeUnserved', why: 'check.why.scopeTypeUnserved', how: 'check.how.scopeTypeUnserved',
    category: 'organisation', weight: 'note', actions: ['openScope'],
  },
  'check.scopeTypeGone': {
    name: 'check.name.scopeTypeGone', why: 'check.why.scopeTypeGone', how: 'check.how.scopeTypeGone',
    category: 'organisation', weight: 'fix', actions: ['openScope', 'openType'],
  },
  'check.reportingVacant': {
    name: 'check.name.reportingVacant', why: 'check.why.reportingVacant', how: 'check.how.reportingVacant',
    category: 'organisation', weight: 'review', actions: ['openUnit', 'assign'],
  },
  // --- teams and systems --------------------------------------------------
  'check.interfaceUndeclared': {
    name: 'check.name.interfaceUndeclared', why: 'check.why.interfaceUndeclared', how: 'check.how.interfaceUndeclared',
    category: 'teams', weight: 'review', actions: ['declareInteraction', 'openInterface', 'openUnits'],
  },
  'check.interactionUnused': {
    name: 'check.name.interactionUnused', why: 'check.why.interactionUnused', how: 'check.how.interactionUnused',
    category: 'teams', weight: 'note', actions: ['removeInteraction', 'modelInterface', 'openUnits'],
  },
  'check.applicationUnowned': {
    name: 'check.name.applicationUnowned', why: 'check.why.applicationUnowned', how: 'check.how.applicationUnowned',
    category: 'teams', weight: 'review', actions: ['setOwner', 'openApplication'],
  },
  // --- analysis -----------------------------------------------------------
  // Information in the first pass; a review here, because ADR-0032 §9 names
  // the repair and no new link of the kind can be made: nobody intends one.
  'check.causeExplainsObservationBelow': {
    name: 'check.name.causeExplainsObservationBelow', why: 'check.why.causeExplainsObservationBelow',
    how: 'check.how.causeExplainsObservationBelow',
    category: 'analysis', weight: 'review', actions: ['openCause'],
  },
} satisfies { readonly [K in CheckKey]: Said<K> & Pick<CheckEntry, 'category' | 'weight' | 'actions'> }

/** Every kind's entry. */
export const CHECK_CATALOGUE: Readonly<Record<CheckKey, CheckEntry>> = ENTRIES

/** What each weight is called, and what it means in a line, for a legend. */
export const CHECK_WEIGHT_LABEL: Record<CheckWeight, { name: StringKey; about: StringKey }> = {
  fix: { name: 'check.weight.fix', about: 'check.weight.fix.about' },
  review: { name: 'check.weight.review', about: 'check.weight.review.about' },
  note: { name: 'check.weight.note', about: 'check.weight.note.about' },
}

/** What each category is called. */
export const CHECK_CATEGORY_LABEL: Record<CheckCategory, StringKey> = {
  landscape: 'check.category.landscape',
  plans: 'check.category.plans',
  organisation: 'check.category.organisation',
  teams: 'check.category.teams',
  analysis: 'check.category.analysis',
}

/** What each action's button says. */
export const CHECK_ACTION_LABEL: Record<CheckAction, StringKey> = {
  openElement: 'check.action.openElement',
  openDefinition: 'check.action.openDefinition',
  openView: 'check.action.openView',
  openRow: 'check.action.openRow',
  openInterface: 'check.action.openInterface',
  openPlan: 'check.action.openPlan',
  openUnit: 'check.action.openUnit',
  openUnits: 'check.action.openUnits',
  openApplication: 'check.action.openApplication',
  openType: 'check.action.openType',
  openOperating: 'check.action.openOperating',
  openPerson: 'check.action.openPerson',
  openCause: 'check.action.openCause',
  link: 'check.action.link',
  acceptInterface: 'check.action.acceptInterface',
  declareInteraction: 'check.action.declareInteraction',
  removeInteraction: 'check.action.removeInteraction',
  modelInterface: 'check.action.modelInterface',
  assign: 'check.action.assign',
  endAssignment: 'check.action.endAssignment',
  removeAssignment: 'check.action.removeAssignment',
  setOwner: 'check.action.setOwner',
  setType: 'check.action.setType',
  markShared: 'check.action.markShared',
  setSuccessor: 'check.action.setSuccessor',
  openScope: 'check.action.openScope',
}

/**
 * Everything a list of findings says besides the findings: the weights, the
 * categories and the actions as above, and the list's own few words — how
 * many there are to look at and how many notes, *Show notes (N)*, the two
 * headings of an explanation and the way back from one. One table, handed to
 * the list wherever it is drawn (`widgets/FindingsList`), which may not read
 * the model itself.
 */
export const CHECK_LIST_WORDS = {
  weight: CHECK_WEIGHT_LABEL,
  category: CHECK_CATEGORY_LABEL,
  action: CHECK_ACTION_LABEL,
  toLookAt: 'check.list.toLookAt',
  notes: { one: 'check.list.notes.one', other: 'check.list.notes.other' },
  showNotes: 'check.list.showNotes',
  why: 'check.list.why',
  how: 'check.list.how',
  back: 'check.list.back',
} as const satisfies {
  weight: Record<CheckWeight, { name: StringKey; about: StringKey }>
  category: Record<CheckCategory, StringKey>
  action: Record<CheckAction, StringKey>
  toLookAt: StringKey
  notes: { one: StringKey; other: StringKey }
  showNotes: StringKey
  why: StringKey
  how: StringKey
  back: StringKey
}

const KNOWN: ReadonlySet<string> = new Set(CHECK_KEYS)

/** Whether a key is one of the catalogue's: a finding read structurally carries a plain string. */
export function isCheckKey(key: string): key is CheckKey {
  return KNOWN.has(key)
}

/** A kind's entry, for a key read as a plain string; absent for one the catalogue does not know. */
export function checkEntry(key: string): CheckEntry | undefined {
  return isCheckKey(key) ? CHECK_CATALOGUE[key] : undefined
}

/** One check's findings in a list: the kind, its entry, and the findings of it in the order they came. */
export type CheckGroup<F> = {
  key: CheckKey
  entry: CheckEntry
  weight: CheckWeight
  category: CheckCategory
  findings: F[]
  count: number
}

const RANK: Readonly<Record<CheckWeight, number>> = { fix: 0, review: 1, note: 2 }

/**
 * Findings grouped by check: fix, then review, then note, and within a weight
 * in the order each check's first finding came — so a list keeps the order
 * the place that found them gave, which is the one it means (ADR-0036,
 * amended 11 October 2026). A finding's key is its own `key`, or what `keyOf`
 * says for one keyed by a kind (`DATE_CHECK`, `CONWAY_CHECK`).
 */
export function groupByCheck<F extends { key: CheckKey }>(findings: readonly F[]): CheckGroup<F>[]
export function groupByCheck<F>(findings: readonly F[], keyOf: (finding: F) => CheckKey): CheckGroup<F>[]
export function groupByCheck<F>(findings: readonly F[], keyOf?: (finding: F) => CheckKey): CheckGroup<F>[] {
  const of = keyOf ?? ((finding: F) => (finding as { key: CheckKey }).key)
  const groups = new Map<CheckKey, CheckGroup<F>>()
  for (const finding of findings) {
    const key = of(finding)
    const held = groups.get(key)
    if (held) {
      held.findings.push(finding)
      held.count += 1
      continue
    }
    const entry = CHECK_CATALOGUE[key]
    groups.set(key, { key, entry, weight: entry.weight, category: entry.category, findings: [finding], count: 1 })
  }
  // A stable sort, so the order of arrival holds within a weight.
  return [...groups.values()].sort((a, b) => RANK[a.weight] - RANK[b.weight])
}

/** How many findings of each weight the groups hold: what *Show notes (N)* and a count by weight say. */
export function countByWeight(groups: readonly Pick<CheckGroup<unknown>, 'weight' | 'count'>[]): Record<CheckWeight, number> {
  const counted: Record<CheckWeight, number> = { fix: 0, review: 0, note: 0 }
  for (const group of groups) counted[group.weight] += group.count
  return counted
}
