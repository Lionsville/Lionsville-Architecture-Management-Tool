/**
 * One identity across the organisation: who owns an id, and who else draws it
 * (ADR-0012 §2).
 *
 * An element id is unique across the whole tree rather than within one
 * document, and that single change is what makes federation cheap: a domain
 * drawing another domain's ERP writes a record with **the same id**, so there
 * is no join table, no alias, and no `{scope, id}` pair to resolve. What it
 * costs is this — an index over every scope's `model.json`, computed once per
 * open and again whenever the watcher says the folder changed.
 *
 * **Everything organisation-wide is derived, and nothing is stored.** There is
 * no register file, no owner field and no materialised list: a list every
 * domain edits is a merge conflict every domain edits, and a derived one is
 * right by construction. That is the same choice groups-derived-from-projects
 * was, for the same reason.
 *
 * **Three things one record can be**, told apart by what it carries and never
 * by a type field (§3):
 *
 * - a **definition** — no `ref`. The deepest one in the tree is the **master**:
 *   that scope answers for the thing, and its name is the name.
 * - a **declaration** — a definition above the master. The thin first layer,
 *   `{ id, kind, name }`, which names the thing until somebody deeper takes it
 *   and is a cache from then on. It yields; it never overrules.
 * - a **stand-in** — `ref` present. Drawn here, defined there.
 *
 * One rule therefore serves two opposite directions of authority, which is the
 * point. Business functions are top-down: the organisation defines
 * `fulfilment`, a domain refines it by holding a stand-in with children under
 * it, so the organisation's record stays the deepest and the name stays the
 * organisation's. Applications are bottom-up: retail defines `erp`, that is the
 * master, and a rename there is retail's to make.
 *
 * **Uniqueness is a check, not a refusal.** Two scopes that each define `erp`
 * are a conflict *finding* — somebody is mid-migration, or two teams named the
 * same thing on the same afternoon — and a tool that refused the second
 * definition would refuse the state every real merge goes through. The findings
 * themselves are `checks.ts`; this file only says what is true.
 *
 * **Why it lives in `projects/` and not in `model/`.** The whole of it is
 * arithmetic over paths, and what a path IS belongs here: depth is the rule
 * that decides a master, and `model/` may not know that a scope exists. The
 * cost is that `agent/`, which may not import `projects`, cannot name this type
 * — so it declares the lookups it needs and is handed them, the way it is
 * handed a `RendererView`.
 *
 * Pure: `(path, model)` pairs in, answers out. No store, no React, no promise.
 */
import type { ElementId, ElementKind, Relation, RelationType } from '../model'
import { flattenScopes } from './scope'
import type { ScopeModel, ScopeSnapshot, ScopeSummary } from './scope'
import { scopeSegments } from './scopePath'
import type { ScopePath } from './scopePath'

/**
 * What the tree knows about one id.
 *
 * `name` and `kind` come from the master where there is one, and from a
 * stand-in's cache where there is not — a dangling id is still worth naming on
 * screen, and the cached name is the only name anybody wrote down.
 */
export type IndexEntry = {
  id: ElementId
  kind: ElementKind
  /** The authoritative name: the master's, or a cache where nobody defines it. */
  name: string
  /**
   * The deepest scope that defines it — the scope that answers for it.
   *
   * Absent when no scope in the tree holds a definition, which is the dangling
   * case: every record of it is a stand-in of something nobody has written
   * down. *Link* is how such a record gets a master (§10); until then it is a
   * finding and never a refusal.
   */
  master?: ScopePath
  /**
   * Definitions above the master, deepest first — the thin layer that yields.
   *
   * The master is not in here. A tree with one definition therefore has an
   * empty list, which is the ordinary case for both directions of authority.
   */
  declarations: ScopePath[]
  /** Every scope holding a stand-in of it, in path order: who else draws it. */
  drawnIn: ScopePath[]
  /**
   * Scopes whose cached `name` or `ref` disagrees with the master — the drift
   * of §2's table, said here because it is a fact about the tree rather than
   * an opinion about it.
   *
   * Stand-ins AND declarations: a declaration is the thin first layer that
   * yielded when somebody deeper took the id, and from that moment its name is
   * a cache like any other. A refresh rewrites them; a person does not.
   *
   * Empty is the ordinary case, and it is empty rather than absent because
   * every reader folds over it.
   */
  stale: ScopePath[]
  /**
   * Two or more definitions at the master's own depth, in path order.
   *
   * Absent is ordinary and present is a finding on every scope named. The
   * master is the first of them by path, so that everything else in this index
   * still has one answer while a person decides which of the two to turn into
   * a stand-in.
   */
  conflict?: ScopePath[]
}

/** One row, and the scope whose `model.json` holds it. */
export type IndexedRelation = { scope: ScopePath; relation: Relation }

/**
 * The answers, over a tree that has already been read.
 *
 * Functions rather than exposed maps, because two of them are derived orders
 * (`register`, `entries`) and one is a set the id policy is handed every time
 * it mints a key. Everything is computed once in {@link indexScopes}; nothing
 * here walks the tree again.
 */
export type ScopeIndex = {
  /** What the tree knows about one id, or `undefined` if it has never seen it. */
  lookup(id: ElementId): IndexEntry | undefined
  /**
   * Every application in the organisation, by name — the derived register of
   * §2, which the register page reads and nothing commits.
   *
   * Applications only, and deliberately: a function's name and an
   * application's name have nothing to do with each other, and a register that
   * mixed them would be a list of two things.
   */
  register(): IndexEntry[]
  /** Every entry, in id order. What the checks walk. */
  entries(): IndexEntry[]
  /**
   * Every id spoken for anywhere in the tree — elements and rows both, because
   * they share a document's namespace (`model/keys.ts`).
   *
   * What {@link ../model/keys.idPolicy} is handed, so a new element drawn in
   * one scope cannot take a name a sibling has used.
   *
   * The index's own set rather than a copy of it, because minting a key asks
   * for it and copying a hundred thousand ids per ask would be the shape the
   * budget line watches for. Nothing may write to it; `idPolicy` takes its own
   * copy before adding what it has handed out.
   */
  takenIds(): Set<string>
  /**
   * Every row in the tree that points AT this id, wherever it was written.
   *
   * The cross-scope half of coverage (§9): the applications supporting a
   * capability defined at the organisation are in a landscape's model, so a
   * sheet drawn at the root has to read rows it does not hold. Per id rather
   * than as one list of every row, so a page pays for the functions it draws.
   */
  rowsTo(id: ElementId, types?: readonly RelationType[]): IndexedRelation[]
  /** The scopes this was built from, in path order. */
  scopes(): ScopePath[]
}

/** An index over nothing: what a session has before anything has been read. */
export const EMPTY_INDEX: ScopeIndex = indexScopes([])

/**
 * Build the index from every scope's records and rows.
 *
 * One pass per list into three maps. The depth of a path is worked out once per
 * scope rather than once per record, and no entry is ever searched for — both
 * because this is paid on every open over a whole organisation, and an
 * ancestor walk per element would not show at all on one scope (ADR-0004's
 * budget line is `index`).
 *
 * Later scopes do not overwrite earlier ones: which definition is the master is
 * decided by depth and then by path, so the answer does not depend on the order
 * a store happened to enumerate its folders in.
 */
export function indexScopes(models: readonly ScopeModel[]): ScopeIndex {
  type Held = {
    id: ElementId
    definitions: { path: ScopePath; depth: number; kind: ElementKind; name: string }[]
    standIns: { path: ScopePath; kind: ElementKind; name: string; ref: string }[]
  }

  const held = new Map<ElementId, Held>()
  const taken = new Set<string>()
  const incoming = new Map<ElementId, IndexedRelation[]>()
  const paths: ScopePath[] = []

  const at = (id: ElementId): Held => {
    const found = held.get(id) ?? { id, definitions: [], standIns: [] }
    held.set(id, found)
    return found
  }

  for (const { path, model } of [...models].sort((a, b) => a.path.localeCompare(b.path))) {
    paths.push(path)
    const depth = scopeSegments(path).length
    for (const element of model.elements) {
      taken.add(element.id)
      const row = at(element.id)
      if (element.ref === undefined) {
        row.definitions.push({ path, depth, kind: element.kind, name: element.name })
      } else {
        row.standIns.push({ path, kind: element.kind, name: element.name, ref: element.ref })
      }
    }
    for (const relation of model.relations) {
      taken.add(relation.id)
      const rows = incoming.get(relation.targetId) ?? []
      rows.push({ scope: path, relation })
      incoming.set(relation.targetId, rows)
    }
  }

  const entries = new Map<ElementId, IndexEntry>()
  for (const row of held.values()) {
    // Deepest first, then by path, so the master of a tie is the same scope
    // whatever order the store listed them in.
    const definitions = [...row.definitions]
      .sort((a, b) => b.depth - a.depth || a.path.localeCompare(b.path))
    const master = definitions[0]
    const tied = definitions.filter((one) => one.depth === master?.depth)
    // A name nobody defines is the cache somebody wrote down, which is better
    // than the id and is the only name a dangling record has.
    const named = master ?? row.standIns[0]
    // A cache is only stale against a master; with no definition anywhere
    // there is nothing for one to disagree with, and the finding is that
    // nobody defines it at all (dangling) rather than that the copy is old.
    const stale = master === undefined ? [] : [
      ...row.standIns.filter((one) => one.name !== master.name || one.ref !== master.path),
      // A declaration carries a name and no `ref` — there is nothing for it to
      // point at, so only the name can have gone stale.
      ...definitions.slice(tied.length).filter((one) => one.name !== master.name),
    ].map((one) => one.path).sort()
    entries.set(row.id, {
      id: row.id,
      kind: named?.kind ?? 'application',
      name: named?.name ?? row.id,
      ...(master ? { master: master.path } : {}),
      declarations: definitions.slice(tied.length).map((one) => one.path),
      drawnIn: row.standIns.map((one) => one.path),
      stale,
      ...(tied.length > 1 ? { conflict: tied.map((one) => one.path).sort() } : {}),
    })
  }

  const inIdOrder = [...entries.values()].sort((a, b) => a.id.localeCompare(b.id))

  return {
    lookup: (id) => entries.get(id),
    register: () => inIdOrder
      .filter((entry) => entry.kind === 'application')
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    entries: () => inIdOrder,
    takenIds: () => taken,
    rowsTo: (id, types) => {
      const rows = incoming.get(id) ?? []
      return types ? rows.filter((row) => types.includes(row.relation.type)) : [...rows]
    },
    scopes: () => [...paths],
  }
}

/**
 * What the index needs from a store: the tree's models, or failing that a
 * listing and a load each.
 *
 * The narrowest shape that will do, rather than a `ScopeStore`: building an
 * index must not be one refactor away from being able to save.
 */
export type IndexSource = {
  models?(): Promise<ScopeModel[]>
  list(): Promise<ScopeSummary>
  load(path: ScopePath): Promise<ScopeSnapshot | undefined>
}

/**
 * The index over whatever a store can tell us about the tree.
 *
 * `models()` is the cheap road and the one every shipped adapter takes: one
 * file per scope. The fallback is there so that a backend written without it
 * is slower rather than wrong — it loads each scope in full, descriptions,
 * views and all, which is the cost the optional clause exists to avoid.
 *
 * A scope that will not load is left out rather than counted as empty, for the
 * reason the folder store gives: an empty model is the claim "this scope
 * defines nothing", and a read that failed is not evidence for it.
 */
export async function indexOf(source: IndexSource): Promise<ScopeIndex> {
  return indexScopes(await treeModels(source))
}

/**
 * Every scope's records and rows, however the store can answer for them.
 *
 * Said out loud rather than kept inside {@link indexOf}, because the index is
 * not the only pass over the whole tree: re-addressing the refs that point
 * into a moved subtree (`readdress.ts`) asks the same question and must not
 * grow a second way of asking it.
 */
export async function treeModels(source: IndexSource): Promise<ScopeModel[]> {
  if (source.models) return source.models()
  const paths = flattenScopes(await source.list()).map((scope) => scope.path)
  const loaded = await Promise.all(paths.map((path) => source.load(path)))
  return loaded
    .filter((scope): scope is ScopeSnapshot => scope !== undefined)
    .map((scope) => ({ path: scope.path, model: scope.model }))
}

/**
 * Which scope answers for this id, from anywhere in the tree.
 *
 * The one question `mayEdit` and every read-only field in an inspector asks,
 * said out loud so neither has to know what an `IndexEntry` is.
 */
export function ownerOf(index: ScopeIndex, id: ElementId): ScopePath | undefined {
  return index.lookup(id)?.master
}

/**
 * Is this record, in this scope, the one the tree answers for?
 *
 * True for a master and false for everything else — a stand-in, a declaration
 * that has been overtaken, and an id this scope does not hold at all. A scope
 * the index has never heard of answers `true` for its own ids, which is the
 * honest answer for a session opened before anything listed the tree: the
 * document in front of you is the only authority there is.
 */
export function isMaster(index: ScopeIndex, id: ElementId, scope: ScopePath): boolean {
  const entry = index.lookup(id)
  if (!entry) return true
  return entry.master === scope
}
