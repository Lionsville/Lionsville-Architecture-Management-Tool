// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A building block moved to another topic or scope, landed (ADR-0043,
 * amended 24 November 2026): the plan (`projects/blockMove.ts`) read over the
 * scopes it names and written as one.
 *
 * **Every scope's part is that scope's step, under that scope's rights.**
 * The move writes the scope the block arrives in, every scope whose
 * comparison names where it is kept, and the scope it leaves. Nothing is
 * written unless the person may change each of them, and the one they may
 * not is said by name.
 *
 * **One apply, in the plan's order** (`projects/scopeAccess.changeScopes`):
 * each scope expecting what was read, so all of them land or none does, and
 * the target is first in it — a source that could only land part of it would
 * leave the block kept twice, never nowhere. Over a scope somebody changed in
 * between, the plan is made again from what they all hold then.
 *
 * **The pictures first.** The pictures the block's document names are the
 * source's library's; their bytes are put for the target before the apply
 * and their entries added in the target's step, ahead of the block, so its
 * document never arrives naming a picture the scope does not hold. Bytes put
 * for a move that is then refused are in no library, and the place's to let
 * go of (`ports/ImageRepository`). A host that hands no pictures refuses the
 * move of a block whose document shows some, and says so.
 */
import { imagesUsedIn } from '../documentation/images'
import type { StringKey, Translate } from '../i18n'
import type { ImageEntry } from '../model/imageName'
import { ShellError } from '../platform/errors'
import { planBlockMove } from '../projects/blockMove'
import type { BlockMovePictures, BlockMovePlan, BlockMoveRefusal, BlockMoveScope } from '../projects/blockMove'
import type { ScopeSnapshot } from '../projects/scope'
import { changeScopes, keptAt, readScopes } from '../projects/scopeAccess'
import type { ScopeIndex } from '../projects/scopeIndex'
import type { ScopePath } from '../projects/scopePath'
import type { ScopeCommand } from '../projects/scopeState'
import type { BelowScopes } from '../session/useChangeBelow'
import { refusalKey } from '../session/writeIn'
import { holdWrite } from '../session/writeRefusals'

export type MoveBlockDeps = {
  index: Pick<ScopeIndex, 'evaluations'>
  scopes: BelowScopes
  /** The source's pictures, where the host hands them: what a block's document shows goes with it. */
  images?: BlockMovePictures
  writable: (path: ScopePath) => boolean
  written: () => void
  notify: (message: string, severity: 'success' | 'error' | 'warning') => void
  scopeLabel: (path: ScopePath) => string
  s: Translate
}

/** The sentence for each refusal: one added without words does not compile. */
const REFUSED: Record<BlockMoveRefusal, StringKey> = {
  sameScope: 'blocks.moveSameScope',
  unknownScope: 'blocks.moveUnknownScope',
  unknownBlock: 'blocks.moveUnknownBlock',
  taken: 'blocks.moveTaken',
  comparedTwice: 'blocks.moveComparedTwice',
  pictureTaken: 'blocks.movePictureTaken',
}

type Refused = Extract<BlockMovePlan, { ok: false }>

function say(deps: MoveBlockDeps, refused: Refused): false {
  deps.notify(deps.s(REFUSED[refused.refusal], { scope: deps.scopeLabel(refused.scope ?? ''), picture: refused.picture ?? '' }), 'error')
  return false
}

const asRead = (held: ScopeSnapshot): BlockMoveScope => ({ path: held.path, model: held.model, ...(held.images ? { images: held.images } : {}) })

/**
 * The bytes of the pictures the plan asks for, put for the target: each
 * picture's entry as the target's library takes it, by name. One whose bytes
 * the source does not hold drew nothing there and is left out.
 */
async function carried(
  images: BlockMovePictures, from: ScopeSnapshot, to: ScopeSnapshot, pictures: readonly ImageEntry[],
): Promise<Map<string, ImageEntry | undefined>> {
  const entries = new Map<string, ImageEntry | undefined>()
  for (const picture of pictures) {
    const held = await images.bytes(from.id!, picture.name)
    entries.set(picture.name, held ? { ...picture, contentAddress: keptAt(await images.put(to.id!, picture.name, held.bytes)) } : undefined)
  }
  return entries
}

/** What one try at the move came to: landed under a name, or why not — a refusal of the plan's, or a key. */
type Outcome = { landed: string } | { refused: Refused } | { key: StringKey }

/** The scopes read, the pictures' bytes put, and every scope's step applied as one. */
async function land(deps: MoveBlockDeps, move: { block: string; from: ScopePath; to: ScopePath }, paths: readonly ScopePath[]): Promise<Outcome> {
  const { block, from, to } = move
  const plan = (held: readonly ScopeSnapshot[]) => planBlockMove({ block, from, to, scopes: held.map(asRead), picturesIn: imagesUsedIn })
  const read = await readScopes(deps.scopes, paths)
  const missing = paths.find((_, at) => !read[at]?.id)
  if (missing !== undefined) return { refused: { ok: false, refusal: 'unknownScope', scope: missing } }
  const first = plan(read as ScopeSnapshot[])
  if (!first.ok) return { refused: first }
  if (first.pictures.length > 0 && !deps.images) return { key: 'blocks.movePicturesStay' }
  const entries = deps.images
    ? await carried(deps.images, read[paths.indexOf(from)]!, read[paths.indexOf(to)]!, first.pictures)
    : new Map<string, ImageEntry | undefined>()
  let stopped: Outcome | undefined
  let name = first.name
  const after = await changeScopes(deps.scopes, paths, (held) => {
    stopped = undefined
    const now = plan(paths.map((path) => held.get(path)!))
    if (!now.ok) {
      stopped = { refused: now }
      return undefined
    }
    // A document that names another picture since the bytes were put is a scope that moved: asked again, the move carries that one too.
    if (now.pictures.some((picture) => !entries.has(picture.name))) {
      stopped = { key: 'shell.scopeMoved' }
      return undefined
    }
    name = now.name
    const pictures = now.pictures.flatMap((picture): ScopeCommand[] => {
      const image = entries.get(picture.name)
      return image ? [{ type: 'image.add', image }] : []
    })
    return new Map(now.writes.map((write): [ScopePath, ScopeCommand[]] => [write.path, write.path === to ? [...pictures, write.command] : [write.command]]))
  })
  if (stopped) return stopped
  return after ? { landed: name } : { key: 'shell.scopeGone' }
}

/** Move `block` from the scope that keeps it to `to`: landed and said, or refused and said. */
export async function moveBlock(deps: MoveBlockDeps, move: { block: string; from: ScopePath; to: ScopePath }): Promise<boolean> {
  const { block, from, to } = move
  if (from === to) return say(deps, { ok: false, refusal: 'sameScope', scope: to })
  const comparing = deps.index.evaluations()
    .filter((one) => one.evaluation.block.id === block && one.evaluation.block.scope === from)
    .map((one) => one.scope)
  const paths = [...new Set([to, ...comparing, from])]
  const closed = paths.find((path) => !deps.writable(path))
  if (closed !== undefined) {
    deps.notify(deps.s('blocks.moveNotAllowed', { scope: deps.scopeLabel(closed) }), 'error')
    return false
  }
  let outcome: Outcome
  try {
    outcome = await holdWrite(deps.scopes, land(deps, move, paths))
  } catch (error) {
    if (!(error instanceof ShellError)) throw error
    outcome = { key: refusalKey({ ok: false, reason: error.key }) ?? 'common.pick.notWritten' }
  }
  if ('refused' in outcome) return say(deps, outcome.refused)
  if ('key' in outcome) {
    deps.notify(deps.s(outcome.key), 'error')
    return false
  }
  deps.written()
  deps.notify(deps.s('blocks.moved', { name: outcome.landed, scope: deps.scopeLabel(to) }), 'success')
  return true
}
