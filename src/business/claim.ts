// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A domain taking up a function of a scope above it — *claimed*, in ADR-0012
 * §3's word (ADR-0040 §5).
 *
 * The bottom-up half of who does what. The organisation hands an area to a
 * domain with the area's `scopes`; the domain says it took one up by keeping
 * a stand-in of it on its own sheet, and what it files under that stand-in is
 * its refinement. Two statements by two scopes, read together and never
 * written together: a claim writes nothing in the scope above.
 *
 * Pure, and in `business` because *where on the sheet the stand-in lands* is
 * this module's reading of the trees: under its parent where this scope holds
 * the parent, so a capability taken up joins the area it sits in; and
 * otherwise a root, put on the sheet's list of areas where the sheet keeps
 * one, so it is drawn and not lost. Which scope is above which is compared as
 * paths here, structurally, because `business` may not import `projects`.
 */
import type { Command } from '../model/commands'
import { transaction } from '../model/commands'
import type { DesignDiagram, DesignElement, ElementId } from '../model/types'
import { nextOrder } from './authoring'

/** What the tree knows about the function asked for: `projects/scopeIndex`'s entry, structurally. */
export type ClaimEntry = {
  readonly id: ElementId
  readonly kind: DesignElement['kind']
  readonly name: string
  /** The scope that defines it; absent where nobody does. */
  readonly master?: string
  /** What the master files it under. */
  readonly parentId?: ElementId
}

export type ClaimRefusal =
  /** Defined in a scope that is not above this one — beside it, below it, or nowhere. */
  | 'claim.notAbove'
  /** This scope defines it: it is this scope's own to hand on, not to take up. */
  | 'claim.definedHere'
  /** Not an area, a grouping or a capability. */
  | 'claim.notAFunction'
  /** The tree does not know the id. */
  | 'claim.unknown'

export type ClaimPlan =
  | {
    readonly command: Command
    /** The stand-in's parent here, where this scope holds the function's parent. */
    readonly parentId?: ElementId
    /** The sheet it is an area of, where it lands as a root and a sheet was named. */
    readonly drawnOn?: string
  }
  | { readonly refused: ClaimRefusal; readonly detail?: string }
  /** This scope holds a stand-in of it already: an answer, not a refusal. */
  | { readonly already: true }

/** Is `above` a scope strictly above `scope`? The empty path is the organisation. */
export function isAbove(above: string, scope: string): boolean {
  if (above === scope) return false
  return above === '' || scope.startsWith(`${above}/`)
}

/**
 * The command that takes one function up, or why not.
 *
 * `standIn` is the record the host would keep of it (`projects/library.standInOf`):
 * the two caches and nothing of the owner's detail. `sheet` is the sheet the
 * claim is made on, where there is one; a scope with no sheet still takes the
 * function up, and its first sheet draws it as one more root.
 */
export function claimCommand(at: {
  entry: ClaimEntry | undefined
  scope: string
  model: { readonly elements: readonly DesignElement[] }
  sheet?: Pick<DesignDiagram, 'id' | 'areas'>
  standIn: DesignElement
  origin?: 'agent'
}): ClaimPlan {
  const { entry, scope, model, sheet, standIn } = at
  if (!entry) return { refused: 'claim.unknown' }
  if (entry.kind !== 'function') return { refused: 'claim.notAFunction', detail: `${entry.id} is a ${entry.kind}` }
  const held = model.elements.find((element) => element.id === entry.id)
  if (held && held.ref === undefined) return { refused: 'claim.definedHere', detail: entry.id }
  if (held) return { already: true }
  if (entry.master === undefined) return { refused: 'claim.notAbove', detail: `${entry.id}: no scope defines it` }
  if (entry.master === scope) return { refused: 'claim.definedHere', detail: entry.id }
  if (!isAbove(entry.master, scope)) return { refused: 'claim.notAbove', detail: `${entry.id} is defined in "${entry.master}"` }

  const parent = entry.parentId === undefined
    ? undefined
    : model.elements.find((element) => element.id === entry.parentId && element.kind === 'function')
  const order = nextOrder(model.elements, 'function', parent?.id)
  const element: DesignElement = {
    ...standIn,
    ...(parent ? { parentId: parent.id } : {}),
    ...(order !== undefined ? { order } : {}),
  }
  const commands: Command[] = [{ type: 'element.create', element }]
  // A root on a sheet that lists its areas is drawn only once it is on the
  // list; a sheet with no list draws every root, this one included.
  if (!parent && sheet?.areas) commands.push({ type: 'diagram.update', id: sheet.id, patch: { areas: [...sheet.areas, element.id] } })
  const meta = at.origin ? { origin: at.origin } : {}
  return {
    command: commands.length === 1 ? { ...commands[0], ...meta } as Command : transaction(commands, meta),
    ...(parent ? { parentId: parent.id } : {}),
    ...(!parent && sheet ? { drawnOn: sheet.id } : {}),
  }
}
