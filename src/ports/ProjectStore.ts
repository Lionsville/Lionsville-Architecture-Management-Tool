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
 * {@link ProjectRef} — a group path and a key inside it. A store that keeps
 * projects in folders can use `refPath()` as the path directly; one that keeps
 * them in a table can use it as a primary key. The group level exists so this
 * tool can be handed to the people whose landscape it describes without their
 * projects and ours sharing a namespace, and so groups can nest later without
 * the key format changing.
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
import type { ProjectRef } from '../projects/projectRef'

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
   * Deliberately `undefined` and not an error: a ref remembered from last time
   * can point at a project since deleted, and the caller does the same thing
   * with that as with a first visit. A genuine failure — the disk is gone,
   * permission is missing — may reject.
   */
  load(ref: ProjectRef): Promise<ProjectSnapshot | undefined>

  /**
   * Write a project out, under its own ref.
   *
   * The ref comes from the project rather than a separate argument so the two
   * can never disagree — saving a project under somebody else's key is not a
   * thing a caller should be able to express by accident.
   */
  save(project: ProjectSnapshot): Promise<void>

  /** Remove one project. Removing what is not there is not an error. */
  remove(ref: ProjectRef): Promise<void>
}
