// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The tree's four gestures, over the repositories and with no screen in
 * them (ADR-0040 §1): a scope made under another, described, moved, removed.
 *
 * The organisation screen makes, describes, moves and removes a scope
 * through these, and so does every host that lends the agent the tree — the
 * desktop over its repositories, a host with no screen over the person's own
 * — so the two cannot drift apart. What each gesture is stays what the
 * screen has always done: the address the new-scope dialog gives, the two
 * steps the settings dialog writes, the repository's move with the stand-ins
 * that named the subtree re-addressed, the repository's removal.
 *
 * **Each is that scope's step**, applied through the repositories under that
 * scope's rights, never through a session open on it. A refusal is the
 * repository's `ShellError`, as in `scopeAccess.ts`; the two answers that are
 * a gesture's own — nothing at the parent, a scope nobody can read in the
 * way — are values, because the screen says them differently from a store
 * that refused.
 */
import { toDiagram } from '../model'
import type { ElementId } from '../model'
import { scopesWith } from '../model/serving'
import type { UnitTypeId } from '../model/operatingModel'
import { ShellError } from '../platform/errors'
import type { OrganisationIndex } from '../ports/OrganisationIndex'
import type { ScopeRepository } from '../ports/ScopeRepository'
import { normaliseLinks } from './links'
import type { RecordLink } from './links'
import { bareScope, emptyScope, flattenScopes, namesUnder, unreadableAt } from './scope'
import type { ScopeKind, ScopeSnapshot, ScopeSummary } from './scope'
import { changeScope, changeScopes, ensureScope, landed, moveScope, nodeAt, nodesOf, summaryOf } from './scopeAccess'
import type { ScopeReader } from './scopeAccess'
import type { ScopeIndex } from './scopeIndex'
import { ancestorScopes, ROOT_SCOPE, scopePathFor, scopePathLabel } from './scopePath'
import type { ScopePath } from './scopePath'
import type { ScopeCommand, ScopeId } from './scopeState'
import { typeChosen, typeFollowingUnit, typedByUnitType } from './scopeType'

/** The repository as the four gestures use it. */
export type TreeScopes = ScopeReader & Pick<ScopeRepository, 'create' | 'apply' | 'move' | 'remove'>

// --- making one -------------------------------------------------------------------

export type CreateAsked = {
  parent: ScopePath
  name: string
  /** A landscape scope with one board; a domain, which files others and draws nothing, without. */
  withBoard: boolean
  /** What the first board is called. */
  boardName: string
  /**
   * What happens where the parent is not there: the screen's dialog makes the
   * missing scopes above as domains named after their addresses, from the top
   * down, so an interrupted run leaves a tree whole as far as it got; an agent
   * names a parent that is there, and is told it is not.
   */
  ancestors?: 'make' | 'required'
}

export type Made = {
  path: ScopePath
  id: ScopeId
  name: string
  kind: 'landscape' | 'domain'
  board?: { id: string; name: string }
}

/** Nothing at the parent (`required` only), or a scope nobody could read at the address or above it. */
export type NotMade = { refused: 'shell.scopeGone' | 'shell.unreadableInTheWay' }

/**
 * A scope under another, at the address the new-scope dialog gives it: the
 * name's slug under the parent, suffixed where that is taken or reserved
 * (`scopePathFor`). Free by the listing — a scope the listing could not read
 * is still there, and is refused rather than written over. With a board, the
 * board is added as the step that follows the making.
 */
export async function createScopeAt(scopes: TreeScopes, asked: CreateAsked): Promise<Made | NotMade> {
  const name = asked.name.trim()
  const held = summaryOf(await scopes.tree())
  const all = flattenScopes(held)
  const parent = all.find((scope) => scope.path === asked.parent)
  if (!parent && asked.ancestors === 'required') return { refused: 'shell.scopeGone' }
  const path = scopePathFor(asked.parent, name, namesUnder(parent))
  if (unreadableAt(held, path) !== undefined) return { refused: 'shell.unreadableInTheWay' }
  if (asked.ancestors !== 'required') {
    for (const missing of ancestorScopes(path).reverse()) {
      if (missing === ROOT_SCOPE || all.some((scope) => scope.path === missing)) continue
      await ensureScope(scopes, missing, { name: scopePathLabel(missing), kind: 'domain' })
    }
  }
  // A scope that draws is a landscape and one that does not is a domain
  // (ADR-0012 §1) — labels for a screen, said from what was asked for rather
  // than read back later from the shape.
  const fresh = asked.withBoard
    ? emptyScope(path, { design: name, diagram: asked.boardName }, 'landscape')
    : bareScope(path, name, 'domain')
  const id = await ensureScope(scopes, path, { name, ...(fresh.kind ? { kind: fresh.kind } : {}) })
  const boards: ScopeCommand[] = fresh.model.diagrams.map((diagram) => ({ type: 'diagram.create', diagram: toDiagram(diagram) }))
  if (boards.length) {
    await changeScope(scopes, path, () => [...boards, { type: 'scope.describe', patch: { activeDiagramId: fresh.activeDiagramId } }])
  }
  const board = fresh.model.diagrams[0]
  return {
    path, id, name, kind: asked.withBoard ? 'landscape' : 'domain',
    ...(board ? { board: { id: board.id, name: board.name } } : {}),
  }
}

// --- serving it -------------------------------------------------------------------

/** A unit linked, and the type the scope took, where it took one. */
export type Served = { unit: ElementId; keptIn: ScopePath; scopeType?: UnitTypeId }

/**
 * A unit linked to serve a scope, as *Served by* links one (ADR-0036,
 * amended 11 and 17 October 2026): the unit's `scopes` written in the scope
 * that keeps it, and the scope's type following the unit's in its own
 * header, in one apply — all or none. Refused with the key a write meets:
 * `agent.unknownId` for a unit nobody keeps, `shell.scopeReadOnly` where the
 * person may not write one of the two, the repository's own otherwise.
 */
export async function serveScopeBy(
  deps: { scopes: ScopeReader & Pick<ScopeRepository, 'apply'>; index: ScopeIndex; writable: (path: ScopePath) => boolean; today: string },
  path: ScopePath, unitId: ElementId,
): Promise<Served | { refused: string; scope?: ScopePath }> {
  const { scopes, index, writable, today } = deps
  const kept = index.units().find(({ unit }) => unit.id === unitId)
  if (!kept) return { refused: 'agent.unknownId' }
  const followed = typeFollowingUnit(index, path, unitId, today)
  const touched = [kept.scope, ...(followed !== undefined ? [path] : [])]
  const closed = touched.find((one) => !writable(one))
  if (closed !== undefined) return { refused: 'shell.scopeReadOnly', scope: closed }
  const filedIn = (id: ElementId) => (id === unitId ? kept.scope : undefined)
  try {
    const after = await changeScopes(scopes, touched, (held) => {
      const commands = new Map<ScopePath, ScopeCommand[]>()
      const add = (at: ScopePath, list: readonly ScopeCommand[]) => commands.set(at, [...(commands.get(at) ?? []), ...list])
      const unit = held.get(kept.scope)?.model.elements.find((one) => one.id === unitId && one.ref === undefined)
      if (unit) {
        const next = scopesWith(unit, path, filedIn)
        if (JSON.stringify(next) !== JSON.stringify(unit.scopes)) add(kept.scope, [{ type: 'element.update', id: unitId, patch: { scopes: next } }])
      }
      if (followed !== undefined && held.get(path)?.unitTypeId !== followed) add(path, [{ type: 'scope.describe', patch: typedByUnitType(followed) }])
      return commands
    })
    if (!after) return { refused: 'shell.scopeGone' }
  } catch (cause) {
    if (cause instanceof ShellError) return { refused: cause.key }
    throw cause
  }
  return { unit: unitId, keptIn: kept.scope, ...(followed !== undefined ? { scopeType: followed } : {}) }
}

// --- describing it ----------------------------------------------------------------

/** What the settings dialog says about a scope, the whole form at once. */
export type ScopeSettings = {
  name: string
  client?: string
  description?: string
  links?: readonly RecordLink[]
  /** The built-in kind, where the caller speaks that vocabulary alone; `type` says both and wins where given. */
  kind?: ScopeKind
  /** The one picker's value (`TypeChoice`): a unit type, a built-in kind, or nothing. */
  type?: string
}

/** What the settings dialog says about a scope, as the two steps that say it. */
export function settingsCommands(name: string, settings: ScopeSettings): ScopeCommand[] {
  const links = normaliseLinks(settings.links ? [...settings.links] : undefined)
  return [
    { type: 'project.settings', patch: { name, description: settings.description?.trim() || undefined } },
    {
      type: 'scope.describe',
      patch: {
        client: settings.client?.trim() || undefined,
        links: links.length ? links : undefined,
        // The one picker says both fields; a caller speaking kinds alone sets the kind as before.
        ...(settings.type !== undefined ? typeChosen(settings.type) : settings.kind ? { kind: settings.kind } : {}),
      },
    },
  ]
}

/**
 * The settings dialog's save: a scope with no document yet is made first,
 * then the form is written over the scope as it stands, so its model,
 * decisions and plans survive a change the form cannot see.
 */
export async function writeSettings(scopes: TreeScopes, path: ScopePath, name: string, settings: ScopeSettings): Promise<void> {
  await ensureScope(scopes, path, { name })
  await changeScope(scopes, path, () => settingsCommands(name, settings))
}

/** What a scope says about itself, as a patch: absent keeps a field, null clears an optional one. */
export type ScopeHeader = {
  name?: string
  description?: string | null
  kind?: ScopeKind | null
  unitTypeId?: string | null
  client?: string | null
  links?: readonly RecordLink[] | null
}

const HEADER_FIELDS = ['name', 'description', 'kind', 'unitTypeId', 'client', 'links'] as const

/** A header field as the scope holds it, for telling a change from a field said again. */
function heldField(held: ScopeSnapshot, field: (typeof HEADER_FIELDS)[number]): unknown {
  switch (field) {
    case 'name': return held.model.name
    case 'description': return held.model.description
    default: return held[field]
  }
}

/** A value as it lands: text trimmed, nothing for empty text or an empty list, links normalised. */
function landing(field: (typeof HEADER_FIELDS)[number], value: unknown): unknown {
  if (value === null || value === undefined) return undefined
  if (field === 'links') {
    const links = normaliseLinks([...(value as readonly RecordLink[])])
    return links.length ? links : undefined
  }
  if (typeof value === 'string' && field !== 'kind' && field !== 'unitTypeId') return value.trim() || undefined
  return value
}

/**
 * Part of what a scope says about itself, changed (ADR-0040 §1): the same
 * two steps the settings dialog writes, `project.settings` for the name and
 * the description and `scope.describe` for the rest, with only the fields
 * that differ from what the scope holds — worked out again over a scope
 * somebody moved in between. Answers which fields changed; nothing where the
 * scope is not there.
 */
export async function describeScopeAt(
  scopes: TreeScopes, path: ScopePath, header: ScopeHeader,
): Promise<{ changed: (keyof ScopeHeader)[] } | undefined> {
  let changed: (keyof ScopeHeader)[] = []
  const after = await changeScope(scopes, path, (held) => {
    const differing = HEADER_FIELDS.filter((field) => field in header
      && JSON.stringify(landing(field, header[field])) !== JSON.stringify(heldField(held, field)))
    changed = differing
    const value = (field: (typeof HEADER_FIELDS)[number]) => landing(field, header[field])
    const settings = Object.fromEntries(differing.filter((field) => field === 'name' || field === 'description').map((field) => [field, value(field)]))
    // Null clears in a describe patch, which a step that crosses a wire as JSON keeps where it would lose undefined.
    const describe = Object.fromEntries(differing.filter((field) => field !== 'name' && field !== 'description').map((field) => [field, value(field) ?? null]))
    return [
      ...(Object.keys(settings).length ? [{ type: 'project.settings', patch: settings } as const] : []),
      ...(Object.keys(describe).length ? [{ type: 'scope.describe', patch: describe } as const] : []),
    ]
  })
  return after ? { changed } : undefined
}

// --- moving it --------------------------------------------------------------------

export type MovedUnder = {
  from: ScopePath
  to: ScopePath
  /** The scopes elsewhere whose stand-ins, causes or lines were re-addressed. */
  carried: ScopePath[]
  /** The scopes that could not be: the move stands, and the check for drift says it until somebody refreshes them. */
  notCarried: { scope: ScopePath; reason: string }[]
}

/**
 * A scope and everything filed under it, to `parent`, at the address the
 * settings dialog gives a move: its last segment kept, suffixed where that is
 * taken under the new parent. The repository's move and the carry that
 * follows it (`scopeAccess.moveScope`). `strict`, the screen's, throws a
 * carry the repository refused; otherwise each is said in `notCarried`.
 */
export async function moveScopeUnder(
  scopes: TreeScopes, index: Pick<OrganisationIndex, 'read'>, from: ScopePath, parent: ScopePath,
  options: { listing?: ScopeSummary; strict?: boolean } = {},
): Promise<MovedUnder | undefined> {
  const listing = options.listing ?? summaryOf(await scopes.tree())
  const siblings = namesUnder(flattenScopes(listing).find((scope) => scope.path === parent))
  const to = scopePathFor(parent, scopePathLabel(from), siblings)
  const carried: ScopePath[] = []
  const notCarried: { scope: ScopePath; reason: string }[] = []
  const moved = await moveScope(scopes, index, from, to, undefined, options.strict ? undefined : {
    carried: (address) => carried.push(address),
    refused: (address, key) => notCarried.push({ scope: address, reason: key }),
  })
  return moved ? { from, to, carried, notCarried } : undefined
}

// --- removing it ------------------------------------------------------------------

/**
 * One scope removed, expecting the revision it was read at where `expects`
 * is given, so a scope somebody added to between the look and the removal is
 * refused rather than taken. The repository removes the subtree; a caller
 * that must not take one asks first. Answers the addresses that went, and
 * nothing where no scope is there.
 */
export async function removeScopeAt(scopes: TreeScopes, path: ScopePath, expects?: string): Promise<ScopePath[] | undefined> {
  const tree = await scopes.tree()
  const node = nodeAt(tree, path)
  if (!node) return undefined
  const gone = new Set(landed(await scopes.remove(node.id, expects)).removed)
  return nodesOf(node).filter((one) => gone.has(one.id)).map((one) => one.address)
}
