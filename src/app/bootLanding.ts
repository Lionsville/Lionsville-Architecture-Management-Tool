// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where the first paint lands, and what it has open over it: read off what the
 * boot was given before anything renders. Pure, so each case is a test without
 * a shell.
 */
import { nearestPlace } from '../agent/place'
import type { Place } from '../agent/place'
import { HOME_PAGES, VIEW_PAGES, viewFor } from '../agent/screen'
import type { Destination } from '../agent/screen'
import { isOpenableScope, onView } from '../projects/scope'
import type { ScopeSnapshot } from '../projects/scope'
import { readScopes } from '../projects/scopeAccess'
import type { ScopeReader } from '../projects/scopeAccess'
import { ancestorScopes, ROOT_SCOPE } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import type { SourceLanding } from '../platform/sourceProvider'
import type { InitialPage } from './App'
import { factsOf } from './placeLanding'
import type { HeldScope } from './placeLanding'

/** Where the first paint is: a scope open on a view or a page, or a scope's home and its page. */
export type BootLanding = {
  initialProject?: ScopeSnapshot
  initialHome?: ScopePath
  /** The page over the scope that is open, where a place in the address named one (ADR-0033). */
  initialPage?: InitialPage
  /** The organisation screen's page over the home, likewise. */
  initialHomePage?: 'register' | 'technologyRegister'
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

/** How long the first paint waits on the read of the scope it reopens. */
export const BOOT_READ_MS = 4000

/**
 * The scope the boot reopens, read in time for the first paint — or where
 * that read keeps it waiting past {@link BOOT_READ_MS}, the scope's home,
 * which reads its own document once it is up and so picks the scope up
 * whenever where it is kept answers. A page left blank on a store that never
 * answers is one nobody can do anything with. A read that fails in time
 * fails the boot, as it always did.
 */
export async function reopened(
  reading: Promise<ScopeSnapshot | undefined>, path: ScopePath, opensAt: SourceLanding | undefined, ms = BOOT_READ_MS,
): Promise<BootLanding> {
  const read = await inTime(reading, ms)
  return read === 'late' ? homeOf(path) : landingOf(read.held, opensAt)
}

/** A read, or `late` where it keeps the first paint waiting past `ms`. */
async function inTime<T>(reading: Promise<T>, ms: number): Promise<{ held: T } | 'late'> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<'late'>((resolve) => { timer = setTimeout(() => resolve('late'), ms) })
  const read = await Promise.race([reading.then((held) => ({ held })), late]).finally(() => clearTimeout(timer))
  // Answered after all, or never: nothing waits on it now.
  if (read === 'late') reading.catch(() => undefined)
  return read
}

/** A scope's home as the first paint: the organisation's is the one with nothing said. */
function homeOf(path: ScopePath): BootLanding {
  return path === ROOT_SCOPE ? {} : { initialHome: path }
}

/**
 * What decides the first paint, in the order the boot asks: a place in the
 * fragment (ADR-0033), then a source's own landing (`Shell.opensAt`), then the
 * scope this machine last had open. A place wins over the other two because
 * it is where the person was a moment ago — the history writes it on every
 * move and leaves the query, which a source may land the app from, alone, so
 * after a move and a reload the address carries both and the query is only
 * the link the person arrived by.
 */
export function bootDecidedBy(
  place: Place | undefined, opensAt: SourceLanding | undefined, last: ScopePath | undefined,
): { place: Place } | { read: ScopePath | undefined } {
  if (place !== undefined) return { place }
  return { read: scopeToRead(opensAt, last) }
}

/**
 * Which scope a place in the address needs read before the first paint
 * (ADR-0033): none for a home, which reads its own document once it is up,
 * as an address that names a scope without a view does.
 */
export function placeToRead(place: Place): ScopePath | undefined {
  return place.page !== undefined && HOME_PAGES.includes(place.page) ? undefined : place.scope
}

/**
 * Where a place in the address lands (ADR-0033) — the one a reload in a
 * browser finds there, or a link somebody copied out of the bar.
 *
 * **It wins over everything else the boot could land on**: a source's own
 * landing, read out of the query by its provider, and the scope this machine
 * last had open. The query is the link the person arrived by and the
 * preference is where they worked last time; the fragment is where they were
 * a moment ago, because the history writes it on every move and leaves the
 * query alone.
 *
 * A home lands on that home and the page on it. Anything else lands where the
 * place lands now (`nearestPlace`): on the view or the page it names, its
 * scope's first view for a view that was removed, the page without its record
 * for a record that was. A scope that is not there, or that this person may
 * not read, is the organisation's home — where an address that names one
 * lands now, and where a refused open leaves a person who had nothing open.
 */
export function placeLanding(held: PlaceScope | undefined, place: Place): BootLanding {
  const { scope, page } = place
  if (page !== undefined && HOME_PAGES.includes(page)) {
    return { ...homeOf(scope), ...(page === 'home' ? {} : { initialHomePage: page as 'register' | 'technologyRegister' }) }
  }
  if (held === undefined) return {}
  const near = nearestPlace(place, { scopeIs: () => true, ...factsOf(held) })
  const snapshot = held.snapshot
  if (near.page === 'home') return homeOf(scope)
  if (near.page === undefined || VIEW_PAGES.includes(near.page)) {
    // A scope that draws nothing has no view to open on: its home.
    if (!isOpenableScope(snapshot)) return homeOf(scope)
    if (near.page === undefined) return { initialProject: snapshot }
    // A view's page with no id is the one of its kind there is, and the home
    // where there is none: an open never makes a view (ADR-0019, amended).
    const view = viewFor(near.page, near.id, snapshot.model.diagrams, snapshot.activeDiagramId)
    return view === undefined ? homeOf(scope) : { initialProject: onView(snapshot, view) }
  }
  const opened = initialPageFor(near)
  return { initialProject: snapshot, ...(opened ? { initialPage: opened } : {}) }
}

/** A scope as a place in it is landed by: its snapshot, and the records it reads from above. */
export type PlaceScope = HeldScope & { snapshot: ScopeSnapshot }

/**
 * The scope a place names, with its ancestors' decisions — a place on the
 * decisions page may name a record from above, which is shown there too —
 * in one read of the tree. `undefined` where no scope is there.
 */
export async function readPlaceScope(scopes: ScopeReader, path: ScopePath): Promise<PlaceScope | undefined> {
  const [held, ...above] = await readScopes(scopes, [path, ...ancestorScopes(path)])
  if (!held) return undefined
  return { snapshot: held, model: held.model, ancestorDecisions: above.flatMap((one) => one?.model.decisions ?? []) }
}

/**
 * The scope a place names, read in time for the first paint, as
 * {@link reopened} reads the last one: where the read keeps it waiting, the
 * scope's home. A read that fails is a place this person may not be shown,
 * and is the caller's to say on the trail; here it is the organisation's home.
 */
export async function landedAt(
  reading: Promise<PlaceScope | undefined>, place: Place, ms = BOOT_READ_MS,
): Promise<BootLanding> {
  const read = await inTime(reading, ms)
  return read === 'late' ? homeOf(place.scope) : placeLanding(read.held, place)
}

/**
 * The page a scope opens on for a destination — an agent's (ADR-0019), a
 * provider's, a search hit's, a place in the history (ADR-0033): the same
 * words, so the vocabularies cannot drift. A home page is the shell's own
 * business and never reaches here; a view's page with no id is resolved
 * against the scope once it is read (`pageLanding`), and never makes a view.
 */
export function initialPageFor(to: Destination): InitialPage | undefined {
  const id = to.id !== undefined ? { id: to.id } : {}
  switch (to.page) {
    case 'board': case 'sheet': case 'map': case 'technology':
      return { page: to.page, ...id, ...(to.select !== undefined ? { select: to.select } : {}) }
    case 'decisions': return { page: 'decisions', ...id }
    case 'observations': return { page: 'observations', ...id, ...(to.tab !== undefined ? { tab: to.tab } : {}) }
    case 'roadmap': return { page: 'roadmap' }
    case 'plan': return to.id !== undefined ? { page: 'plan', id: to.id } : { page: 'roadmap' }
    case 'element': return to.id !== undefined ? { page: 'element', id: to.id } : undefined
    case 'document': return to.id !== undefined ? { page: 'document', id: to.id } : { page: 'documentation' }
    case 'documentation': return { page: 'documentation' }
    case 'platform': return to.id !== undefined ? { page: 'platform', id: to.id } : undefined
    case 'service': return to.id !== undefined ? { page: 'service', id: to.id } : undefined
    default: return undefined
  }
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
