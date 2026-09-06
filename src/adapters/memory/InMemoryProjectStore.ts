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
import { isProjectRef, refPath } from '../../projects/projectRef'
import type { ProjectRef } from '../../projects/projectRef'
import type { ProjectStore } from '../../ports/ProjectStore'

export class InMemoryProjectStore implements ProjectStore {
  readonly id = 'memory'
  private held = new Map<string, ProjectSnapshot>()

  constructor(initial: readonly ProjectSnapshot[] = []) {
    for (const project of initial) this.held.set(refPath(project.ref), structuredClone(project))
  }

  list(): Promise<ProjectSummary[]> {
    const found = [...this.held.values()].filter(isUsableProject).map(summarise)
    // Alphabetical: see the note in WebStorageProjectStore.
    return Promise.resolve(sortProjects(found))
  }

  load(ref: ProjectRef): Promise<ProjectSnapshot | undefined> {
    if (!isProjectRef(ref)) return Promise.resolve(undefined)
    const project = this.held.get(refPath(ref))
    if (!isUsableProject(project)) return Promise.resolve(undefined)
    return Promise.resolve(structuredClone(project))
  }

  save(project: ProjectSnapshot): Promise<void> {
    if (!isProjectRef(project.ref)) {
      return Promise.reject(new ShellError('shell.badProjectRef', { path: JSON.stringify(project.ref) }))
    }
    this.held.set(refPath(project.ref), {
      ...structuredClone(project),
      updatedAt: new Date().toISOString(),
    })
    return Promise.resolve()
  }

  remove(ref: ProjectRef): Promise<void> {
    if (isProjectRef(ref)) this.held.delete(refPath(ref))
    return Promise.resolve()
  }
}
