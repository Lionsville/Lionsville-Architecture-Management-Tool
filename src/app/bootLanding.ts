// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where the first paint lands, and what it has open over it: read off what the
 * boot was given before anything renders. Pure, so each case is a test without
 * a shell.
 */
import { isOpenableScope, onView } from '../projects/scope'
import type { ScopeSnapshot } from '../projects/scope'
import { ROOT_SCOPE } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import type { SourceLanding } from '../platform/sourceProvider'

/** Where the first paint is: a scope open on a view, or a scope's home. */
export type BootLanding = {
  initialProject?: ScopeSnapshot
  initialHome?: ScopePath
}

/**
 * The scope the boot read, turned into where the app starts.
 *
 * **An address that named a scope and no view lands on that scope's home**,
 * the way opening a scope from a home does: its pages, its boards and what is
 * filed under it, and never whichever board it happened to have open last —
 * which a person who was sent a link to a scope reads as a board picked at
 * random. An address that named a view opens the scope on it, as it always
 * did. A scope that is not there, or that the person may not read, is the
 * organisation's home — for a home, once the listing has been read.
 *
 * With no address, the scope this machine last had open reopens as it was:
 * a window taking up where it was left is what a desktop does, and a source
 * that wants every fresh start to begin at the organisation says so with a
 * landing of its own (`Shell.opensAt`).
 */
export function landingOf(held: ScopeSnapshot | undefined, opensAt: SourceLanding | undefined): BootLanding {
  if (opensAt === undefined) return isOpenableScope(held) ? { initialProject: held } : {}
  if (opensAt.view === undefined) return opensAt.scope === ROOT_SCOPE ? {} : { initialHome: opensAt.scope }
  if (held === undefined) return {}
  // A scope that draws nothing has no board to open: its home.
  const { path } = held
  return isOpenableScope(held) ? { initialProject: onView(held, opensAt.view) } : { initialHome: path }
}

/**
 * Which scope the boot must read before the first paint: none for a home,
 * because a home reads its own document once it is up and the first paint
 * need not wait a round trip for it. A home that turns out not to be there
 * falls back to the organisation's once the listing is read (`useHomeParts`).
 */
export function scopeToRead(opensAt: SourceLanding | undefined, last: ScopePath | undefined): ScopePath | undefined {
  if (opensAt === undefined) return last
  return opensAt.view === undefined ? undefined : opensAt.scope
}

/**
 * The shell's own dialogs an address may ask to have open at the first paint.
 *
 * One today: a page elsewhere that says *open the preferences* links to the
 * app with `?open=preferences`, rather than to a copy of the preferences of
 * its own. A closed list, because an address is anybody's to write and a
 * parameter that could open whatever it named is a way to put an arbitrary
 * dialog in front of somebody.
 */
export const BOOT_DIALOGS = ['preferences'] as const
export type BootDialog = typeof BOOT_DIALOGS[number]

/** The parameter it is asked with. */
export const OPEN_PARAMETER = 'open'

/** Which dialog the address asks for, or nothing for anything this list does not hold. */
export function dialogAsked(search: string): BootDialog | undefined {
  const asked = new URLSearchParams(search).get(OPEN_PARAMETER)
  return BOOT_DIALOGS.find((one) => one === asked)
}

/**
 * The address with the ask taken out, for the history entry the page is on:
 * a dialog opened once is not a dialog every reload should open again.
 * `undefined` where there was nothing to take out.
 */
export function withoutDialog(href: string): string | undefined {
  const url = new URL(href)
  if (!url.searchParams.has(OPEN_PARAMETER)) return undefined
  url.searchParams.delete(OPEN_PARAMETER)
  return `${url.pathname}${url.search}${url.hash}`
}
