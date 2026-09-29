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
import { imageEntryRefusal, imageNameKey } from '../model/imageName'
import type { ImageEntry, ImageName } from '../model/imageName'
import { fromArrays, toArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import { recordsChanged, SCOPE_RECORD, sameValue } from '../model/recordKey'
import type { RecordKey } from '../model/recordKey'
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

/**
 * A scope's content made equal to a content that arrives whole, and used for
 * that alone: a set of scopes a person hands over, landed on one; a scope
 * built from an example; and what a person keeps over another author's
 * version when a step of theirs cannot land on it (*keep mine*), which is
 * the scope as it stands on their screen.
 * Never the open scope's ordinary writes, which are the commands its session
 * applied, and never a restore, which is the model's own command and keeps
 * what a restore keeps.
 *
 * What was there and is not in the content goes; the records it touched are
 * read off the content before and after, as every step's are, so the history
 * of each thing it changed shows it. The pictures' bytes go through
 * `ImageRepository` first, as for `image.add`. Like any step it may say what
 * it expects the scope to be, so it never lands over a state nobody read.
 */
export type ReplaceCommand = { type: 'scope.replace'; content: ScopeContent }

/** Everything a step may carry. */
export type ScopeCommand = Command | ImageCommand | DescribeCommand | ReplaceCommand

/**
 * One step, on its way to a scope.
 *
 * The same `stepId` and `at` a session gives a step it publishes
 * (`ports/CommandChannel.ts`): minted by whoever made it, so a step sent twice
 * — the answer lost on the way back — lands once. A step id names one step in
 * the whole source, not in one scope: a session mints one that nobody else
 * will (a random UUID). A repository that has applied a step by that id does
 * not apply it again, and refuses it for any other scope (`STEP_ELSEWHERE`).
 * It remembers the ids it applied for at least a day; one that keeps a log of
 * its steps remembers them for as long as it keeps the log.
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
  /** A picture's name no picture may have, or an entry that does not describe its picture (`model/imageName.ts`). */
  'shell.imageBadName',
  'shell.imageBadType',
  'shell.imageBadEntry',
  /**
   * A library entry that names bytes this source does not keep for the scope:
   * never put, or put, named by nothing, and let go of since — an undo of a
   * picture taken out long enough ago. The library never names bytes that are
   * not there; the editor puts them again, or tells the person.
   */
  'shell.imageBytesGone',
] as const satisfies readonly StringKey[]

/**
 * A step id this source has already applied to another scope: a caller that
 * made a step for one scope and sent it to another. Refused rather than
 * answered as landed, because the caller would be told its step was applied
 * when nothing happened to the scope it named. A fault in the caller, never a
 * person's to read, so it has no sentence of its own: it goes to the trail.
 */
export const STEP_ELSEWHERE = 'step.elsewhere' as const

export type ScopeRefusal = CommandRefusal | (typeof SCOPE_REFUSALS)[number] | typeof STEP_ELSEWHERE

/** A new scope's content: a model with its name and nothing in it. */
export function emptyContent(name: string, description: ScopeDescription = {}): ScopeContent {
  return { ...description, model: { name, elements: [], relations: [], diagrams: [] }, images: [] }
}

/** What applying a run of steps came to. */
export type StepsApplied = {
  ok: true
  content: ScopeContent
  /** Whether anything is different: a run that changed nothing leaves a revision where it was. */
  changed: boolean
  /**
   * Every record whose value differs between the content before the run and
   * after it, once each (`model/recordKey.ts`): what the run touched, side
   * effects included. Empty exactly where nothing changed.
   */
  records: readonly RecordKey[]
}

export type StepsRefused = { ok: false; refused: ScopeRefusal; stepId: string }

/** The content being worked on, with the model indexed for the reducer while it is. */
type Working = { description: ScopeDescription; model: Model; images: readonly ImageEntry[] }

type Outcome = { ok: true; working: Working } | { ok: false; refused: ScopeRefusal }

/**
 * Apply steps to a scope's content, in order: every one of them, or — at the
 * first refusal — none, with the refusal and the step that met it.
 *
 * The one writer for everything a step carries. A model command goes to the
 * reducer, exactly as a session applies it and as a command channel orders
 * it, so a state kept by a repository and a model held by a session that
 * applied the same steps are the same model. Pure: what comes back is new,
 * and what went in is untouched.
 *
 * What changed is read off the content before and after, never off what a
 * command says it writes: the reducer hands back a new model for some steps
 * that change nothing, and a delete reaches records its command does not name.
 */
export function applySteps(content: ScopeContent, steps: readonly ScopeStep[]): StepsApplied | StepsRefused {
  const { model, images, ...description } = content
  const before: Working = { description, model: fromArrays(model), images }
  let working = before
  for (const step of steps) {
    const outcome = applyOne(working, step.command)
    if (!outcome.ok) return { ok: false, refused: outcome.refused, stepId: step.stepId }
    working = outcome.working
  }
  const records = changedBetween(before, working)
  if (records.length === 0) return { ok: true, content, changed: false, records }
  return {
    ok: true,
    content: { ...working.description, model: toArrays(working.model), images: working.images },
    changed: true,
    records,
  }
}

/** Every record that differs between two contents, once each: the model's, the pictures', and the scope's own. */
function changedBetween(before: Working, after: Working): RecordKey[] {
  const inModel = recordsChanged(before.model, after.model)
  const scope = inModel.some((record) => record.kind === 'scope') || !sameValue(before.description, after.description)
  return [
    ...inModel.filter((record) => record.kind !== 'scope'),
    ...imagesChanged(before.images, after.images),
    ...(scope ? [SCOPE_RECORD] : []),
  ]
}

/**
 * Every record that differs between two contents of one scope, as a run of
 * steps between them would name it (`StepsApplied.records`): for a content
 * that arrives whole, from somewhere steps were not kept.
 */
export function recordsBetween(before: ScopeContent, after: ScopeContent): RecordKey[] {
  const working = ({ model, images, ...description }: ScopeContent): Working => ({ description, model: fromArrays(model), images })
  return changedBetween(working(before), working(after))
}

/** The pictures whose entry was added, taken out or changed, by name. */
function imagesChanged(before: readonly ImageEntry[], after: readonly ImageEntry[]): RecordKey[] {
  if (before === after) return []
  const was = new Map(before.map((image) => [image.name, image]))
  const is = new Map(after.map((image) => [image.name, image]))
  return [...new Set([...is.keys(), ...was.keys()])]
    .filter((name) => !sameValue(was.get(name), is.get(name)))
    .map((name) => ({ kind: 'image', id: name }))
}

function applyOne(working: Working, command: ScopeCommand): Outcome {
  switch (command.type) {
    case 'image.add': return addImage(working, command.image)
    case 'image.remove': return removeImage(working, command.name)
    case 'scope.describe': return describe(working, command.patch)
    case 'scope.replace': return replace(command.content)
    default: {
      const result = apply(working.model, command)
      if (!result.ok) return { ok: false, refused: result.reason }
      return { ok: true, working: { ...working, model: result.model } }
    }
  }
}

/**
 * An entry that describes its picture, under a name no picture in the library
 * has — compared composed and in lower case (`imageNameKey`), because a
 * desktop that does not tell the two apart would keep one of them. A second
 * is refused the way a create on a taken id is.
 */
function addImage(working: Working, image: ImageEntry): Outcome {
  const refused = imageEntryRefusal(image)
  if (refused) return { ok: false, refused }
  const key = imageNameKey(image.name)
  if (working.images.some((held) => imageNameKey(held.name) === key)) return { ok: false, refused: 'command.taken' }
  return { ok: true, working: { ...working, images: [...working.images, { ...image }] } }
}

function removeImage(working: Working, name: ImageName): Outcome {
  const images = working.images.filter((held) => held.name !== name)
  if (images.length === working.images.length) return { ok: false, refused: 'command.gone' }
  return { ok: true, working: { ...working, images } }
}

/**
 * A content taken whole, held to what a step building it would be held to:
 * a description with only the keys a description has, and a library whose
 * every entry describes its picture under a name no other entry has.
 */
function replace(content: ScopeContent): Outcome {
  if (typeof content !== 'object' || content === null || !Array.isArray(content.images)) {
    return { ok: false, refused: 'command.notAField' }
  }
  const { model, images, ...description } = content
  const described = describe({ description: {}, model: fromArrays(model), images: [] }, description)
  if (!described.ok) return described
  let working = described.working
  for (const image of images) {
    const added = addImage(working, image)
    if (!added.ok) return added
    working = added.working
  }
  return { ok: true, working }
}

/** The keys a description may carry. */
const DESCRIPTION_KEYS: Record<keyof ScopeDescription, true> = {
  kind: true, client: true, links: true, activeDiagramId: true, logoLibrary: true,
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
  return { ok: true, working: { ...working, description: next as ScopeDescription } }
}
