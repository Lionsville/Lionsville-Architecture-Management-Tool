/**
 * The history seam, over the machine's own git.
 *
 * Thin on purpose. Everything difficult is on the other side of the channel —
 * running git without a shell, without hooks, without a prompt that can hang —
 * and everything meaningful is above: what a change IS lives in
 * `model/diff.ts`, and what a snapshot is called in `projects/commitMessage.ts`.
 * This binds the folder, turns a ref into the path the project sits at, and
 * turns the files at a commit back into a project.
 */
import { openProjectFolder } from '../../projects/migrate3to4'
import type { ProjectSnapshot } from '../../projects/project'
import { refPath } from '../../projects/projectRef'
import type { ProjectRef } from '../../projects/projectRef'
import type { HistoryEntry, HistoryScope, ProjectHistory, ProjectSync } from '../../ports/ProjectHistory'
import type { LabelOutcome } from '../../platform/history'
import type { SyncSide } from '../../platform/sync'
import type { DesktopHistory } from './channel'

export class DesktopProjectHistory implements ProjectHistory {
  /** The remote, bound to the same folder. Always present on the desktop. */
  readonly sync: ProjectSync

  constructor(
    private readonly git: DesktopHistory,
    private readonly root: string,
  ) {
    this.sync = {
      remote: () => git.remote(root),
      pull: () => git.pull(root),
      push: () => git.push(root),
      resolve: (side: SyncSide) => git.resolve(root, side),
    }
  }

  available(): Promise<boolean> {
    return this.git.available()
  }

  keeping(): Promise<boolean> {
    return this.git.isRepository(this.root)
  }

  start(): Promise<void> {
    return this.git.init(this.root)
  }

  async snapshot(message: string): Promise<boolean> {
    return Boolean(await this.git.snapshot(this.root, message))
  }

  entries(limit?: number, of?: HistoryScope): Promise<HistoryEntry[]> {
    // The scope's paths are relative to the project; git wants them relative
    // to the root, which is the one thing this adapter knows and the seam does not.
    const paths = of ? of.paths.map((path) => `${refPath(of.ref)}/${path}`) : undefined
    return this.git.history(this.root, limit, paths).then((commits) => commits.map((held) => ({
      id: held.sha,
      subject: held.subject,
      at: held.at,
      author: held.author,
      labels: held.labels,
    })))
  }

  label(entry: string, name: string): Promise<LabelOutcome> {
    return this.git.label(this.root, entry, name)
  }

  async projectAt(ref: ProjectRef, entry: string): Promise<ProjectSnapshot | undefined> {
    const files = await this.git.filesAt(this.root, entry, refPath(ref))
    if (files.length === 0) return undefined
    // The marks are not read back (a bitmap is not text and a diff of the
    // architecture does not want one), so the project that comes out has the
    // folder's shape and no logo library. Comparing models is what it is for.
    return openProjectFolder(files, ref)
  }
}
