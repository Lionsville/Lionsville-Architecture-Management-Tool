/**
 * The agent at every scope (ADR-0012 §2, §9; plan step 13).
 *
 * A session opens ONE scope, and until this file an agent could only see that
 * one: the register, the findings and the other domains' landscapes were a
 * person's, through the organisation screen. This is the agent's half of the
 * tree, in two parts.
 *
 * **Three reads that are about the tree and not about a document** —
 * `scopes.list`, `register.list`, `checks.list` — answered from the index the
 * shell already holds, the way the organisation screen's cards are: one pass
 * over every scope's `model.json`, and never a load per call.
 *
 * **`scope` on every tool.** A read addressed to another scope is answered
 * over that scope's document, read as it stands on disk through the seam the
 * workspace hands in ({@link TreeView.read}); a write, a picture, undo and the
 * session's own lists need the scope open, because a change is one `Command`
 * at the session that holds the scope (§10) and there is no session for a
 * folder nobody has opened. Those are refused with a key, never silently
 * landed on the open scope.
 *
 * `agent` may not import `projects`, so the index's types are declared here
 * structurally — `IndexEntry` and `Finding` satisfy `TreeEntry` and
 * `TreeFinding` without either side naming the other — which is the same
 * arrangement `ownedElsewhere` and `RendererView` use.
 */
import type { Adr } from '../model/adr'
import type { HostModel } from '../model/fromInterchange'
import type { Transition } from '../model/transition'
import { matchesQuery } from '../model/textSearch'
import type { ElementId, ElementKind } from '../model/types'
import type { AgentAnswer } from './tools'
import { json, refused } from './tools'

/** One scope of the tree, as the listing knows it. */
export type TreeScope = {
  readonly path: string
  readonly name: string
  /** A label for a screen (`organisation` · `domain` · `programme` · `landscape`), never a branch. */
  readonly kind?: string
  /** How many views it holds. Zero is a domain that draws nothing itself. */
  readonly views: number
}

/** What the tree knows about one id: `projects/scopeIndex`'s entry, structurally. */
export type TreeEntry = {
  readonly id: ElementId
  readonly kind: ElementKind
  readonly name: string
  /** The deepest scope that defines it; absent is dangling. */
  readonly master?: string
  readonly declarations: readonly string[]
  readonly drawnIn: readonly string[]
  readonly stale: readonly string[]
  readonly conflict?: readonly string[]
  readonly outside?: true
  readonly partyId?: ElementId
}

/** One finding of ADR-0012 §9: `projects/checks`'s, structurally. */
export type TreeFinding = {
  readonly key: string
  readonly scope: string
  readonly id: string
  readonly name: string
  readonly scopes?: readonly string[]
  readonly fields?: readonly string[]
  readonly information?: true
}

/** Another scope's document, read for one call. */
export type ForeignScope = {
  readonly model: HostModel
  readonly activeDiagramId: string
  /** The records of the scopes above IT, nearest first. */
  readonly ancestorDecisions: readonly Adr[]
}

/** What the handler needs from the tree. Absent in a test with no index, and every answer here is then over nothing. */
export type TreeView = {
  scopes(): readonly TreeScope[]
  lookup(id: ElementId): TreeEntry | undefined
  /** Every application in the organisation, by name (§2). */
  register(): readonly TreeEntry[]
  /** Every finding the tree and the open scope's document raise (§9). */
  findings(): readonly TreeFinding[]
  /** The plans flagged as initiatives in the scopes strictly below `path` (§7). */
  initiativesBelow(path: string): readonly { scope: string; transition: Transition }[]
  /** One scope's whole document, or nothing where there is no such scope. */
  read(path: string): Promise<ForeignScope | undefined>
}

type Args = Record<string, unknown>

/** The scope a call names, where it names one. Not a string is left for the schema check to refuse. */
export function scopeAsked(args: unknown): string | undefined {
  const held = (args as { scope?: unknown } | undefined)?.scope
  return typeof held === 'string' ? held : undefined
}

/** The arguments without `scope`, which the handler has already acted on. */
export function withoutScope(args: unknown): unknown {
  if (!args || typeof args !== 'object') return args
  const { scope: _scope, ...rest } = args as Args
  void _scope
  return rest
}

export function listScopes(tree: TreeView | undefined, open: string): AgentAnswer {
  const scopes = (tree?.scopes() ?? []).map((scope) => ({
    ...scope,
    open: scope.path === open,
  }))
  return json({ open, total: scopes.length, scopes })
}

const REGISTER_LIMIT = 200

export function listRegister(tree: TreeView | undefined, rawArgs: unknown): AgentAnswer {
  const args = (rawArgs ?? {}) as Args
  const limit = (args.limit as number | undefined) ?? REGISTER_LIMIT
  const query = args.query as string | undefined
  const about = new Map<string, string[]>()
  for (const finding of tree?.findings() ?? []) {
    const held = about.get(finding.id) ?? []
    if (!held.includes(finding.key)) held.push(finding.key)
    about.set(finding.id, held)
  }
  const rows: unknown[] = []
  let total = 0
  for (const entry of tree?.register() ?? []) {
    if (query !== undefined && !matchesQuery(query, [entry.name, entry.id, entry.master])) continue
    total += 1
    if (rows.length < limit) {
      rows.push({
        id: entry.id,
        name: entry.name,
        // The organisation is the empty path; said in a word so a reader does
        // not have to know that.
        master: entry.master,
        ...(entry.master === '' ? { masterIsOrganisation: true } : {}),
        declarations: entry.declarations,
        drawnIn: entry.drawnIn,
        ...(entry.outside ? { outside: true } : {}),
        ...(entry.partyId !== undefined ? { partyId: entry.partyId } : {}),
        ...(entry.conflict ? { conflict: entry.conflict } : {}),
        ...(entry.stale.length > 0 ? { stale: entry.stale } : {}),
        findings: about.get(entry.id) ?? [],
      })
    }
  }
  return json({ total, some: rows })
}

const CHECKS_LIMIT = 200

export function listChecks(tree: TreeView | undefined, rawArgs: unknown): AgentAnswer {
  const args = (rawArgs ?? {}) as Args
  const limit = (args.limit as number | undefined) ?? CHECKS_LIMIT
  const scope = args.scope as string | undefined
  const key = args.key as string | undefined
  const information = args.information === true
  const some: TreeFinding[] = []
  let total = 0
  for (const finding of tree?.findings() ?? []) {
    if (scope !== undefined && finding.scope !== scope) continue
    if (key !== undefined && finding.key !== key) continue
    // Information — a master drawn nowhere — is worth knowing and is not a
    // fault; a list of faults leaves it out unless asked.
    if (finding.information && !information) continue
    total += 1
    if (some.length < limit) some.push(finding)
  }
  return json({ total, some })
}

/**
 * Who answers for an id, and who else draws it — the header an element's page
 * shows (§9), on `element.describe`. Absent where there is no tree, or the
 * tree has never seen the id.
 */
export function identityOf(tree: Pick<TreeView, 'lookup'> | undefined, id: ElementId) {
  const entry = tree?.lookup(id)
  if (!entry) return undefined
  return {
    master: entry.master,
    declarations: entry.declarations,
    drawnIn: entry.drawnIn,
    ...(entry.conflict ? { conflict: entry.conflict } : {}),
    ...(entry.stale.length > 0 ? { stale: entry.stale } : {}),
  }
}

/** The refusal every call that needs the scope open meets when it is not. */
export function notOpen(asked: string): AgentAnswer {
  return refused('agent.scopeNotOpen', `${asked || 'the organisation'} is not the scope open in the app`)
}
