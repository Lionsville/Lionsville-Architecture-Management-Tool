/**
 * Group records in the browser's storage, one key each.
 *
 * Same shape and the same reasoning as `WebStorageProjectStore`: one key per
 * record so a quota failure on one cannot take the others with it, the group
 * path as the key so `list()` is a prefix scan, and a record that will not parse
 * is skipped rather than raised — a description nobody can read is not a reason
 * to hide the group it belongs to.
 *
 * The prefix is a sibling of the projects', not a child: `lvarch.group.acme`
 * beside `lvarch.project.acme/landscape`. A group's record and its projects are
 * separate records with separate lifetimes.
 */
import { ShellError } from '../../platform/errors'
import { isGroupProfile } from '../../projects/group'
import type { GroupProfile } from '../../projects/group'
import { isGroupPath } from '../../projects/projectRef'
import type { GroupStore } from '../../ports/GroupStore'
import type { KeyValueStorage } from './KeyValueStorage'

export const GROUP_PREFIX = 'lvarch.group.'

export class WebStorageGroupStore implements GroupStore {
  readonly id = 'browser-storage'

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly prefix: string = GROUP_PREFIX,
  ) {}

  private keyFor(group: string): string {
    return `${this.prefix}${group}`
  }

  private read(key: string): GroupProfile | undefined {
    let parsed: unknown
    try {
      const raw = this.storage.getItem(key)
      if (!raw) return undefined
      parsed = JSON.parse(raw)
    } catch {
      return undefined
    }
    if (!isGroupProfile(parsed)) return undefined
    // A record whose path is not addressable cannot be matched to a group, so it
    // is not a profile as far as this store is concerned.
    return isGroupPath(parsed.group) ? parsed : undefined
  }

  list(): Promise<GroupProfile[]> {
    let keys: string[]
    try {
      keys = this.storage.keys()
    } catch {
      return Promise.resolve([])
    }
    const found = keys
      .filter((key) => key.startsWith(this.prefix))
      .map((key) => this.read(key))
      .filter((profile): profile is GroupProfile => profile !== undefined)
    return Promise.resolve(found.sort((a, b) => a.group.localeCompare(b.group)))
  }

  save(profile: GroupProfile): Promise<void> {
    if (!isGroupPath(profile.group)) {
      return Promise.reject(new ShellError('shell.badGroupPath', { path: JSON.stringify(profile.group) }))
    }
    try {
      this.storage.setItem(this.keyFor(profile.group), JSON.stringify(profile))
      return Promise.resolve()
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error(String(err)))
    }
  }

  remove(group: string): Promise<void> {
    try {
      if (isGroupPath(group)) this.storage.removeItem(this.keyFor(group))
    } catch {
      // Failing to throw something away is not a fault anybody can act on.
    }
    return Promise.resolve()
  }
}
