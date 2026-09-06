/**
 * Group records in memory. For tests, and for a session that deliberately
 * leaves nothing behind.
 *
 * Copies on the way in and out, for the same reason `InMemoryProjectStore`
 * does: a fake that hands back the reference it was given lets every
 * shared-object bug through, and then it falls over in a real adapter that goes
 * via JSON.
 */
import { ShellError } from '../../core/errors'
import { isGroupProfile } from '../../core/group'
import type { GroupProfile } from '../../core/group'
import { isGroupPath } from '../../core/projectRef'
import type { GroupStore } from '../../ports/GroupStore'

export class InMemoryGroupStore implements GroupStore {
  readonly id = 'memory'
  private held = new Map<string, GroupProfile>()

  constructor(initial: readonly GroupProfile[] = []) {
    for (const profile of initial) {
      if (isGroupPath(profile.group)) this.held.set(profile.group, structuredClone(profile))
    }
  }

  list(): Promise<GroupProfile[]> {
    const found = [...this.held.values()]
      .filter(isGroupProfile)
      .map((profile) => structuredClone(profile))
    return Promise.resolve(found.sort((a, b) => a.group.localeCompare(b.group)))
  }

  save(profile: GroupProfile): Promise<void> {
    if (!isGroupPath(profile.group)) {
      return Promise.reject(new ShellError('shell.badGroupPath', { path: JSON.stringify(profile.group) }))
    }
    this.held.set(profile.group, structuredClone(profile))
    return Promise.resolve()
  }

  remove(group: string): Promise<void> {
    this.held.delete(group)
    return Promise.resolve()
  }
}
