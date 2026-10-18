// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The host's half of mapping a sheet to the tree (ADR-0040 §4–§6): which
 * domains a function is handed to and which took it up, for the inspector's
 * *Domains*; the functions of the sheets above this scope may take up, for
 * *From above…*; and the set the *not yet mapped* band leaves out.
 *
 * `business` reads no tree, so the sheet is handed these. Each is read off
 * the index when asked, and kept once per index, scope and model, so a sheet
 * laid out from them is laid out again only when one of them moves.
 */
import type { SheetDomains } from '../business/ui/FunctionInspector'
import type { SheetClaims } from '../business/ui/SheetPage'
import { claimCommand } from '../business/claim'
import type { Translate } from '../i18n'
import type { Command, DesignDiagram, ElementId } from '../model'
import type { HostModel } from '../model/hostModel'
import { claimable, takenUpBelow, takenUpBy, takenUpIds } from '../projects/claims'
import { standInOf } from '../projects/library'
import type { ScopeIndex } from '../projects/scopeIndex'
import { scopeTrail } from '../projects/scopeLabel'
import { isWithinScope } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import type { PickOption } from '../widgets/PickToAdd'

export type SheetMappingAt = {
  index: ScopeIndex
  /** The scope whose sheet it is: the one that defines what it hands on, and the one that takes up. */
  scope: ScopePath
  model: HostModel
  scopeName: (path: ScopePath) => string
  s: Translate
}

/** The functions the scopes below `scope` took up: what the band, the card and the check leave out. */
export function takenUpHere(index: ScopeIndex, scope: ScopePath): ReadonlySet<ElementId> {
  return takenUpIds(takenUpBelow(index, scope))
}

/**
 * The inspector's *Domains*: the scopes below this one to hand a function to,
 * each by its trail and its type; what each is called; and who took it up.
 * `openScope` is read when a name is pressed.
 */
export function sheetDomainsFor(at: SheetMappingAt & { openScope?: (path: ScopePath) => void }): SheetDomains {
  const held = keptDomains.get(at.model)
  if (held && sameAt(held.at, at) && (held.at.openScope === undefined) === (at.openScope === undefined)) {
    held.at = at
    return held.answer
  }
  const entry: { at: typeof at; answer?: SheetDomains } = { at }
  const answer = domainsOf(at, (path) => entry.at.openScope?.(path))
  keptDomains.set(at.model, Object.assign(entry, { answer }))
  return answer
}
const keptDomains = new WeakMap<HostModel, { at: SheetMappingAt & { openScope?: (path: ScopePath) => void }; answer: SheetDomains }>()

/** The same index, scope, words and names: an answer kept for a model may be handed out again. */
function sameAt(held: SheetMappingAt, at: SheetMappingAt): boolean {
  return held.index === at.index && held.scope === at.scope && held.scopeName === at.scopeName && held.s === at.s
}

function domainsOf(at: SheetMappingAt & { openScope?: (path: ScopePath) => void }, open: (path: ScopePath) => void): SheetDomains {
  const { index, scope, model, scopeName } = at
  const trail = (path: ScopePath) => scopeTrail(path, scopeName)
  const typeName = new Map(index.operatingModel().unitTypes.map((type) => [type.id, type.name]))
  const types = index.scopeTypes()
  const below = index.scopes().filter((path) => path !== scope && isWithinScope(path, scope))
  return {
    choices: (functionId) => {
      const handed = model.elements.find((element) => element.id === functionId)?.scopes ?? []
      return below.filter((path) => !handed.includes(path)).map((path): PickOption => {
        const type = typeName.get(types.get(path) ?? '')
        return { id: path, label: trail(path), ...(type !== undefined ? { note: type } : {}) }
      })
    },
    name: trail,
    takenUpBy: (functionId) => takenUpBy(index, functionId),
    ...(at.openScope ? { openScope: open } : {}),
  }
}

/**
 * *From above…*: every function of a sheet above this scope that it does not
 * hold yet, grouped by the scope that defines it and saying what it sits in,
 * and the claim itself — a stand-in in this scope's session, one step
 * (`business/claim.claimCommand`), on the sheet the person is looking at.
 */
export type SheetClaimsAt = SheetMappingAt & {
  /** The sheet as it stands when the pick lands, which is what the step is built against. */
  current: () => { model: HostModel; sheet: Pick<DesignDiagram, 'id' | 'areas'> | undefined }
  dispatch: (command: Command) => unknown
}

export function sheetClaimsFor(at: SheetClaimsAt): SheetClaims | undefined {
  // The organisation has nothing above it to take up.
  if (at.scope === '') return undefined
  const held = keptClaims.get(at.model)
  if (held && sameAt(held.at, at)) {
    held.at = at
    return held.answer
  }
  const entry: { at: SheetClaimsAt; answer?: SheetClaims } = { at }
  const answer = claimsOf(at, () => entry.at)
  keptClaims.set(at.model, Object.assign(entry, { answer }))
  return answer
}
const keptClaims = new WeakMap<HostModel, { at: SheetClaimsAt; answer: SheetClaims }>()

function claimsOf(at: SheetClaimsAt, latest: () => SheetClaimsAt): SheetClaims {
  const { index, scope, model, s } = at
  const choices = claimable(index, scope, model).map(({ entry, within }): PickOption => ({
    id: entry.id,
    label: entry.name,
    group: scopeTrail(entry.master, at.scopeName),
    ...(within.length > 0 ? { note: s('pick.in', { name: within.join(' › ') }) } : {}),
  }))
  return {
    choices,
    claim: (id) => {
      const entry = index.lookup(id)
      if (entry?.master === undefined) return
      const now = latest().current()
      const plan = claimCommand({ entry, scope, model: now.model, ...(now.sheet ? { sheet: now.sheet } : {}), standIn: standInOf(entry, entry.master) })
      if ('command' in plan) latest().dispatch(plan.command)
    },
  }
}
