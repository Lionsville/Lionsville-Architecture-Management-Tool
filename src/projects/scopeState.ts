// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's state, and the steps that change it (ADR-0031 §1).
 *
 * The words every repository speaks, and the one piece of arithmetic every
 * implementation of them shares: applying steps to a state.
 *
 * **A scope has an address and an identity.** The address is where it sits in
 * the tree, `acme/rail`, which is how people and links name it; a move changes
 * it. The identity is an id a move does not change, which is what a history,
 * an image library and a scope's settings follow. The two are never the same
 * value, and nothing may read one as the other.
 *
 * **A revision is opaque.** The repository's own word for the state it answered
 * with, compared for equality and nothing else: not ordered, not parsed, not
 * counted. Handed back as what a step expects to change, it is how two authors
 * find out that one of them moved the scope under the other.
 *
 * **Every write to a scope's state is a step** (ADR-0002): one command, made by
 * a session at a moment, with an id so it lands once however often it is sent.
 * A step's command is the model's own `Command`, applied by the one reducer
 * (`model/reducer.ts`), or one of the two the model does not hold yet: a change
 * to the image library, and a change to what a scope says about itself. They
 * are shaped as the model's commands are — a `type` and what it carries — so
 * a step is one vocabulary to whoever reads a log of them.
 */
import type { StringKey } from '../i18n/strings'
import type { UploadedLogo } from '../model'
import type { Command } from '../model/commands'
import type { HostModel } from '../model/hostModel'
import { imageNameRefusal } from '../model/imageName'
import type { ImageEntry, ImageName } from '../model/imageName'
import { fromArrays, toArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import { recordsOf, SCOPE_RECORD, sameRecord } from '../model/recordKey'
import type { RecordKey, RecordKind } from '../model/recordKey'
import { apply } from '../model/reducer'
import type { CommandRefusal } from '../model/reducer'
import type { RecordLink } from './links'
import { isScopeKind } from './scope'
import type { ScopeKind } from './scope'
import type { ScopePath } from './scopePath'

/** Where a scope sits in the tree: the organisation is `''`, a scope under it `acme`. */
export type ScopeAddress = ScopePath

/** What a scope is, whatever its address: minted when it is created, kept through every move. */
export type ScopeId = string

/** A repository's word for a state it answered with. Compared for equality, never read. */
export type Revision = string

/**
 * What a scope says about itself, beside its model: the words a screen shows
 * about it, and the view and marks it opens with. Its name is the model's
 * (`model.name`), because there is one name.
 */
export type ScopeDescription = {
  /** A label for a screen, never a branch (`ScopeKind`). */
  kind?: ScopeKind
  /** Who a drawing made here is addressed to, where that is not the scope's own name. */
  client?: string
  links?: RecordLink[]
  /** The view the scope opens on. */
  activeDiagramId?: string
  /** The marks uploaded here, for the cards that carry them. */
  logoLibrary?: UploadedLogo[]
}

const DESCRIPTION_KEYS: Record<keyof ScopeDescription, true> = {
  kind: true, client: true, links: true, activeDiagramId: true, logoLibrary: true,
}

/** The part of a scope's state its steps change. */
export type ScopeContent = ScopeDescription & {
  /** The records and documents: every element with its description, every view, decision and plan. */
  model: HostModel
  /** The image library: every picture's entry, never its bytes. */
  images: readonly ImageEntry[]
}

/** One scope, as a repository answers for it. */
export type ScopeState = ScopeContent & {
  id: ScopeId
  address: ScopeAddress
  revision: Revision
  /** ISO time of the last step applied to it, where the repository keeps one. */
  updatedAt?: string
  /**
   * What of this scope the repository could not read, in its own words, for a
   * person to be told. A scope with any is there to be looked at: every step
   * on it is refused, because a state that was not read whole is not a state
   * a step can be applied to without losing what was not read.
   */
  unreadable?: readonly string[]
}

/** A picture put into, or taken out of, the library. The bytes go through `ImageRepository` first. */
export type ImageCommand =
  | { type: 'image.add'; image: ImageEntry }
  | { type: 'image.remove'; name: ImageName }

/** A change to what a scope says about itself. A key present with `undefined` clears it, as a model patch does. */
export type DescribeCommand = { type: 'scope.describe'; patch: ScopeDescription }

/** Everything a step may carry. */
export type ScopeCommand = Command | ImageCommand | DescribeCommand

/**
 * One step, on its way to a scope.
 *
 * The same `stepId` and `at` a session gives a step it publishes
 * (`ports/CommandChannel.ts`): minted by whoever made it, so a step sent twice
 * — the answer lost on the way back — lands once.
 */
export type ScopeStep = {
  stepId: string
  command: ScopeCommand
  /** When it was made, epoch milliseconds. */
  at: number
}

/**
 * The refusals a repository answers with beyond the reducer's own, each a key
 * the shell turns into words.
 */
export const SCOPE_REFUSALS = [
  /** The state is no longer what the write expected: somebody changed the scope since it was read. */
  'shell.scopeMoved',
  /** No scope has that identity any more. */
  'shell.scopeGone',
  /** Another scope already has that address. */
  'shell.scopeTaken',
  /** A scope moved to an address under itself. */
  'shell.scopeIntoItself',
  /** An address no scope may have. */
  'shell.badScopePath',
  /** A step on a scope that was not read whole (`ScopeState.unreadable`). */
  'shell.unreadableNotSaved',
  /** A picture's name no picture may have (`model/imageName.ts`). */
  'shell.imageBadName',
  'shell.imageBadType',
] as const satisfies readonly StringKey[]

export type ScopeRefusal = CommandRefusal | (typeof SCOPE_REFUSALS)[number]

/** A new scope's content: a model with its name and nothing in it. */
export function emptyContent(name: string, description: ScopeDescription = {}): ScopeContent {
  return { ...description, model: { name, elements: [], relations: [], diagrams: [] }, images: [] }
}

/**
 * The records a step's command writes, or `undefined` where it may write any
 * of them (`model/recordKey.ts`).
 */
export function recordsOfCommand(command: ScopeCommand): readonly RecordKey[] | undefined {
  switch (command.type) {
    case 'image.add': return [{ kind: 'image', id: command.image.name }]
    case 'image.remove': return [{ kind: 'image', id: command.name }]
    case 'scope.describe': return [SCOPE_RECORD]
    default: return recordsOf(command)
  }
}

/** What applying a run of steps came to. */
export type StepsApplied = {
  ok: true
  content: ScopeContent
  /** Whether anything is different: a run that changed nothing leaves a revision where it was. */
  changed: boolean
  /** Every record the run wrote, once each; `undefined` where it may have written any. */
  records: readonly RecordKey[] | undefined
}

export type StepsRefused = { ok: false; refused: ScopeRefusal; stepId: string }

/** The content being worked on, with the model indexed for the reducer while it is. */
type Working = { description: ScopeDescription; model: Model; images: readonly ImageEntry[] }

type Outcome = { ok: true; working: Working; changed: boolean } | { ok: false; refused: ScopeRefusal }

/**
 * Apply steps to a scope's content, in order: every one of them, or — at the
 * first refusal — none, with the refusal and the step that met it.
 *
 * The one writer for everything a step carries. A model command goes to the
 * reducer, exactly as a session applies it and as a command channel orders
 * it, so a state kept by a repository and a model held by a session that
 * applied the same steps are the same model. Pure: what comes back is new,
 * and what went in is untouched.
 */
export function applySteps(content: ScopeContent, steps: readonly ScopeStep[]): StepsApplied | StepsRefused {
  const { model, images, ...description } = content
  let working: Working = { description, model: fromArrays(model), images }
  let changed = false
  let records: RecordKey[] | undefined = []
  for (const step of steps) {
    const outcome = applyOne(working, step.command)
    if (!outcome.ok) return { ok: false, refused: outcome.refused, stepId: step.stepId }
    working = outcome.working
    changed ||= outcome.changed
    records = merged(records, recordsOfCommand(step.command))
  }
  if (!changed) return { ok: true, content, changed, records }
  return {
    ok: true,
    content: { ...working.description, model: toArrays(working.model), images: working.images },
    changed,
    records,
  }
}

function merged(held: RecordKey[] | undefined, more: readonly RecordKey[] | undefined): RecordKey[] | undefined {
  if (held === undefined || more === undefined) return undefined
  return [...held, ...more.filter((record) => !held.some((one) => sameRecord(one, record)))]
}

function applyOne(working: Working, command: ScopeCommand): Outcome {
  switch (command.type) {
    case 'image.add': return addImage(working, command.image)
    case 'image.remove': return removeImage(working, command.name)
    case 'scope.describe': return describe(working, command.patch)
    default: {
      const result = apply(working.model, command)
      if (!result.ok) return { ok: false, refused: result.reason }
      return sameModel(working.model, result.model, recordsOf(command))
        ? { ok: true, working, changed: false }
        : { ok: true, working: { ...working, model: result.model }, changed: true }
    }
  }
}

/** Where each kind of record the model holds is kept in it. */
const LISTS: Record<Exclude<RecordKind, 'image' | 'scope'>, keyof Model> = {
  element: 'elements', relation: 'relations', diagram: 'diagrams', decision: 'decisions',
  transition: 'transitions', observation: 'observations', cause: 'causes', solution: 'solutions',
  experiment: 'experiments',
}

/** The model's own fields — its name, its description, its defaults — without the lists it holds. */
function ownFields(model: Model): Record<string, unknown> {
  const own: Record<string, unknown> = { ...model }
  for (const list of [...Object.values(LISTS), 'order']) delete own[list]
  return own
}

function recordIn(model: Model, record: RecordKey): unknown {
  if (record.kind === 'scope') return ownFields(model)
  if (record.kind === 'image') return undefined
  return (model[LISTS[record.kind]] as Record<string, unknown> | undefined)?.[record.id]
}

/**
 * Whether a command left the model as it found it.
 *
 * The reducer hands back the model it was given for most commands that change
 * nothing, and a new one for some — an update that sets a field to the value
 * it has. So what counts is the value of every record the command writes,
 * compared before and after; and, for a command that may write anything, the
 * whole model. A step that changes nothing must not move a revision, or every
 * reader of it re-reads a scope for nothing.
 */
function sameModel(before: Model, after: Model, records: readonly RecordKey[] | undefined): boolean {
  if (before === after) return true
  if (records === undefined) return stableText(before) === stableText(after)
  return records.every((record) => stableText(recordIn(before, record)) === stableText(recordIn(after, record)))
}

/** A value as text with every object's keys in order, so two equal values are one text. */
function stableText(value: unknown): string {
  return JSON.stringify(value, (_key, held: unknown) => (
    held && typeof held === 'object' && !Array.isArray(held)
      ? Object.fromEntries(Object.keys(held).sort().map((key) => [key, (held as Record<string, unknown>)[key]]))
      : held
  ))
}

/** A name is one picture: a second under the same name is refused, the way a create on a taken id is. */
function addImage(working: Working, image: ImageEntry): Outcome {
  const refused = imageNameRefusal(image.name)
  if (refused) return { ok: false, refused }
  if (working.images.some((held) => held.name === image.name)) return { ok: false, refused: 'command.taken' }
  return { ok: true, working: { ...working, images: [...working.images, { ...image }] }, changed: true }
}

function removeImage(working: Working, name: ImageName): Outcome {
  const images = working.images.filter((held) => held.name !== name)
  if (images.length === working.images.length) return { ok: false, refused: 'command.gone' }
  return { ok: true, working: { ...working, images }, changed: true }
}

/**
 * A patch on what the scope says about itself. A key it does not know is
 * refused whole, as the reducer refuses one on a model patch
 * (`command.notAField`), and so is a kind that is not one of the labels.
 */
function describe(working: Working, patch: ScopeDescription): Outcome {
  if (typeof patch !== 'object' || patch === null) return { ok: false, refused: 'command.notAField' }
  const next: Record<string, unknown> = { ...working.description }
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.hasOwn(DESCRIPTION_KEYS, key)) return { ok: false, refused: 'command.notAField' }
    if (key === 'kind' && value !== undefined && !isScopeKind(value)) return { ok: false, refused: 'command.notAField' }
    if (value === undefined) delete next[key]
    else next[key] = structuredClone(value)
  }
  const changed = stableText(next) !== stableText(working.description)
  return changed
    ? { ok: true, working: { ...working, description: next as ScopeDescription }, changed }
    : { ok: true, working, changed }
}
