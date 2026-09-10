/**
 * A link on a record, and the one rule about what may become an anchor.
 *
 * Its own file rather than a corner of `group.ts` because two records now carry
 * links — a group's and the organisation's (ADR-0012) — and a second allowlist
 * would be one allowlist and one oversight. Small on purpose: `organisation.ts`
 * is read by the desktop main process, and reaching this through `group.ts`
 * would drag the decision record, and with it i18n, into a compile that has no
 * DOM in it.
 */

/** One link on a record: a ticket queue, a wiki space, a dashboard. */
export type RecordLink = {
  label: string
  url: string
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
export function isSafeLinkUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return false
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:'
}

/**
 * The links of a record on their way into storage: trimmed, with the ones that
 * cannot be rendered dropped.
 *
 * A link with no label keeps its URL as its label, because a row of blank chips
 * helps nobody and the URL is at least true.
 */
export function normaliseLinks(links: readonly RecordLink[] | undefined): RecordLink[] {
  return (links ?? [])
    .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
    .filter((link) => isSafeLinkUrl(link.url))
    .map((link) => ({ label: link.label || link.url, url: link.url }))
}

/** Whether something read back out of storage is a list of links. */
export function isLinkList(value: unknown): value is RecordLink[] {
  return Array.isArray(value) && value.every((link) => link
    && typeof (link as RecordLink).label === 'string'
    && typeof (link as RecordLink).url === 'string')
}
