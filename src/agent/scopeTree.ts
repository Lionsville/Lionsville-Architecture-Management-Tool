// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The tree of scopes, as an agent may keep it (ADR-0040 §1, §2): a scope
 * made under another, described, moved and removed — the four gestures the
 * organisation screen has, through the same operations
 * (`projects/scopeTree.ts`).
 *
 * **About the tree, not about the scope open.** The four take no `scope` and
 * no `ifRevision` (`ON_THE_TREE`), name the scope they are about by `path`,
 * and are answered with or without a scope open (ADR-0019). Each is a write:
 * it drives, and lands as that scope's own step by the person via the agent,
 * never as a step on the open session's stack — so no `batch` holds one.
 *
 * **What is checked here is checked once for every host**: the arguments, a
 * path or a parent that is not there, the organisation that is neither moved
 * nor removed, a kind and a unit type said together, a unit type the
 * operating model does not hold, a scope with scopes under it, a scope with
 * work in it and the person's words that alone let it go. A host fills
 * {@link ScopesView} with the writes and says what only it can know: who may
 * write where, and — on the desktop — that the scope open is the session's.
 *
 * `agent` may not import `projects`, so the shapes here are structural; the
 * host's values, `projects/scopeHolds.ts`'s and `projects/scopeTree.ts`'s,
 * satisfy them without either side naming the other.
 */
import type { AgentAnswer, AgentRefusal } from './tools'
import { json, refused } from './tools'
import type { TreeView } from './tree'

/** What a scope says about itself, as scope.update patches it: null clears an optional field. */
export type ScopeHeader = {
  name?: string
  description?: string | null
  kind?: 'organisation' | 'domain' | 'programme' | 'team' | 'landscape' | null
  unitTypeId?: string | null
  client?: string | null
  links?: readonly { label: string; url: string }[] | null
}

/** What a scope holds, by kind (ADR-0040 §2). All zero is empty. */
export type ScopeHolds = {
  readonly views: number; readonly elements: number; readonly relations: number
  readonly decisions: number; readonly plans: number
  readonly observations: number; readonly causes: number; readonly solutions: number; readonly experiments: number
  readonly assignments: number; readonly comments: number; readonly marks: number
  /** unitTypes + roles + responsibilities + operatingRules */
  readonly operatingModel: number
  readonly pictures: number
  /** The views' names, at most ten, for the refusal's detail. */
  readonly viewNames: readonly string[]
}

/** One scope as a removal or a move reads it, just before. */
export type ScopeRead = {
  readonly path: string
  readonly name: string
  /** The repository's revision, handed back as `expects`. */
  readonly revision: string
  readonly holds: ScopeHolds
  /** Every scope filed under it that the person may read, by path. */
  readonly below: readonly string[]
  /** Scopes filed under it that the person may NOT read: counted over the whole tree, never named. */
  readonly hiddenBelow: number
}

/** The refusals a host answers with; the handler maps the repository's own (§1 of the ADR). */
export type TreeRefusal =
  | 'agent.readOnly' | 'agent.unknownScope' | 'agent.unknownId' | 'agent.stale'
  | 'scope.isOpen' | 'scope.organisation'
  | 'shell.scopeTaken' | 'shell.scopeIntoItself' | 'shell.badScopePath'

export type TreeRefused = { readonly refused: TreeRefusal; readonly scope?: string; readonly detail?: string }

export type ServedFrom = { readonly unit: string; readonly keptIn: string; readonly scopeType?: string }

/** The tree as a host lends it to the agent (`ShellView.scopes`). Every write is that scope's step, by the person via the agent. */
export type ScopesView = {
  /** One scope, read fresh; nothing where the person may not read one at that path. */
  read(path: string): Promise<ScopeRead | undefined>
  /** Made at the dialog's address under `parent` (scopePathFor); a landscape with one board where `withBoard`, a domain otherwise. */
  create(asked: { parent: string; name: string; withBoard: boolean }): Promise<
    { path: string; name: string; kind: 'landscape' | 'domain'; revision: string; board?: { id: string; name: string } } | TreeRefused>
  /** A unit linked to serve a scope: the unit's `scopes` where it is kept, the scope's type following, one apply. */
  serve(path: string, unitId: string): Promise<ServedFrom | TreeRefused>
  /** project.settings + scope.describe, one change, worked out again over a scope that moved in between. */
  describe(path: string, header: ScopeHeader): Promise<{ path: string; changed: readonly (keyof ScopeHeader)[] } | TreeRefused>
  /** To `parent`, the last segment kept or suffixed; stand-ins elsewhere re-addressed, each scope its own step. */
  move(path: string, parent: string): Promise<
    { from: string; to: string; carried: readonly string[]; notCarried: readonly { scope: string; reason: string }[] } | TreeRefused>
  /** This one scope, expecting `why.expects`. Called only for a scope with nothing below (the handler checked). */
  remove(path: string, why: { expects: string; holds: ScopeHolds; personSaid?: string }): Promise<
    { removed: readonly string[]; rightsRevoked?: number } | TreeRefused>
}

export const TREE_TOOLS = ['scope.create', 'scope.update', 'scope.move', 'scope.remove'] as const
export type TreeTool = (typeof TREE_TOOLS)[number]

export function isTreeTool(tool: string): tool is TreeTool {
  return (TREE_TOOLS as readonly string[]).includes(tool)
}

type Args = Record<string, unknown>

/** The fewest words a person's own words may be: enough to be a sentence somebody said, not a token. */
export const PERSON_SAID_WORDS = 3

const ORGANISATION = ''

/** A host's refusal, as the agent's answer. */
function hostRefused(answer: TreeRefused): AgentAnswer {
  return refused(answer.refused as AgentRefusal, answer.detail ?? (answer.scope !== undefined ? `scope ${answer.scope || 'the organisation'}` : undefined))
}

const isRefused = <T extends object>(answer: T | TreeRefused): answer is TreeRefused => 'refused' in answer

/** Is `path` the scope `within`, or filed anywhere under it? */
function atOrUnder(path: string, within: string): boolean {
  return path === within || path.startsWith(`${within}/`)
}

/** What a scope holds, its kinds with something in them, and the views by name. */
function heldOf(holds: ScopeHolds): Record<string, unknown> {
  const counts = Object.entries(holds).filter(([key, value]) => key !== 'viewNames' && value !== 0)
  return { ...Object.fromEntries(counts), ...(holds.viewNames.length ? { viewNames: holds.viewNames } : {}) }
}

function holdsNothing(holds: ScopeHolds): boolean {
  return Object.entries(holds).every(([key, value]) => key === 'viewNames' || value === 0)
}

/** The scope at a path, or the refusal that says there is none. */
async function there(view: ScopesView, path: string): Promise<ScopeRead | AgentAnswer> {
  return (await view.read(path)) ?? refused('agent.unknownScope', path || 'the organisation')
}

const isAnswer = (value: ScopeRead | AgentAnswer): value is AgentAnswer => 'ok' in value

async function createScope(view: ScopesView, args: Args, tree: TreeView | undefined): Promise<AgentAnswer> {
  const parent = args.parent as string
  const name = String(args.name ?? '').trim()
  if (!name) return refused('agent.badArguments', 'a scope needs a name')
  const servedBy = typeof args.servedBy === 'string' ? args.servedBy : undefined
  const units = tree?.units?.()
  const keeper = servedBy === undefined ? undefined : units?.find(({ unit }) => unit.id === servedBy && unit.unitTypeId !== undefined)
  if (servedBy !== undefined && units && !keeper) return refused('agent.unknownId', `unit ${servedBy}`)
  const above = await there(view, parent)
  if (isAnswer(above)) return above
  const made = await view.create({ parent, name, withBoard: args.withBoard === true })
  if (isRefused(made)) return hostRefused(made)
  if (servedBy === undefined) return json(made)
  // The scope stays whatever the link comes to: it was asked for first, and is there.
  const link = await view.serve(made.path, servedBy)
  if (!isRefused(link)) return json({ ...made, servedBy: link })
  return json({
    ...made,
    servedBy: {
      unit: servedBy, refused: link.refused, ...(link.detail ? { detail: link.detail } : {}),
      instead: `the scope is made; the link is the unit's scopes, written with element.update in ${keeper?.scope || 'the scope that keeps the unit'}`,
    },
  })
}

/** The header a call asks for, or what is wrong with it. */
function headerAsked(args: Args, tree: TreeView | undefined): ScopeHeader | AgentAnswer {
  const header: ScopeHeader = {}
  if (args.name === null || (typeof args.name === 'string' && !args.name.trim())) return refused('agent.badArguments', 'a scope keeps a name: give another')
  if (typeof args.name === 'string') header.name = args.name
  for (const field of ['description', 'client', 'links'] as const) {
    if (args[field] !== undefined) (header as Record<string, unknown>)[field] = args[field]
  }
  const kind = args.kind
  const unitTypeId = args.unitTypeId
  // One of the two is said, never both (ADR-0036, amended 17 October 2026).
  if (typeof kind === 'string' && typeof unitTypeId === 'string') {
    return refused('agent.badArguments', 'a scope says a kind or a unit type, not both: the one given clears the other')
  }
  if (typeof unitTypeId === 'string') {
    const known = tree?.operatingModel?.().unitTypes
    if (known && !known.some((type) => type.id === unitTypeId)) return refused('agent.unknownId', `unit type ${unitTypeId}`)
    header.unitTypeId = unitTypeId
    header.kind = null
  } else if (unitTypeId === null) header.unitTypeId = null
  if (typeof kind === 'string') {
    header.kind = kind as NonNullable<ScopeHeader['kind']>
    header.unitTypeId = null
  } else if (kind === null) header.kind = null
  if (Object.keys(header).length === 0) return refused('agent.badArguments', 'nothing to change: name a field')
  return header
}

async function updateScope(view: ScopesView, args: Args, tree: TreeView | undefined): Promise<AgentAnswer> {
  const path = args.path as string
  const header = headerAsked(args, tree)
  if ('ok' in header) return header as AgentAnswer
  const held = await there(view, path)
  if (isAnswer(held)) return held
  const answer = await view.describe(path, header)
  return isRefused(answer) ? hostRefused(answer) : json(answer)
}

async function moveScope(view: ScopesView, args: Args): Promise<AgentAnswer> {
  const path = args.path as string
  const parent = args.parent as string
  if (path === ORGANISATION) return refused('scope.organisation')
  if (atOrUnder(parent, path)) return refused('shell.scopeIntoItself', `${parent} is ${path} or filed under it`)
  const held = await there(view, path)
  if (isAnswer(held)) return held
  const above = await there(view, parent)
  if (isAnswer(above)) return above
  const filed = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ORGANISATION
  if (filed === parent) return json({ from: path, to: path, moved: false, why: 'it is filed there already' })
  const answer = await view.move(path, parent)
  return isRefused(answer) ? hostRefused(answer) : json({ ...answer, moved: true })
}

async function removeScope(view: ScopesView, args: Args): Promise<AgentAnswer> {
  const path = args.path as string
  if (path === ORGANISATION) return refused('scope.organisation')
  const contents = args.removeContents === true
  const said = typeof args.personSaid === 'string' ? args.personSaid.trim() : ''
  // The two are only ever set together: the words are what the override rests on.
  if (contents && said.split(/\s+/).filter(Boolean).length < PERSON_SAID_WORDS) {
    return refused('agent.badArguments', `removeContents needs personSaid: the person's own words, quoted, at least ${PERSON_SAID_WORDS} words`)
  }
  if (!contents && said) return refused('agent.badArguments', 'personSaid goes with removeContents, and only after the person said the scope is to go with all it holds')
  const held = await there(view, path)
  if (isAnswer(held)) return held
  // Never a subtree in one call, whatever else the call says (ADR-0040 §2).
  if (held.below.length + held.hiddenBelow > 0) {
    return refused('scope.scopesBelow', JSON.stringify({ below: held.below, ...(held.hiddenBelow ? { hiddenBelow: held.hiddenBelow } : {}) }))
  }
  if (!holdsNothing(held.holds) && !contents) return refused('scope.notEmpty', JSON.stringify({ scope: path, name: held.name, holds: heldOf(held.holds) }))
  const answer = await view.remove(path, { expects: held.revision, holds: held.holds, ...(contents ? { personSaid: said } : {}) })
  if (isRefused(answer)) return hostRefused(answer)
  return json({
    removed: answer.removed,
    held: heldOf(held.holds),
    ...(contents ? { personSaid: said } : {}),
    ...(answer.rightsRevoked !== undefined ? { rightsRevoked: answer.rightsRevoked } : {}),
  })
}

/** The four, answered over the view; refused `agent.noTree` where the host lends none. */
export async function answerTree(tool: TreeTool, args: unknown, view: ScopesView | undefined, tree: TreeView | undefined): Promise<AgentAnswer> {
  if (!view) return refused('agent.noTree')
  const given = (args ?? {}) as Args
  switch (tool) {
    case 'scope.create': return createScope(view, given, tree)
    case 'scope.update': return updateScope(view, given, tree)
    case 'scope.move': return moveScope(view, given)
    case 'scope.remove': return removeScope(view, given)
    default: {
      const unexpected: never = tool
      return unexpected
    }
  }
}
