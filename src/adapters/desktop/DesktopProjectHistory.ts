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
import { projectFromFolder } from '../../projects/folderFormat'
import type { ProjectSnapshot } from '../../projects/project'
import { refPath } from '../../projects/projectRef'
import type { ProjectRef } from '../../projects/projectRef'
import type { HistoryEntry, ProjectHistory } from '../../ports/ProjectHistory'
import type { DesktopHistory } from './channel'

export class DesktopProjectHistory implements ProjectHistory {
  constructor(
    private readonly git: DesktopHistory,
    private readonly root: string,
  ) {}

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

  entries(limit?: number): Promise<HistoryEntry[]> {
    return this.git.history(this.root, limit).then((commits) => commits.map((held) => ({
      id: held.sha,
      subject: held.subject,
      at: held.at,
      author: held.author,
    })))
  }

  async projectAt(ref: ProjectRef, entry: string): Promise<ProjectSnapshot | undefined> {
    const files = await this.git.filesAt(this.root, entry, refPath(ref))
    if (files.length === 0) return undefined
    // The marks are not read back (a bitmap is not text and a diff of the
    // architecture does not want one), so the project that comes out has the
    // folder's shape and no logo library. Comparing models is what it is for.
    return projectFromFolder(files, ref)
  }
}
