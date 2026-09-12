/**
 * What a group knows about itself.
 *
 * A group has always been *derived*: it exists because projects are filed under
 * it, and `groupsOf` reads it back off the list. That is still true, and this
 * file does not change it — there is still nowhere to keep an empty group, and
 * creating one is still creating its first project.
 *
 * What a derived group could not carry is anything a person wanted to say about
 * it. Its display name was the one exception, and only because it rides along on
 * every project (`model.customerName`) — which is also why a rename has to
 * rewrite every project in the group rather than one record. A description and a
 * set of links have nowhere to ride, so they get a record of their own,
 * addressed by the group's path.
 *
 * The record decorates; it never conjures. A profile for a group with no
 * projects left is not a group, and the picker will not show one.
 */

import { isAdrList } from '../decisions/adr'
import type { Adr } from '../decisions/adr'
import { isLinkList, isSafeLinkUrl, normaliseLinks } from './links'
import type { RecordLink } from './links'
import { isSafeScopePath, ROOT_SCOPE } from './scopePath'

/**
 * One link on a group. The shared shape under its old name: callers and saved
 * files both say `GroupLink`, and there is nothing group-specific about it.
 */
export type GroupLink = RecordLink

export type GroupProfile = {
  /** The group's path — the address, `acme` or `acme/rail`. Never renamed. */
  group: string
  /**
   * What it is called on screen.
   *
   * Also kept on every project in the group as `model.customerName`, which is
   * what the editor reads. The two are written together; this one is the copy
   * that survives when the last project moves out and comes back.
   */
  name: string
  /**
   * Who an exported diagram is drawn for, when that is not the group's name.
   *
   * A group is filed under whatever this environment calls it — `Rail`, a
   * department, a programme — and the title block on a drawing wants the
   * organisation's own name, which is often longer and sometimes different.
   * Absent = the group's name, which is what the block always said.
   */
  client?: string
  description?: string
  links?: GroupLink[]
  /**
   * The group's own architecture decisions — the ones that hold across every
   * project filed here. A project's decisions live on its model; these have no
   * project to ride on, which is the reason this record exists at all.
   */
  decisions?: Adr[]
}

/**
 * Is this a group path a store may be asked for?
 *
 * A scope path, and never the root: a group has always been a namespace with
 * something filed under it, and the root is the folder itself. Same rule and
 * same reason as every other address — a segment that is not a slug could
 * escape its own folder in a store that keeps things on disk.
 */
export function isGroupPath(value: unknown): value is string {
  return isSafeScopePath(value) && value !== ROOT_SCOPE
}

/**
 * Whether a link is one this app will render as an anchor.
 *
 * `http` and `https` only. This is not paranoia about a hostile user attacking
 * themselves: a working file travels — that is what it is for — and a `javascript:`
 * or `data:` URL in a field somebody else typed becomes script running in this
 * app the moment the link is clicked. A protocol allowlist is the whole defence,
 * and it costs nothing anyone would miss.
 */
export const isSafeGroupLinkUrl = isSafeLinkUrl

/**
 * A profile on its way into storage: trimmed, with the empty fields left out
 * and the links that cannot be rendered dropped.
 *
 * A link with no label keeps its URL as its label, because a row of blank chips
 * helps nobody and the URL is at least true.
 */
export function normaliseGroupProfile(profile: GroupProfile): GroupProfile {
  const links = normaliseLinks(profile.links)
  const out: GroupProfile = { group: profile.group, name: profile.name.trim() }
  const client = profile.client?.trim()
  if (client) out.client = client
  const description = profile.description?.trim()
  if (description) out.description = description
  if (links.length > 0) out.links = links
  if (profile.decisions && profile.decisions.length > 0) out.decisions = profile.decisions
  return out
}

/** Whether something read back out of storage is a profile. */
export function isGroupProfile(value: unknown): value is GroupProfile {
  if (!value || typeof value !== 'object') return false
  const held = value as GroupProfile
  if (typeof held.group !== 'string' || !held.group) return false
  if (typeof held.name !== 'string') return false
  if (held.client !== undefined && typeof held.client !== 'string') return false
  if (held.description !== undefined && typeof held.description !== 'string') return false
  if (held.decisions !== undefined && !isAdrList(held.decisions)) return false
  if (held.links === undefined) return true
  return isLinkList(held.links)
}

/**
 * The profile for a group, or the plain one derivable without a record.
 *
 * Every caller wants "the group as it should be shown", and half of all groups
 * have no record — so the fallback belongs here rather than in each caller.
 */
export function groupProfileFor(
  group: string,
  derivedName: string,
  profiles: readonly GroupProfile[],
): GroupProfile {
  const held = profiles.find((profile) => profile.group === group)
  if (!held) return { group, name: derivedName }
  // A record with a blank name is not a reason to show a blank heading.
  return { ...held, name: held.name.trim() || derivedName }
}
