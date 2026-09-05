/**
 * Where a project lives: a group, and a key inside it.
 *
 * The shell used to have one project and a hardcoded customer name. Neither
 * survives contact with a second environment — this tool is shared with the
 * people whose landscape it describes, and "the customer" is only one of the
 * things a group can be. A group is whatever the namespace is called here: a
 * customer, a department, a programme, a team.
 *
 * **`group` is a path, not a name.** One segment today (`acme-logistics`),
 * more when groups nest (`acme-logistics/rail`). Writing it as a path
 * from the start costs nothing and means nesting later is a change to
 * {@link groupSegments} and a picker, not to the storage key format, the store
 * interface, or every ref ever written down.
 *
 * Segments are slugs, so a ref survives a URL, a file path and a storage key
 * without escaping. The display names live on the model (`model.customerName` is
 * the group's label, `model.name` the design's) — this file is addressing only.
 */
import { KEY_RE, slug } from './model/keys'

export type ProjectRef = {
  /** The group path: slug segments separated by `/`. */
  group: string
  /** The project's own key inside that group. */
  project: string
}

/** The group path split into its segments. One today; more when groups nest. */
export function groupSegments(group: string): string[] {
  return group.split('/').filter((segment) => segment.length > 0)
}

/**
 * A ref as one string — for a storage key, a log line, a URL.
 *
 * Deliberately the same shape as the group path itself, so a store that keeps
 * projects in folders can use it as a path without translating anything.
 */
export function refPath(ref: ProjectRef): string {
  return `${ref.group}/${ref.project}`
}

export function sameRef(a: ProjectRef, b: ProjectRef): boolean {
  return a.group === b.group && a.project === b.project
}

/**
 * Is this something a store may be asked for?
 *
 * Checked rather than trusted because a ref reaches the store from stored
 * preferences and, later, from a URL or an IPC message. A key that is not a slug
 * could escape its own folder once a store keeps projects on disk; refusing
 * early is cheaper than sanitising in every adapter.
 */
export function isProjectRef(value: unknown): value is ProjectRef {
  if (!value || typeof value !== 'object') return false
  const ref = value as ProjectRef
  if (typeof ref.group !== 'string' || typeof ref.project !== 'string') return false
  const segments = groupSegments(ref.group)
  if (segments.length === 0) return false
  return segments.every((segment) => KEY_RE.test(segment)) && KEY_RE.test(ref.project)
}

/**
 * Is this a group path a store may be asked for?
 *
 * The group half of {@link isProjectRef}, on its own, because a group is now
 * addressable in its own right — a profile is filed under one. Same rule and
 * same reason: a segment that is not a slug could escape its own folder in a
 * store that keeps things on disk.
 */
export function isGroupPath(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const segments = groupSegments(value)
  return segments.length > 0 && segments.every((segment) => KEY_RE.test(segment))
}

/**
 * A ref from what somebody typed.
 *
 * The names stay on the model; this only makes them addressable. `taken` keeps a
 * second project with the same name in the same group from landing on top of the
 * first — same rule, and the same helper, as element keys.
 */
export function refFor(
  groupName: string,
  projectName: string,
  taken: Iterable<string> = [],
): ProjectRef {
  const group = groupSegments(groupName).map(slug).join('/') || slug(groupName)
  const claimed = new Set(taken)
  let project = slug(projectName)
  if (claimed.has(project)) {
    let n = 2
    while (claimed.has(`${project}-${n}`)) n += 1
    project = `${project}-${n}`
  }
  return { group, project }
}
