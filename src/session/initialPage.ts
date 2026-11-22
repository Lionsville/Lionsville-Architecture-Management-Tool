// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Which page a scope opens on, as the shell and the pages say it to each
 * other: a home's row, a search hit, a finding's action and an agent's
 * destination all name a page in these words, and the workspace obeys them.
 *
 * Here rather than with either side, so neither imports the other: the type,
 * the page a destination comes to, and whether a page is one a scope has
 * before anything is written in it.
 */
import { VIEW_PAGES } from '../agent/screen'
import type { Destination, ObservationTab } from '../agent/screen'
import type { ElementId } from '../model'
import type { ScopePath } from '../projects/scopePath'

/** The pages that are a view's tab: a board, and each laid-out kind and a drawing (`agent/screen`'s `VIEW_PAGES`). */
export type ViewPageName = 'board' | 'sheet' | 'map' | 'technology' | 'drawing' | 'chart' | 'conway'

/**
 * Which page the workspace should be showing the moment it appears.
 *
 * The organisation's own pages are reached from the cards on its screen, and
 * the root scope that holds them usually draws nothing at all — its decisions,
 * its plans and its business architecture are what it has, and a canvas is not.
 * Without this, pressing *Open* on a card would land a person on an empty board
 * with the page they asked for still shut.
 *
 * Shell vocabulary rather than either screen's: one screen says it and the
 * other obeys it, and a type that lived in either would make them import each
 * other.
 */
export type InitialPage =
  /** The decisions page, on one record when an id is given (ADR-0019). */
  | { page: 'decisions'; id?: string }
  /**
   * The observations page (ADR-0021), on one observation or cause when an id
   * is given, and on one of its tabs when a tab is (ADR-0019, amended).
   */
  | { page: 'observations'; id?: string; tab?: ObservationTab }
  | { page: 'roadmap'; select?: string }
  /**
   * The operating model (ADR-0036): kept at the organisation and opened there,
   * on one unit type, role or responsibility when an id is given.
   */
  | { page: 'operating'; id?: string }
  /** A scope's principles (ADR-0041), on one principle when an id is given. */
  | { page: 'principles'; id?: string }
  /** A platform's report, or a service's (ADR-0013, ADR-0014): derived, opened by id, never made. */
  | { page: 'platform'; id: ElementId }
  | { page: 'service'; id: ElementId }
  /**
   * A view on its tab, by id — or, with none, the one on the scope's tab where
   * it is of that kind and else the first; a scope with none of that kind
   * lands on its home, because an open never makes a view (ADR-0019, amended).
   * `select` is an element selected there where it is drawn there, and `tab`
   * the reading it opens on, where it has more than one.
   */
  | { page: ViewPageName; id?: string; select?: ElementId; tab?: string; edit?: boolean }
  /**
   * A new sheet, enterprise map or technology landscape, made the moment the
   * scope opens: the person's own *Make…* and *New board…* on a home, which is
   * the one way onto a view that writes one.
   */
  | { page: 'make'; kind: 'sheet' | 'map' | 'technology' | 'drawing' | 'chart' | 'conway'; name?: string }
  /** One plan, on its page over the roadmap — an initiative opened where it lives (ADR-0012 §7). */
  | { page: 'plan'; id: string }
  /**
   * A record, selected on the board that draws it — a row of the register,
   * opened where it is answered for.
   */
  | { page: 'element'; id: ElementId; line?: string; field?: string }
  /**
   * A record's page — the document and the record's fields — opened in the
   * scope that answers for it, which is where the fields may be written.
   */
  | { page: 'document'; id: ElementId }
  /** The documentation page as the bar opens it: on the selected element, or the first. */
  | { page: 'documentation' }
  /**
   * Not a page, and here anyway: *link* (ADR-0012 §10), asked the moment the
   * scope opens.
   *
   * A gesture is applied by the session that holds the scope — one `Command`,
   * one undo step, one Activity line — so the register's *Link…* cannot do it
   * where it stands. What it can do is open the scope that should yield and
   * ask there, which is this.
   */
  | { page: 'link'; id: ElementId; to: ScopePath }

/** A page that is a view's tab, as `screen.ts` lists them. */
export function isViewPageName(page: string | undefined): page is ViewPageName {
  return page !== undefined && (VIEW_PAGES as readonly string[]).includes(page)
}

/**
 * Is this a page a scope has before anything is written in it — its decisions,
 * its observations, its roadmap, or a sheet, map or technology landscape the
 * person asked to be made? Those open on a scope with no document. A page that
 * names a record, a plan or a view names something that has to be there, and
 * a scope that is not there is then one somebody removed, not one to make; a
 * view's page with no id opens one that is there, and a scope with no
 * document has none (`pageLanding`).
 */
export function opensOnNothing(page: InitialPage | undefined): boolean {
  if (page === undefined) return false
  switch (page.page) {
    case 'decisions':
    case 'observations':
    case 'operating':
    case 'principles':
      return page.id === undefined
    case 'roadmap':
    case 'documentation':
    case 'make':
      return true
    default:
      return false
  }
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
  if (isViewPageName(to.page)) return { page: to.page, ...id, ...(to.select !== undefined ? { select: to.select } : {}), ...(to.tab !== undefined ? { tab: to.tab } : {}), ...(to.edit ? { edit: true } : {}) }
  switch (to.page) {
    case 'decisions': return { page: 'decisions', ...id }
    case 'observations': return { page: 'observations', ...id, ...(to.tab !== undefined ? { tab: to.tab as ObservationTab } : {}) }
    case 'roadmap': return { page: 'roadmap', ...(to.select !== undefined ? { select: to.select } : {}) }
    case 'operating': return { page: 'operating', ...id }
    case 'principles': return { page: 'principles', ...id }
    case 'plan': return to.id !== undefined ? { page: 'plan', id: to.id } : { page: 'roadmap' }
    case 'element': return to.id !== undefined ? { page: 'element', id: to.id, ...(to.line !== undefined ? { line: to.line } : {}), ...(to.field !== undefined ? { field: to.field } : {}) } : undefined
    case 'document': return to.id !== undefined ? { page: 'document', id: to.id } : { page: 'documentation' }
    case 'documentation': return { page: 'documentation' }
    case 'platform': return to.id !== undefined ? { page: 'platform', id: to.id } : undefined
    case 'service': return to.id !== undefined ? { page: 'service', id: to.id } : undefined
    default: return undefined
  }
}
