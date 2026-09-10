/**
 * What the organisation knows about itself (ADR-0012).
 *
 * The working directory is one organisation. Above the domains filed under it
 * and above every project inside those, there is one record saying what this
 * whole tree is: its name, the name a drawing is made out to when that differs,
 * and the links a person opening it for the first time would want.
 *
 * It exists because three things were being kept one level too low. The name
 * rode on every project as `model.customerName`, so renaming it rewrote every
 * project rather than one file. The decisions that hold across every domain had
 * to be filed as some domain's. And `folder.json` — the shared settings file
 * ADR-0005 placed at the root, tolerated everywhere and deliberately left
 * keyless — had no first key. This is that key.
 *
 * Unlike a group, an organisation is **not derived**. A group exists because
 * projects are filed under it and there is nowhere to keep an empty one; an
 * organisation is the folder you opened, so it exists whether or not it holds
 * anything, and a record for it is a record for something already there. What
 * it shares with a group is the shape — a name, a client, a description, links
 * — and it deliberately shares the link rules too (`links.ts`), because a link
 * is a link and two allowlists would be one allowlist and one oversight.
 *
 * Pure. `folderSettings.ts` puts this into and out of `folder.json`; nothing
 * here touches a disk.
 */
import { isLinkList, normaliseLinks } from './links'
import type { RecordLink } from './links'

export type Organisation = {
  /**
   * What this organisation is called. The label the shell shows wherever
   * `model.customerName` used to be read, and the one a project's stale copy of
   * that field is corrected to.
   */
  name: string
  /**
   * Who an exported diagram is made out to, when that is not the organisation's
   * own name — a legal entity, a full name where the short one is used on
   * screen. Absent = the name, which is what a title block always said.
   *
   * The same field a group carries, at the level above it: a group's answer
   * wins for that group's projects, and this one answers for the rest.
   */
  client?: string
  description?: string
  links?: RecordLink[]
}

/**
 * A record on its way into `folder.json`: trimmed, with the empty fields left
 * out and the links that cannot be rendered dropped.
 *
 * The rules are `normaliseGroupProfile`'s, for the reason the header gives. A
 * link with no label keeps its URL as its label, because a row of blank chips
 * helps nobody and the URL is at least true.
 */
export function normaliseOrganisation(organisation: Organisation): Organisation {
  const links = normaliseLinks(organisation.links)
  const out: Organisation = { name: organisation.name.trim() }
  const client = organisation.client?.trim()
  if (client) out.client = client
  const description = organisation.description?.trim()
  if (description) out.description = description
  if (links.length > 0) out.links = links
  return out
}

/**
 * Whether something read back out of `folder.json` is an organisation record.
 *
 * A blank name passes: a person who cleared the field has a record with no name
 * in it, which {@link organisationName} answers for. What does not pass is a
 * name that is not a string, because that is a file somebody else's build wrote
 * differently and guessing at it would write the guess back.
 */
export function isOrganisation(value: unknown): value is Organisation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const held = value as Organisation
  if (typeof held.name !== 'string') return false
  if (held.client !== undefined && typeof held.client !== 'string') return false
  if (held.description !== undefined && typeof held.description !== 'string') return false
  if (held.links === undefined) return true
  return isLinkList(held.links)
}

/**
 * What to call this organisation on screen.
 *
 * Every caller wants "the organisation as it should be shown", and a folder
 * opened for the first time has no record at all — so the fallback belongs here
 * rather than in each caller. The fallback is the folder's own name, which is
 * what a person called it when they made it and is very often right.
 */
export function organisationName(
  organisation: Organisation | undefined, fallback: string,
): string {
  return organisation?.name.trim() || fallback
}

/**
 * Who a diagram drawn anywhere in this organisation is made out to, absent a
 * closer answer.
 *
 * The group's `client` still wins for that group's projects — the closest
 * record to the drawing is the one that knows — and this answers when there is
 * none. Falls all the way back to the label, so a title block is never blank.
 */
export function organisationClient(
  organisation: Organisation | undefined, fallback: string,
): string {
  return organisation?.client?.trim() || organisationName(organisation, fallback)
}
