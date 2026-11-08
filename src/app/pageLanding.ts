// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where opening a scope on a page lands, read off the scope as it was read
 * (ADR-0019, amended): the page as it will be shown, and the view the session
 * starts on — or the scope's home, where the page asked for a view the scope
 * does not have.
 *
 * **An open never makes a view.** A view's page with no id opens the one on
 * the scope's tab where it is of that kind, and the first of that kind
 * otherwise; with none of that kind it lands on the home. The one way onto a
 * view that writes one is `make`, which is the person's own *Make…* and
 * *New board…*, said apart so nothing else can ask for it by accident.
 *
 * An element's page starts the session on the board that draws it where the
 * board on the tab does not and exactly one does, so the screen the scope
 * opens on is the screen it stays on. Pure: the shell holds the state.
 */
import { boardsDrawing } from '../model'
import { VIEW_PAGES, viewFor } from '../agent/screen'
import type { ScopeSnapshot } from '../projects/scope'
import type { InitialPage, ViewPageName } from './App'

export type PageLanding =
  | { readonly home: true }
  | { readonly page?: InitialPage; readonly activeDiagramId?: string }

/** A page that is a view's tab, as `screen.ts` lists them. */
export function isViewPageName(page: string | undefined): page is ViewPageName {
  return page !== undefined && (VIEW_PAGES as readonly string[]).includes(page)
}

function isViewPage(page: InitialPage): page is Extract<InitialPage, { page: ViewPageName }> {
  return isViewPageName(page.page)
}

/**
 * A door that shows something on a view of a kind — *Show on technology
 * landscape ›* — offered only while the scope has a view of that kind to show
 * it on. A door to a view that is gone opened nothing, and an open never makes
 * a view; so where there is none the door is not drawn, the one rule every
 * such link is offered by.
 */
export function showOnDoor<Door>(page: ViewPageName, diagrams: readonly { id: string; kind: string }[], door: Door | undefined): Door | undefined {
  return door !== undefined && viewFor(page, undefined, diagrams, undefined) !== undefined ? door : undefined
}

export function pageLanding(scope: Pick<ScopeSnapshot, 'model' | 'activeDiagramId'>, page: InitialPage | undefined): PageLanding {
  // No page named is the view on the tab. A scope with no views — a domain
  // made without a board — has none, and the canvas could only say so as an
  // error: it lands on its home, empty until a board is made.
  if (page === undefined) return scope.model.diagrams.length === 0 ? { home: true } : {}
  if (isViewPage(page)) {
    const id = viewFor(page.page, page.id, scope.model.diagrams, scope.activeDiagramId)
    if (id === undefined) return { home: true }
    return { page: { ...page, id }, activeDiagramId: id }
  }
  if (page.page === 'element') {
    const boards = boardsDrawing(scope.model, page.id)
    const onTab = boards.some((board) => board.id === scope.activeDiagramId)
    return onTab || boards.length !== 1 ? { page } : { page, activeDiagramId: boards[0].id }
  }
  return { page }
}
