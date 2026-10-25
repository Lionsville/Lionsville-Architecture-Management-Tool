// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What every kind of record says about itself to a search (ADR-0029).
 *
 * The search was written when a scope held elements, their pages and its
 * decision records, and it named those three itself. Plans, views,
 * observations, causes, solutions and experiments arrived afterwards, each
 * with its own list on the model and its own page, and none of them was ever
 * told to the search — so ⌘K could not find an observation, and the agent's
 * `search` bolted the plans on beside it.
 *
 * So the knowledge moves here, beside the kinds, and the search keeps none
 * of its own: each list a scope holds — every key of `ModelOrder` — declares
 * what a hit on one of its records is called, which of its words are matched,
 * which of them are prose, and which page it opens on. The table is typed
 * over those keys, so a list added to the model without a line here does not
 * compile, and `searchable.test.ts` says the same thing at run time over a
 * model that holds one of everything.
 *
 * A declaration is a function from a record to plain data. The search folds
 * that data once per record and keeps it for as long as the record object
 * lives, which is what makes an edit re-fold one record rather than the scope
 * (ADR-0002: a command touches the path it names).
 *
 * **A person is matched by id** (ADR-0036 §8). A name field that holds a
 * person picked from the register says the id in `people` and nothing in its
 * words, so no index built from these records ever holds a register name; the
 * search asks the register which ids a query's words name, and then the
 * records that point at them. Text typed into a name field is a word like any
 * other, and so is the name a signature kept.
 *
 * Pure, and the model's: the pages a hit opens on are words here, and the
 * shell maps them onto its own screens.
 */
import type { Adr } from './adr'
import type { Citation } from './citable'
import type { Evaluation } from './evaluation'
import type { Principle } from './principle'
import type { Comment } from './comment'
import type { CommentableKind } from './commentable'
import type { PersonId, PersonRef } from './person'
import { personIdOf, refText } from './person'
import type { ModelOrder } from './normalised'
import type { Cause, Experiment, Observation, Solution } from './observation'
import type { OperatingRule, Responsibility, Role, UnitType } from './operatingModel'
import type { Transition } from './transition'
import type { Assignment } from './units'
import type { CheckMark } from './checkMarks'
import { drawingProse } from './drawing'
import type { DesignDiagram, DesignElement, ElementKind, Relation } from './types'

/**
 * What a hit is, as a person reads it: one heading each in the search, and
 * the `kind` the agent's `search` answers with. An element is one kind with
 * its element kind beside it — an application, a platform service — because
 * the headings would otherwise be eight, most of them empty.
 */
export const SEARCH_KINDS = [
  'element', 'documentation', 'view', 'relation', 'decision', 'plan', 'milestone',
  'observation', 'cause', 'solution', 'experiment',
  'unitType', 'role', 'responsibility', 'comment', 'principle',
] as const

export type SearchKind = (typeof SEARCH_KINDS)[number]

/**
 * Where a hit opens: a page of the scope that holds it, and the record on it.
 * The same words as the shell's own destinations, a subset of them — the
 * shell checks that they still are.
 */
export type SearchPage =
  | 'element' | 'document' | 'board' | 'sheet' | 'map' | 'technology' | 'drawing' | 'chart' | 'conway'
  | 'decisions' | 'plan' | 'observations' | 'operating' | 'principles'

export type SearchPlace = { readonly page: SearchPage; readonly id: string }

/** What one record says about itself. Plain data: the search folds it and keeps it. */
export type SearchRecord = {
  /** Unique within its kind and its scope. */
  readonly id: string
  /** What the row is called. Matched, and a title that starts with the query ranks first. */
  readonly title: string
  /** Matched besides the title, and shown under it where the row says so. */
  readonly fields: readonly (string | undefined)[]
  /** Prose: matched, and quoted around the match when the title did not match. */
  readonly prose?: string
  /** `OB-0007`: what people call it, where its kind numbers its records. */
  readonly label?: string
  /** The status word, untranslated; the screen has the tables for it. */
  readonly status?: string
  /** A kind within the kind: the element's kind, the view's. */
  readonly variant?: string
  /** A line of plain words under the title: category · vendor · technology, a date. */
  readonly detail?: string
  /** The elements it is about, by id, for the row to name. */
  readonly about?: readonly string[]
  /**
   * The people it names, by register id: matched through the register, so
   * the name itself is never folded beside the record (ADR-0036 §8).
   */
  readonly people?: readonly PersonId[]
  /**
   * The people whose signature on it kept their name, by register id: matched
   * through the register while the entry has its name, and not once it is
   * forgotten or gone (`PeopleMatch.apart`) — then only the name as signed,
   * among its fields, finds it.
   */
  readonly signed?: readonly PersonId[]
  readonly opens: SearchPlace
}

export type Searchable<R> = {
  readonly kind: SearchKind
  /**
   * `name`: the records sorted by title, so the first eight in name order
   * stop the scan — a landscape's elements. `file`: the scope's own order,
   * which for a numbered record is its number.
   */
  readonly order: 'name' | 'file'
  /**
   * Only the prose is matched. An element's page is its own kind of hit,
   * beside the element's: a name match is the element, a paragraph match is
   * the page, and they answer different questions.
   */
  readonly proseOnly?: true
  /** What this record says; nothing when it has nothing of this kind to say. */
  readonly describe: (record: R) => SearchRecord | readonly SearchRecord[] | undefined
}

/** The record each list of the model holds. Keyed as `ModelOrder` is, and checked to be. */
export type SearchableRecords = {
  elements: DesignElement
  relations: Relation
  diagrams: DesignDiagram
  decisions: Adr
  transitions: Transition
  observations: Observation
  causes: Cause
  solutions: Solution
  experiments: Experiment
  unitTypes: UnitType
  roles: Role
  responsibilities: Responsibility
  operatingRules: OperatingRule
  assignments: Assignment
  checkMarks: CheckMark
  comments: Comment
  principles: Principle
  citations: Citation
  evaluations: Evaluation
}

/** A scope's lists, as whoever read it has them: every one optional, a thin read has some. */
export type SearchableModel = { readonly [K in keyof ModelOrder]?: readonly SearchableRecords[K][] }

export type SearchTable = { readonly [K in keyof ModelOrder]: readonly Searchable<SearchableRecords[K]>[] }

// A list on `SearchableRecords` that the model does not have is a line nobody
// reads; this is the other half of the check `SearchTable` makes.
type Exactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never
const KEYS_MATCH: Exactly<keyof SearchableRecords, keyof ModelOrder> = true
void KEYS_MATCH

/** The register ids among some references, in order and once each; nothing where none is picked. */
function peopleIn(...refs: readonly (PersonRef | undefined)[]): { people?: readonly PersonId[] } {
  const ids = [...new Set(refs.map(personIdOf).filter((id): id is PersonId => id !== undefined))]
  return ids.length ? { people: ids } : {}
}

/** The register ids among the references whose signature kept a name; nothing where none did. */
function signedIn(...refs: readonly (PersonRef | undefined)[]): { signed?: readonly PersonId[] } {
  const { people } = peopleIn(...refs)
  return people ? { signed: people } : {}
}

function numbered(prefix: string, number: number): string {
  return `${prefix}-${String(Math.max(0, Math.trunc(number))).padStart(4, '0')}`
}

const VIEW_PAGE: Record<DesignDiagram['kind'], SearchPage> = {
  layer7: 'board', container: 'board', sheet: 'sheet', map: 'map', technology: 'technology',
  // A drawing opens as its own view, the same way a sheet does, and so do
  // the organisation chart and the Conway map (ADR-0036 §7).
  drawing: 'drawing', chart: 'chart', conway: 'conway',
}

const element: Searchable<DesignElement> = {
  kind: 'element',
  order: 'name',
  describe: (e) => ({
    id: e.id,
    title: e.name,
    fields: [e.category, e.vendor, e.technology, refText(e.owner)],
    ...peopleIn(e.owner),
    variant: e.kind satisfies ElementKind,
    detail: [e.category, e.vendor, e.technology].filter(Boolean).join(' · ') || undefined,
    opens: { page: 'element', id: e.id },
  }),
}

const documentation: Searchable<DesignElement> = {
  kind: 'documentation',
  order: 'name',
  proseOnly: true,
  describe: (e) => (e.description
    ? { id: e.id, title: e.name, fields: [], prose: e.description, variant: e.kind, opens: { page: 'document', id: e.id } }
    : undefined),
}

const relation: Searchable<Relation> = {
  kind: 'relation',
  order: 'file',
  describe: (r) => ({
    id: r.id,
    title: r.label ?? '',
    fields: [r.protocol, r.technology],
    variant: r.type,
    detail: [r.protocol, r.technology].filter(Boolean).join(' · ') || undefined,
    about: [r.sourceId, r.targetId],
    // A line has no page of its own: it opens on the box it leaves.
    opens: { page: 'element', id: r.sourceId },
  }),
}

const view: Searchable<DesignDiagram> = {
  kind: 'view',
  order: 'name',
  describe: (d) => {
    const prose = d.kind === 'drawing' ? drawingProse(d.drawing?.xml ?? '') : ''
    return {
      id: d.id,
      title: d.name,
      fields: [d.author, d.client],
      ...(prose ? { prose } : {}),
      variant: d.kind,
      opens: { page: VIEW_PAGE[d.kind], id: d.id },
    }
  },
}

const decision: Searchable<Adr> = {
  kind: 'decision',
  order: 'file',
  describe: (adr) => ({
    id: adr.id,
    title: adr.title,
    // A signature's name as signed is the record's, and found as it is (ADR-0036 §8).
    fields: [
      ...adr.signers.flatMap((signer) => [refText(signer.name), signer.signedAs]),
      refText(adr.proposedBy), adr.proposedAs,
    ],
    // A reference that kept a name is a signature: found by the register only while its entry has a name.
    ...peopleIn(...adr.signers.filter((signer) => signer.signedAs === undefined).map((signer) => signer.name), ...(adr.proposedAs === undefined ? [adr.proposedBy] : [])),
    ...signedIn(...adr.signers.filter((signer) => signer.signedAs !== undefined).map((signer) => signer.name), ...(adr.proposedAs !== undefined ? [adr.proposedBy] : [])),
    prose: adr.body,
    label: numbered('ADR', adr.number),
    status: adr.status,
    about: adr.subjectId ? [adr.subjectId] : [],
    opens: { page: 'decisions', id: adr.id },
  }),
}

const plan: Searchable<Transition> = {
  kind: 'plan',
  order: 'file',
  describe: (tr) => ({
    id: tr.id,
    title: tr.title,
    fields: [refText(tr.owner)],
    ...peopleIn(tr.owner),
    prose: tr.body,
    label: numbered('TR', tr.number),
    status: tr.status,
    detail: [tr.from, tr.to].filter(Boolean).join(' – ') || undefined,
    opens: { page: 'plan', id: tr.id },
  }),
}

/** A milestone is a line of its plan, and opens on it. */
const milestone: Searchable<Transition> = {
  kind: 'milestone',
  order: 'file',
  describe: (tr) => tr.milestones.map((one, at) => ({
    id: `${tr.id}#${at}`,
    title: one.name,
    fields: [],
    label: numbered('TR', tr.number),
    detail: `${one.date} · ${tr.title}`,
    opens: { page: 'plan', id: tr.id },
  })),
}

const observation: Searchable<Observation> = {
  kind: 'observation',
  order: 'file',
  describe: (ob) => ({
    id: ob.id,
    title: ob.title,
    fields: [ob.where, refText(ob.by)],
    ...peopleIn(ob.by),
    prose: ob.body,
    label: numbered('OB', ob.number),
    status: ob.archived ? 'archived' : ob.impact,
    detail: [ob.date, ob.where].filter(Boolean).join(' · ') || undefined,
    opens: { page: 'observations', id: ob.id },
  }),
}

const cause: Searchable<Cause> = {
  kind: 'cause',
  order: 'file',
  describe: (ca) => ({
    id: ca.id,
    title: ca.title,
    fields: [],
    prose: ca.body,
    label: numbered(ca.root ? 'RC' : 'CA', ca.number),
    status: ca.state,
    opens: { page: 'observations', id: ca.id },
  }),
}

const solution: Searchable<Solution> = {
  kind: 'solution',
  order: 'file',
  describe: (so) => ({
    id: so.id,
    title: so.title,
    fields: [...so.validatedWith, so.whyNow, so.dropNote, so.waived],
    prose: so.body,
    label: numbered('SO', so.number),
    status: so.state,
    opens: { page: 'observations', id: so.id },
  }),
}

const experiment: Searchable<Experiment> = {
  kind: 'experiment',
  order: 'file',
  describe: (ex) => ({
    id: ex.id,
    title: ex.title,
    fields: [ex.hypothesis, ex.measure, ex.where, refText(ex.by), ex.result],
    ...peopleIn(ex.by),
    prose: ex.body,
    label: numbered('EX', ex.number),
    status: ex.outcome,
    opens: { page: 'observations', id: ex.id },
  }),
}

/**
 * The operating model (ADR-0036): found by what the organisation calls each
 * item and what it wrote about it, opened on the operating model's page.
 */
const unitType: Searchable<UnitType> = {
  kind: 'unitType',
  order: 'name',
  describe: (type) => ({
    id: type.id, title: type.name, fields: [], prose: type.purpose, opens: { page: 'operating', id: type.id },
  }),
}

const role: Searchable<Role> = {
  kind: 'role',
  order: 'name',
  describe: (held) => ({
    id: held.id, title: held.name, fields: [held.short], prose: held.purpose, opens: { page: 'operating', id: held.id },
  }),
}

const responsibility: Searchable<Responsibility> = {
  kind: 'responsibility',
  order: 'name',
  describe: (held) => ({
    id: held.id, title: held.name, fields: [held.group], prose: held.description,
    ...(held.group ? { detail: held.group } : {}),
    opens: { page: 'operating', id: held.id },
  }),
}

/** The page a record commented on opens on: the page of its kind. */
const COMMENTED_PAGE: Record<CommentableKind, SearchPage> = {
  observation: 'observations', cause: 'observations', solution: 'observations', experiment: 'observations',
  element: 'element', decision: 'decisions', transition: 'plan', principle: 'principles',
}

/** A comment's first line, as short as a title is: what a hit on it reads as. */
function firstLine(body: string): string {
  const line = body.split('\n').map((one) => one.trim()).find((one) => one !== '') ?? ''
  return line.length > 80 ? `${line.slice(0, 79)}…` : line
}

/**
 * A comment (ADR-0037 §7): found by what it says and by its author, through
 * the register, and opened on the reader of the record it is about. A removed
 * comment says nothing: its tombstone is in the thread, not in a search.
 */
const comment: Searchable<Comment> = {
  kind: 'comment',
  order: 'file',
  describe: (held) => (held.removed || !(held.about.kind in COMMENTED_PAGE) ? undefined : {
    id: held.id,
    title: firstLine(held.body),
    fields: [],
    prose: held.body,
    ...peopleIn(held.by),
    detail: held.at.slice(0, 10),
    ...(held.about.kind === 'element' ? { about: [held.about.id] } : {}),
    opens: { page: COMMENTED_PAGE[held.about.kind as CommentableKind], id: held.about.id },
  }),
}

/**
 * A principle (ADR-0041 §12): found by its number and its aspects' numbers,
 * by its words and its aspects' words, and by its keywords; opened on the
 * principles page. One absorbed by another is history, found by the survivor.
 */
const principle: Searchable<Principle> = {
  kind: 'principle',
  order: 'file',
  describe: (held) => (held.mergedInto !== undefined ? undefined : {
    id: held.id,
    title: held.title,
    fields: [
      ...held.aspects.map((one) => `${numbered('PR', held.number)}.${one.number} ${one.text}`),
      ...(held.keywords ?? []),
    ],
    prose: [held.statement, held.rationale, held.implications].filter(Boolean).join('\n\n'),
    label: numbered('PR', held.number),
    status: held.status,
    detail: held.regime,
    opens: { page: 'principles', id: held.id },
  }),
}

/**
 * Every list a scope holds, and what its records say to a search. One line
 * per list; a list with two kinds of hit — an element and its page, a plan
 * and its milestones — names both.
 */
export const SEARCHABLE: SearchTable = {
  elements: [element, documentation],
  relations: [relation],
  diagrams: [view],
  decisions: [decision],
  transitions: [plan, milestone],
  observations: [observation],
  causes: [cause],
  solutions: [solution],
  experiments: [experiment],
  unitTypes: [unitType],
  roles: [role],
  responsibilities: [responsibility],
  // A rule names a role and says nothing a person would search for.
  operatingRules: [],
  // An assignment holds ids and a share: the person is found in the register
  // and the unit as an element, and nothing here would be a third way to them.
  assignments: [],
  // A mark is about a finding, which is worked out and never stored: there is
  // no record of it to open, and its reason is found on the Checks page.
  checkMarks: [],
  comments: [comment],
  principles: [principle],
  // A citation is found where it is drawn, on the record that cites and on the principle.
  citations: [],
  // An evaluation is found on its block, where its grid is drawn.
  evaluations: [],
}

/** The lists, in the order the search reads them and a list of hits is headed. */
export const SEARCHABLE_LISTS = Object.keys(SEARCHABLE) as (keyof ModelOrder)[]
