// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A building block moved to another topic or scope, planned (ADR-0043,
 * amended 24 November 2026): the same element under the same id, kept where
 * the person says from now on, with everything that names the place it was
 * kept in carried along.
 *
 * **The target first, the source last.** The plan is an ordered list of
 * writes, one per scope, as a gesture's is (`gestures.ts`): the scope the
 * block arrives in, then every scope whose comparison of it must name its
 * new place, then the scope it leaves. Whoever applies them lands them as
 * one, all or none, where the source can; where one cannot, a failure
 * halfway leaves the block kept twice — a finding somebody sees and repairs —
 * and never kept nowhere.
 *
 * ## What it writes
 *
 * - **In the target**, the element whole — its document, its capabilities,
 *   usage contexts and options — the principles it cites, and its thread,
 *   each comment saying the scope it was written in. Where the target drew
 *   the block as a stand-in, that record becomes the definition and sits
 *   where it sat. The pictures its document names are the target's to hold
 *   before it arrives ({@link BlockMovePlan.pictures}): their bytes are the
 *   caller's to put.
 * - **In every scope that compares its options**, that evaluation under the
 *   id its new place gives it (`evaluationId`), where it stood, with its
 *   contexts, options, ratings and choice as they were — and a decision
 *   that chooses in it naming the new id.
 * - **In the source**, its citations and its thread taken, and the element
 *   gone — or left as a stand-in of the target where the scope still names
 *   it ({@link stillNamed}): deleting it would take its card off every view
 *   there and every connection that ends on it, which a move never asked.
 *   A stand-in keeps where it is drawn and none of the block's own text.
 *
 * Pure. The scopes' records come in, the writes go out; who reads, who may
 * write and who lands them is `guidance/useBlocksAccess.ts`.
 */
import { isAboutRecord } from '../model/citable'
import type { Citation } from '../model/citable'
import { isAbout } from '../model/comment'
import type { Comment, CommentFrom } from '../model/comment'
import { transaction } from '../model/commands'
import type { Command } from '../model/commands'
import { evaluationId } from '../model/evaluation'
import type { HostModel } from '../model/hostModel'
import { imageNameKey } from '../model/imageName'
import type { ImageEntry, ImageName } from '../model/imageName'
import { fromArrays } from '../model/normalised'
import { apply } from '../model/reducer'
import type { RecordKey } from '../model/recordKey'
import type { DesignElement } from '../model/types'
import type { ImageRepository } from '../ports/ImageRepository'
import { definitionCommand } from './gestures'
import type { ScopePath } from './scopePath'

/** As much of a picture repository as taking a block's pictures along asks: one scope's bytes read, and put for another. */
export type BlockMovePictures = Pick<ImageRepository, 'bytes' | 'put'>

/** One scope as the move reads it: its records, and its picture library where a repository keeps one. */
export type BlockMoveScope = {
  readonly path: ScopePath
  readonly model: HostModel
  readonly images?: readonly ImageEntry[]
}

export type BlockMoveRequest = {
  /** The block's id, which it keeps. */
  block: string
  /** The scope that keeps it now. */
  from: ScopePath
  /** The topic or scope it goes to. */
  to: ScopePath
  /** Every scope the move reads: the source, the target, and each scope that compares the block's options. */
  scopes: readonly BlockMoveScope[]
  /**
   * The pictures a document names, by their names in a library
   * (`documentation/images.imagesUsedIn`): handed in, since a scope's records
   * know no markdown. Absent: no picture is carried.
   */
  picturesIn?: (document: string) => readonly ImageName[]
}

/**
 * Why a move is refused, as a value: to the scope it is kept in
 * (`sameScope`); from or to a scope that is not there (`unknownScope`); of a
 * block the source does not define (`unknownBlock`); into a scope that
 * already defines a record under its id (`taken`); past a scope that would
 * hold two comparisons of it (`comparedTwice`); or with a picture the target
 * already holds another of under the same name (`pictureTaken`).
 */
export type BlockMoveRefusal = 'sameScope' | 'unknownScope' | 'unknownBlock' | 'taken' | 'comparedTwice' | 'pictureTaken'

/** One scope's part of the move, as that scope's one step. */
export type BlockMoveWrite = { readonly path: ScopePath; readonly command: Command }

export type BlockMovePlan =
  | {
    ok: true
    /** What the block is called, for what is said afterwards. */
    name: string
    /** One write per scope, in the order they must land: the target, the comparing scopes by path, the source. */
    writes: readonly BlockMoveWrite[]
    /** The source's pictures the target's library must hold before the block arrives, as the source's library says them. */
    pictures: readonly ImageEntry[]
    /** The source keeps a stand-in: something there still names the block. */
    standIn: boolean
    /** How many comments and citations go with it. */
    comments: number
    citations: number
    /** The scopes whose comparison names its new place. */
    compared: readonly ScopePath[]
  }
  | { ok: false; refusal: BlockMoveRefusal; scope?: ScopePath; picture?: ImageName }

const byPath = (a: string, b: string) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b))

const one = (commands: Command[]): Command => (commands.length === 1 ? commands[0] : transaction(commands))

function flat(command: Command): Command[] {
  return command.type === 'transaction' ? command.commands.flatMap(flat) : [command]
}

/** What a delete puts back that is the element's own: itself, its thread and its citations. */
const ITS_OWN: ReadonlySet<Command['type']> = new Set(['element.create', 'comment.put', 'citation.add'])

/**
 * Whether the scope still names the element beyond its own record: asked of
 * the writer, as what deleting it would take besides the record, its thread
 * and its citations — its place on a view, a connection that ends on it, a
 * drawing's anchor — so a kind of placement added later is counted without a
 * line here; and an element filed under it, which a delete leaves naming a
 * parent nobody holds.
 */
export function stillNamed(model: HostModel, id: string): boolean {
  if (model.elements.some((element) => element.parentId === id || element.lane === id)) return true
  const gone = apply(fromArrays(model), { type: 'element.delete', id })
  return gone.ok && flat(gone.inverse).some((command) => !ITS_OWN.has(command.type))
}

/**
 * The definition as the target holds it. Where it sits — `parentId`,
 * `order`, `lane` — is about one scope's trees: the target's own where it
 * drew the block as a stand-in, and otherwise the source's only where the
 * target holds that parent, as a gesture carries it (`gestures.ts`).
 */
function arriving(held: DesignElement, target: HostModel): DesignElement {
  const there = new Set(target.elements.map((element) => element.id))
  const sat = target.elements.find((element) => element.id === held.id) ?? held
  const { ref: _ref, parentId: _parent, order: _order, lane: _lane, ...own } = held
  const orphaned = sat.parentId !== undefined && !there.has(sat.parentId)
  return {
    ...own,
    ...(sat.parentId !== undefined && !orphaned ? { parentId: sat.parentId } : {}),
    ...(sat.order !== undefined && !orphaned ? { order: sat.order } : {}),
    ...(sat.lane !== undefined && there.has(sat.lane) ? { lane: sat.lane } : {}),
  }
}

/**
 * A comment as it arrives (ADR-0037 §6, the rule of `comments/travel.ts`
 * for a move, which this module may not read): about the same record, saying
 * the scope it was written in — the first it said, where it travelled
 * before — and nothing where it comes home to that scope.
 */
function arrived(comment: Comment, about: RecordKey, leaving: ScopePath, arriving: ScopePath): Comment {
  const was: CommentFrom = comment.from
    ? (comment.from.scope === undefined ? { ...comment.from, scope: leaving } : comment.from)
    : { kind: about.kind, id: about.id, scope: leaving }
  const home = was.kind === about.kind && was.id === about.id && was.scope === arriving
  const { from: _from, ...rest } = comment
  return home ? rest : { ...rest, from: was }
}

/** Whether two citations say the same of one record: one principle, one aspect, one stance. */
function sameCitation(a: Citation, b: Citation): boolean {
  return a.principle.scope === b.principle.scope && a.principle.id === b.principle.id && a.aspect === b.aspect && a.stance === b.stance
}

/**
 * A scope's comparison of the block under the id its new place gives it,
 * taken and put back where it stood (as a move of a scope does,
 * `readdress.ts`), and a decision that chooses in it naming that id.
 * `undefined` where the scope would then hold two.
 */
function recompared(model: HostModel, block: string, from: ScopePath, to: ScopePath): Command[] | undefined {
  const commands: Command[] = []
  const held = model.evaluations ?? []
  for (const [at, evaluation] of held.entries()) {
    if (evaluation.block.id !== block || evaluation.block.scope !== from) continue
    const next = { ...evaluation, id: evaluationId({ scope: to, id: block }), block: { scope: to, id: block } }
    if (held.some((other) => other.id === next.id)) return undefined
    commands.push({ type: 'evaluation.remove', id: evaluation.id }, { type: 'evaluation.add', evaluation: next, at })
    for (const decision of model.decisions ?? []) {
      if (decision.chooses?.evaluation !== evaluation.id) continue
      commands.push({ type: 'decision.update', id: decision.id, patch: { chooses: { ...decision.chooses, evaluation: next.id } } })
    }
  }
  return commands
}

/** The pictures the document names that the target must be given, or the one it already holds another of. */
function picturesFor(
  document: string, source: BlockMoveScope, target: BlockMoveScope, picturesIn: BlockMoveRequest['picturesIn'],
): { pictures: ImageEntry[] } | { taken: ImageName } {
  const pictures: ImageEntry[] = []
  for (const name of picturesIn?.(document) ?? []) {
    const held = (source.images ?? []).find((entry) => entry.name === name)
    // A name the source's library does not hold drew nothing there, and draws nothing where it goes.
    if (!held) continue
    const there = (target.images ?? []).find((entry) => imageNameKey(entry.name) === imageNameKey(name))
    if (!there) pictures.push(held)
    else if (there.name !== name || there.contentAddress !== held.contentAddress) return { taken: name }
  }
  return { pictures }
}

/** What the source's own step is: the comparison it holds, what went with the block taken, and the block gone or standing in. */
function leaving(
  held: DesignElement, to: ScopePath, standIn: boolean,
  own: { compared: Command[]; citations: readonly Citation[]; thread: readonly Comment[] },
): Command {
  const emptied: Partial<DesignElement> = {}
  for (const field of ['description', 'capabilities', 'contexts', 'sbbs'] as const) {
    if (held[field] !== undefined) Object.assign(emptied, { [field]: undefined })
  }
  return one([
    ...own.compared,
    ...own.citations.map((citation): Command => ({ type: 'citation.remove', id: citation.id })),
    ...own.thread.map((comment): Command => ({ type: 'comment.take', id: comment.id })),
    // A stand-in holds none of the block's own text: what went with the definition is read where it is kept.
    ...(standIn && Object.keys(emptied).length > 0 ? [{ type: 'element.update', id: held.id, patch: emptied } as const] : []),
    standIn ? { type: 'element.link', id: held.id, name: held.name, ref: to } : { type: 'element.delete', id: held.id },
  ])
}

/** What one move would write, in order, or why it will not. */
export function planBlockMove(request: BlockMoveRequest): BlockMovePlan {
  const { block, from, to, scopes } = request
  if (from === to) return { ok: false, refusal: 'sameScope', scope: to }
  const source = scopes.find((scope) => scope.path === from)
  const target = scopes.find((scope) => scope.path === to)
  if (!source) return { ok: false, refusal: 'unknownScope', scope: from }
  if (!target) return { ok: false, refusal: 'unknownScope', scope: to }
  const held = source.model.elements.find((element) => element.id === block)
  if (!held || held.kind !== 'buildingBlock' || held.ref !== undefined) return { ok: false, refusal: 'unknownBlock', scope: from }
  const standing = target.model.elements.find((element) => element.id === block)
  if (standing && standing.ref === undefined) return { ok: false, refusal: 'taken', scope: to }

  const carried = picturesFor(held.description ?? '', source, target, request.picturesIn)
  if ('taken' in carried) return { ok: false, refusal: 'pictureTaken', scope: to, picture: carried.taken }

  const comparisons = new Map<ScopePath, Command[]>()
  for (const scope of scopes) {
    const commands = recompared(scope.model, block, from, to)
    if (!commands) return { ok: false, refusal: 'comparedTwice', scope: scope.path }
    if (commands.length > 0) comparisons.set(scope.path, commands)
  }

  const about: RecordKey = { kind: 'element', id: block }
  const thread = (source.model.comments ?? []).filter((comment) => isAbout(comment, about))
  const citations = (source.model.citations ?? []).filter((citation) => isAboutRecord(citation, about))
  // One the target already says the same of — it cited its stand-in so — is said once.
  const said = (target.model.citations ?? []).filter((citation) => isAboutRecord(citation, about))
  const cited = citations.filter((citation) => !said.some((other) => sameCitation(other, citation)))
  const standIn = stillNamed(source.model, block)

  const arrival = one([
    definitionCommand(target.model, arriving(held, target.model)),
    ...cited.map((citation): Command => ({ type: 'citation.add', citation })),
    ...thread.map((comment): Command => ({ type: 'comment.add', comment: arrived(comment, about, from, to) })),
    ...(comparisons.get(to) ?? []),
  ])
  const others = [...comparisons.keys()].filter((path) => path !== to && path !== from).sort(byPath)
  return {
    ok: true,
    name: held.name,
    writes: [
      { path: to, command: arrival },
      ...others.map((path) => ({ path, command: one(comparisons.get(path)!) })),
      { path: from, command: leaving(held, to, standIn, { compared: comparisons.get(from) ?? [], citations, thread }) },
    ],
    pictures: carried.pictures,
    standIn,
    comments: thread.length,
    citations: citations.length,
    compared: [...comparisons.keys()].sort(byPath),
  }
}
