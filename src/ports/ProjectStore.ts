/**
 * Where projects are kept.
 *
 * This is the seam the shell asks for and the outside world answers. The shell
 * knows only these five lines; it does not know whether `localStorage` sits
 * underneath, or files on disk, a folder in OneDrive, or a server. Adding a
 * second place to keep things is therefore a new file under `src/adapters/` and
 * one line in the composition — not an `if` in fifteen places.
 *
 * **Projects are addressed, not implied.** A store holds many, keyed by
 * {@link ScopePath} — a path of slug segments (ADR-0012 §1). A store that keeps
 * projects in folders uses it as the path directly; one that keeps them in a
 * table uses it as a primary key. The levels above a project exist so this tool
 * can be handed to the people whose landscape it describes without their
 * projects and ours sharing a namespace.
 *
 * **Why everything returns a promise, even though `localStorage` is synchronous.**
 * Every backend that comes after this one — the File System Access API, Electron
 * over IPC, a server — is asynchronous. Were this contract synchronous today,
 * the first such adapter would break every caller and the seam would have bought
 * nothing.
 *
 * **Why `list()` returns summaries and not projects.** The picker needs names
 * and dates, not models. A store that can answer cheaply (a directory listing, a
 * `SELECT name, updated_at`) should be allowed to; one that cannot may load and
 * summarise. Returning whole projects would force every store into the
 * expensive shape.
 */
import type { ProjectSnapshot, ProjectSummary } from '../projects/project'
import type { ScopePath } from '../projects/scopePath'

export interface ProjectStore {
  /**
   * Where this one keeps things, in plain words ('browser storage', 'disk').
   *
   * For messages and for the trail: "saving failed" is too thin when there are
   * three places it could have gone wrong.
   */
  readonly id: string

  /** Everything this store holds, for the picker. Empty is a normal answer. */
  list(): Promise<ProjectSummary[]>

  /**
   * One project, or `undefined` when it is not there.
   *
   * Deliberately `undefined` and not an error: a path remembered from last time
   * can name a project since deleted, and the caller does the same thing
   * with that as with a first visit. A genuine failure — the disk is gone,
   * permission is missing — may reject.
   */
  load(path: ScopePath): Promise<ProjectSnapshot | undefined>

  /**
   * Write a project out, under its own ref.
   *
   * The path comes from the project rather than a separate argument so the two
   * can never disagree — saving a project under somebody else's key is not a
   * thing a caller should be able to express by accident.
   */
  save(project: ProjectSnapshot): Promise<void>

  /** Remove one project. Removing what is not there is not an error. */
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
   * The projects this store holds in a form an older version of this tool
   * wrote, if it can tell.
   *
   * The storage format is the store's business and nobody else's, so this is
   * the one question the migration cannot answer for itself (ADR-0012 §11 and
   * `projects/migrate3to4.ts`). It is asked on every open and is almost always
   * empty, so it is written to be cheap: one header per project, no content.
   *
   * Optional because a store need not have a past. An in-memory one has none,
   * and a backend written after the format turned has none either; absent means
   * "nothing of mine is old", which is the honest answer in both cases.
   */
  outdated?(): Promise<ScopePath[]>
}

/** How much of what a store will hold is already held. Characters, not bytes. */
export type StoragePressure = {
  used: number
  budget: number
}
