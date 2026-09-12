/**
 * Projects in memory. For tests, and for a session that deliberately leaves
 * nothing behind.
 *
 * It copies on the way in and on the way out, and that is the whole reason it
 * exists. A fake store that holds on to the reference lets every
 * accidentally-shared-object bug through: the test passes because caller and
 * store are looking at the same object, and then it falls over in the real
 * adapter, which goes through JSON. Copying makes it exactly as strict.
 */
import { ShellError } from '../../platform/errors'
import { isUsableProject, sortProjects, summarise } from '../../projects/project'
import type { ProjectSnapshot, ProjectSummary } from '../../projects/project'
import { isSafeScopePath } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import type { ProjectStore } from '../../ports/ProjectStore'

export class InMemoryProjectStore implements ProjectStore {
  readonly id = 'memory'
  private held = new Map<string, ProjectSnapshot>()

  constructor(initial: readonly ProjectSnapshot[] = []) {
    for (const project of initial) this.held.set(project.path, structuredClone(project))
  }

  list(): Promise<ProjectSummary[]> {
    const found = [...this.held.values()].filter(isUsableProject).map(summarise)
    // Alphabetical: see the note in WebStorageProjectStore.
    return Promise.resolve(sortProjects(found))
  }

  load(path: ScopePath): Promise<ProjectSnapshot | undefined> {
    if (!isSafeScopePath(path)) return Promise.resolve(undefined)
    const project = this.held.get(path)
    if (!isUsableProject(project)) return Promise.resolve(undefined)
    return Promise.resolve(structuredClone(project))
  }

  save(project: ProjectSnapshot): Promise<void> {
    if (!isSafeScopePath(project.path)) {
      return Promise.reject(new ShellError('shell.badScopePath', { path: String(project.path) }))
    }
    this.held.set(project.path, {
      ...structuredClone(project),
      updatedAt: new Date().toISOString(),
    })
    return Promise.resolve()
  }

  remove(path: ScopePath): Promise<void> {
    if (isSafeScopePath(path)) this.held.delete(path)
    return Promise.resolve()
  }
}
