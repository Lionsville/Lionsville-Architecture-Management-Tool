/**
 * Where scopes are kept.
 *
 * This is the seam the shell asks for and the outside world answers. The shell
 * knows only these lines; it does not know whether `localStorage` sits
 * underneath, or files on disk, a folder in OneDrive, or a server. Adding a
 * second place to keep things is therefore a new file under `src/adapters/` and
 * one line in the composition — not an `if` in fifteen places.
 *
 * It replaces two seams, because ADR-0012 §1 replaced two records with one.
 * `ProjectStore` held the documents and `GroupStore` held what a namespace said
 * about itself; a scope is both, at every level, so a store that could return
 * one and not the other was drawing a line the model no longer has.
 *
 * **Scopes are addressed, not implied.** A store holds many, keyed by
 * {@link ScopePath} — the folder, from the root of the tree. A store that keeps
 * scopes in folders uses it as the path directly; one that keeps them in a
 * table uses it as a primary key. The root is the empty path, it is the
 * organisation, and it is a scope like any other: it can be listed, loaded and
 * saved.
 *
 * **Why everything returns a promise, even though `localStorage` is
 * synchronous.** Every backend that comes after this one — the File System
 * Access API, Electron over IPC, a server — is asynchronous. Were this contract
 * synchronous today, the first such adapter would break every caller and the
 * seam would have bought nothing.
 *
 * **Why `list()` returns a tree of summaries and not scopes.** A screen needs
 * names, kinds and dates, not models. A store that can answer cheaply (a
 * directory walk reading one `scope.json` each) should be allowed to; returning
 * whole scopes would force every store into the expensive shape. A tree rather
 * than a flat list because the nesting IS the structure — flattening it only to
 * group it again is how two orderings come to disagree.
 */
import type { ScopeModel, ScopeSnapshot, ScopeSummary } from '../projects/scope'
import type { ScopePath } from '../projects/scopePath'


export interface ScopeStore {
  /**
   * Where this one keeps things, in plain words ('browser storage', 'disk').
   *
   * For messages and for the trail: "saving failed" is too thin when there are
   * three places it could have gone wrong.
   */
  readonly id: string

  /**
   * Everything this store holds, as the tree it is.
   *
   * Always answers — the root exists whether or not anybody has named it, and a
   * store with nothing in it answers with a root that has no children. That is
   * what makes "there is nothing here yet" a screen rather than a failure.
   */
  list(): Promise<ScopeSummary>

  /**
   * One scope, or `undefined` when it is not there.
   *
   * Deliberately `undefined` and not an error: a path remembered from last time
   * can name a scope since deleted, and the caller does the same thing with
   * that as with a first visit. A genuine failure — the disk is gone,
   * permission is missing — may reject.
   *
   * A scope with no views comes back like any other. Whether the canvas can
   * show one is the shell's question, not this seam's.
   */
  load(path: ScopePath): Promise<ScopeSnapshot | undefined>

  /**
   * Write a scope out, at its own path.
   *
   * The path comes from the scope rather than a separate argument so the two
   * can never disagree — saving a scope at somebody else's address is not a
   * thing a caller should be able to express by accident.
   */
  save(scope: ScopeSnapshot): Promise<void>

  /**
   * Remove one scope, and everything filed under it.
   *
   * A scope is a folder and its children are inside it; removing the folder and
   * leaving the children would leave them addressed by nothing. Removing what
   * is not there is not an error.
   */
  remove(path: ScopePath): Promise<void>

  /**
   * How close this store is to being full, when it can say.
   *
   * Optional, because most places to keep things cannot answer it and should not
   * pretend to: a folder on disk is as large as the disk, and a server's limit
   * is not the client's business. Browser storage is the one that CAN answer,
   * because its limit is small, fixed, shared with everything else on the
   * origin, and reached in silence — a quota failure is the first anybody hears
   * of it, and by then the save has already not happened.
   *
   * An estimate, and said to be one. Nothing exposes the real limit.
   */
  pressure?(): StoragePressure | undefined

  /**
   * The scopes this store holds in a form an older version of this tool wrote,
   * if it can tell.
   *
   * The storage format is the store's business and nobody else's, so this is
   * the one question the migration cannot answer for itself (ADR-0012 §11 and
   * `projects/migrate4to5.ts`). It is asked on every open and is almost always
   * empty, so it is written to be cheap: one header per scope, no content.
   *
   * Optional because a store need not have a past. An in-memory one has none,
   * and a backend written after the format turned has none either; absent means
   * "nothing of mine is old", which is the honest answer in both cases.
   */
  outdated?(): Promise<ScopePath[]>

  /**
   * Every scope's records and rows, and nothing else — what the index is built
   * from (ADR-0012 §2).
   *
   * An id names one thing across the whole organisation, so the questions
   * "who owns this" and "who else draws it" are questions about the tree
   * rather than about the scope that is open. They are asked once per open and
   * again whenever the watcher says the folder changed, over every scope
   * `list()` can see — which makes the cost of this the cost of opening
   * anything at all, and is why it reads **one file per scope** and never a
   * description, a view, a decision or a geometry.
   *
   * Optional, like {@link ScopeStore.outdated}, and for the same kind of
   * reason: a store that keeps whole snapshots has nothing cheaper to offer
   * than `load()`, and the index falls back to loading each scope rather than
   * going without. Absent therefore costs correctness nothing and costs an
   * open a little more, which is the right way round for something a backend
   * may not be able to do.
   */
  models?(): Promise<ScopeModel[]>

  /**
   * One scope's descriptions, by element id, and nothing else.
   *
   * The other half of what `models` leaves out. An overview shows a stand-in
   * with the description its owner holds (ADR-0012 §3), which is one file per
   * element in the owning scope — and `load()` reads that scope's pictures,
   * marks and geometry as well, with a modification time per file, to answer
   * a question about a few paragraphs of prose. `undefined` for a scope the
   * store does not hold.
   *
   * Optional for the reason `models` is: a store that keeps whole snapshots
   * has nothing cheaper than `load()`, and the reader falls back to it.
   */
  descriptions?(path: ScopePath): Promise<Record<string, string> | undefined>
}

/** How much
 of what a store will hold is already held. Characters, not bytes. */
export type StoragePressure = {
  used: number
  budget: number
}
