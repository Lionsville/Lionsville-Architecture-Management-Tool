// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A place in the window's history, and its address (ADR-0033).
 *
 * Back goes to the place before, so the history has to hold places, and a
 * place is not a new idea: it is what `app.current` says (ADR-0019's
 * {@link Screen}), written in the three words `app.open` takes — a scope, a
 * page and an id, a {@link Destination}. Nothing else is part of one: not the
 * element selected on a board, not a dialog, a filter or a scroll position. The
 * day a view is looked at (ADR-0027, amended) is said in the address, so a link
 * lands on the same look with the same band, and a change of it replaces the
 * entry: a Back that walked through every day looked at would be useless.
 *
 * **The address.** A place is written into the address's fragment, so a
 * reload in a browser lands where the person was, and the fragment never
 * leaves the browser — the names of scopes reach no server's log on the way.
 * The grammar is a path (ADR-0033, amended 17 October 2026): the scope's path
 * as it is written everywhere else, a `-` that ends it, and the page and the
 * record after it:
 *
 *     #/acme/rail/-/board/landscape
 *     #/freight/-/document/freight-division      an element's page
 *     #/-/home                                   the organisation's home
 *     #/acme/-/observations?tab=analysis         a tab, as a query
 *     #/acme/rail/-/board/landscape?select=crm   what a link selects
 *     #/acme/-/drawing/context?edit              a drawing, in its editor
 *
 * The `-` is what keeps a scope called *board* from reading as a page: a
 * scope's path may hold any name, so the scope is said up to a segment that no
 * scope's can be, and a scope's own segment that is `-` is written escaped.
 * Each segment is `encodeURIComponent`'s, so a `/` or a `#` a person put in a
 * name comes back as it went in.
 *
 * **The form before it** is read as well, and always will be: links shared
 * from 3.5 to 3.6 were a fixed prefix and a query string,
 *
 *     #place?scope=acme%2Frail&page=board&id=landscape
 *
 * and {@link readPlace} reads them to the same place. Only the path is
 * written, so the first step the app takes after opening an old link writes
 * it over in the new shape (`app/placeHistory.ts`).
 *
 * The observations page says which of its tabs is up, so a place on it may
 * carry `tab` as well (ADR-0019, amended): a reload stays on the tab, and a
 * change of tab is another record on the same page as far as a step goes.
 *
 * A link may also carry `select` (ADR-0033, amended 11 October 2026): an
 * element to select and mark on the view the link opens. It is read on
 * arrival and nowhere else — it is no part of a place, so `samePlace`,
 * `placeOf` and the history's state never hold it, and choosing another
 * element is never a step. `field` is read the same way: the field of a page
 * to give the focus to as it opens (`PAGE_FIELDS`), as the tree's *Move to…*
 * lands on a scope's *Filed under*: `#/acme/-/settings?field=filedUnder`.
 *
 * A list keeps what it is showing the same way, as `q`, `group`, `sort`,
 * `cols` and `f.<field>` beside the rest (`widgets/kit/listView.ts`): a link and
 * an agent reach the same list, and choosing a filter replaces the entry rather
 * than adding a Back.
 *
 * A finding on its way to being fixed goes with the place, as `finding`, so that a
 * link reaches the same band and a reload keeps it ({@link writeFinding}).
 *
 * An organisation chart may carry its reading (`focus`, a unit; `lines`, what
 * the Lines menu draws), since a chart focused on one unit is somewhere a link
 * and an agent go to: `#/-/chart/organisation-chart?focus=warehouse&lines=dotted`.
 *
 * The leading `/` — `place?` in the old form — is what tells a place
 * from anything else a fragment may carry: a source provider reads the
 * address too (`SourceConnect.fromLocation`), and a fragment that is not a
 * place is left alone for whoever wrote it. Both readings are strict for the
 * same reason.
 *
 * Pure, and the agent's module's because the vocabulary is: the shell keeps
 * the history (`app/placeHistory.ts`), and a test here says that every place
 * written is read back the same.
 */
import { FRAME_PAGES, HOME_PAGES, isChartLines, isFramePanel, isPageField, isPageTab, PAGE_TABS, pagesKnown, VIEW_PAGES, viewPage } from './screen'
import type { DesignDiagram } from '../model/types'
import type { ChartLines, Destination, Page, Screen } from './screen'

/** A destination that names its scope: what the history holds, and what an address carries. */
export type Place = Destination & { readonly scope: string }

/** What a fragment that is a place begins with, after the `#`. */
export const PLACE_PATH_PREFIX = '/'

/**
 * What a place's fragment began with until 3.7.0, after the `#`: the form
 * links shared from 3.5 to 3.6 carry. Read, never written.
 */
export const PLACE_PREFIX = 'place?'

/** The key a place is kept under in a history entry's state, beside whatever other code keeps there. */
export const PLACE_STATE_KEY = 'lvarch.place'

/** The segment that ends a scope's path in a place's address. */
const SCOPE_END = '-'

const KEYS = new Set(['scope', 'page', 'id', 'tab', 'look', 'select', 'field', 'panel', 'colour', 'finding', 'day', 'group', 'pair', 'focus', 'lines', 'edit'])

/**
 * What a list says about itself in the address (`widgets/kit/listView.ts`):
 * what was typed, what is filtered, how it is grouped and sorted, the columns.
 * Carried whole as one string, because what they mean is the list's and a place
 * only keeps them with it. A filter's key may be said twice.
 */
const isListKey = (key: string) => key === 'q' || key === 'group' || key === 'sort' || key === 'cols' || key.startsWith('f.')

/** On a Conway map `group` is what the map is grouped by: the page has no list for it to be a list's. */
const isListKeyOn = (page: string | undefined, key: string) => isListKey(key) && !(page === 'conway' && key === 'group')

/** What may follow the path, as a query: everything a place says beyond its scope, page and record. */
const QUERY_KEYS = new Set(['id', 'tab', 'look', 'select', 'field', 'panel', 'colour', 'finding', 'day', 'group', 'pair', 'focus', 'lines', 'edit'])

/** One segment of the path, escaped: a scope's own segment that is the scope's end is written so it cannot be read as one. */
function segment(text: string): string {
  return text === SCOPE_END ? '%2D' : encodeURIComponent(text)
}

/** The fragment for a place, with its `#`. */
export function writePlace(place: Place): string {
  const path = [...(place.scope === '' ? [] : place.scope.split('/').map(segment)), SCOPE_END]
  const query = new URLSearchParams()
  if (place.page !== undefined) {
    path.push(segment(place.page))
    if (place.id !== undefined) path.push(segment(place.id))
  } else if (place.id !== undefined) {
    // A record with no page to say it on: there is no such screen, but a
    // destination may say it, and what is written is read back.
    query.set('id', place.id)
  }
  if (place.tab !== undefined) query.set('tab', place.tab)
  if (place.look !== undefined) query.set('look', place.look)
  if (place.select !== undefined) query.set('select', place.select)
  if (place.field !== undefined) query.set('field', place.field)
  if (place.panel !== undefined) query.set('panel', place.panel)
  if (place.colour !== undefined) query.set('colour', place.colour)
  if (place.finding !== undefined) query.set('finding', place.finding)
  if (place.day !== undefined) query.set('day', place.day)
  if (place.group !== undefined) query.set('group', place.group)
  if (place.pair !== undefined) query.set('pair', place.pair)
  if (place.focus !== undefined) query.set('focus', place.focus)
  if (place.lines !== undefined) query.set('lines', place.lines)
  // `edit` is a word with no value: `URLSearchParams` would write `edit=`.
  const rest = [query.toString(), place.edit ? 'edit' : '', place.list ?? ''].filter(Boolean).join('&')
  return `#${PLACE_PATH_PREFIX}${path.join('/')}${rest === '' ? '' : `?${rest}`}`
}

/**
 * A link to a place (ADR-0033, amended): the address somebody else reaches the
 * same work at, with the place as its fragment. Whatever fragment the address
 * had is dropped — a link names one place, and a fragment that is somebody
 * else's would be read before it — and its path and query are kept as they
 * were said, because which of those a link needs is the business of whoever
 * gave the address.
 */
export function linkTo(address: string, place: Place): string {
  const hash = address.indexOf('#')
  return `${hash < 0 ? address : address.slice(0, hash)}${writePlace(place)}`
}

/**
 * The place a fragment names, with or without its `#` — or `undefined` for a
 * fragment that is not one: neither of the two forms, a key or a segment the
 * grammar does not have, a key said twice, no scope, a page there is no such
 * thing as, or a tab that is not one of the observations page's. Strict,
 * because a fragment that nearly is a place is somebody else's.
 */
export function readPlace(hash: string): Place | undefined {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  if (fragment.startsWith(PLACE_PATH_PREFIX)) return readPath(fragment.slice(PLACE_PATH_PREFIX.length))
  if (fragment.startsWith(PLACE_PREFIX)) return readQueryForm(fragment.slice(PLACE_PREFIX.length))
  return undefined
}

/** Whether a fragment is written in the form links carried until 3.7.0, which is read and written over. */
export function oldPlaceForm(hash: string): boolean {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  return fragment.startsWith(PLACE_PREFIX) && readPlace(hash) !== undefined
}

/** `#/<scope>/-/<page>/<id>?tab=…&select=…`, after its leading `/`. */
function readPath(text: string): Place | undefined {
  const mark = text.indexOf('?')
  const path = mark < 0 ? text : text.slice(0, mark)
  const segments = path.split('/')
  const end = segments.indexOf(SCOPE_END)
  if (end < 0) return undefined
  const decoded = decodeAll(segments)
  if (decoded === undefined) return undefined
  const scopeParts = decoded.slice(0, end)
  // The organisation's path is the empty one, said by nothing before the end;
  // any other scope has no empty segment.
  if (scopeParts.some((part) => part === '')) return undefined
  const after = decoded.slice(end + 1)
  if (after.length > 2) return undefined
  const [page, id] = after
  if (page !== undefined && !isPage(page)) return undefined
  const whole = new URLSearchParams(mark < 0 ? '' : text.slice(mark + 1))
  const query = new URLSearchParams([...whole].filter(([key]) => !isListKeyOn(page, key)))
  const list = new URLSearchParams([...whole].filter(([key]) => isListKeyOn(page, key))).toString()
  const said = queryOf(query, QUERY_KEYS)
  if (said === undefined) return undefined
  // A record said twice, or a record with no page that is said in the query
  // and on the path at once, is not a place.
  if (said.id !== undefined && page !== undefined) return undefined
  const scope = scopeParts.join('/')
  const place = withField(placeFrom(scope, page, id ?? said.id, said.tab, said.select, said.panel, said.day, said), said.field)
  if (!place) return undefined
  return { ...place, ...(list !== '' ? { list } : {}), ...(said.finding !== undefined ? { finding: said.finding } : {}) }
}

/** `#place?scope=…&page=…&id=…`, the form before 3.7.0, after its prefix. */
function readQueryForm(text: string): Place | undefined {
  const said = queryOf(new URLSearchParams(text), KEYS)
  if (said === undefined || said.scope === undefined) return undefined
  if (said.page !== undefined && !isPage(said.page)) return undefined
  return withField(placeFrom(said.scope, said.page, said.id, said.tab, said.select, said.panel, said.day, said), said.field)
}

/** A field to focus, where one was said: one of its page's, and a page with none has none. */
function withField(place: Place | undefined, field: string | undefined): Place | undefined {
  if (place === undefined || field === undefined) return place
  return isPageField(place.page, field) ? { ...place, field } : undefined
}

/** Every key of a query once, and only the ones allowed: or nothing. */
function queryOf(query: URLSearchParams, allowed: ReadonlySet<string>): Partial<Record<'scope' | 'page' | 'id' | 'tab' | 'look' | 'select' | 'field' | 'panel' | 'colour' | 'finding' | 'day' | 'group' | 'pair' | 'focus' | 'lines' | 'edit', string>> | undefined {
  const out: Record<string, string> = {}
  for (const [key, value] of query) {
    if (!allowed.has(key) || key in out) return undefined
    out[key] = value
  }
  return out
}

function placeFrom(
  scope: string, page: string | undefined, id: string | undefined, tab: string | undefined, select: string | undefined, panel?: string, day?: string,
  onView: { readonly group?: string; readonly pair?: string; readonly look?: string; readonly colour?: string; readonly focus?: string; readonly lines?: string; readonly edit?: string } = {},
): Place | undefined {
  if (page !== undefined && !isPage(page)) return undefined
  // A chart's reading, on a chart's address and nowhere else; the Lines menu has its own words.
  if ((onView.focus !== undefined || onView.lines !== undefined) && page !== 'chart') return undefined
  if (onView.lines !== undefined && !isChartLines(onView.lines)) return undefined
  if (tab !== undefined && !(page === undefined ? anyPageHasTab(tab) : isPageTab(page, tab))) return undefined
  if (panel !== undefined && !isFramePanel(panel)) return undefined
  if (day !== undefined && !(isLookDay(day) && page !== undefined && VIEW_PAGES.includes(page))) return undefined
  return {
    scope, ...(day !== undefined ? { day } : {}), ...(page !== undefined ? { page } : {}), ...(id !== undefined ? { id } : {}), ...(tab !== undefined ? { tab } : {}),
    ...(onView.look ? { look: onView.look } : {}),
    ...(panel !== undefined ? { panel } : {}),
    ...(select !== undefined && select !== '' ? { select } : {}),
    // What a view is coloured by is a word the view itself judges.
    ...(onView.colour !== undefined && page !== undefined && READINGS.includes(page) ? { colour: onView.colour } : {}),
    ...(onView.group ? { group: onView.group } : {}), ...(onView.pair ? { pair: onView.pair } : {}),
    ...(onView.focus ? { focus: onView.focus } : {}),
    ...(onView.lines !== undefined ? { lines: onView.lines as ChartLines } : {}),
    ...(onView.edit !== undefined && page === 'drawing' ? { edit: true } : {}),
  }
}

/** A day a look may be on: a date, or today where a view is saved on another. */
export function isLookDay(day: unknown): day is string {
  return typeof day === 'string' && (day === 'today' || /^\d{4}-\d{2}-\d{2}$/.test(day))
}

/** The views read through a colour, which goes in the address. */
const READINGS: readonly string[] = ['sheet', 'map']

/** Every segment as it was written, or nothing where one is not an escape the browser would make. */
function decodeAll(segments: readonly string[]): string[] | undefined {
  try {
    return segments.map((one) => decodeURIComponent(one))
  } catch {
    return undefined
  }
}

/** A tab with no page said beside it: read back as what it is, for the destination that wrote it. */
function anyPageHasTab(tab: string): boolean {
  return Object.values(PAGE_TABS).some((tabs) => tabs.includes(tab))
}

function isPage(value: string): value is Page {
  return pagesKnown().includes(value)
}

/**
 * Whether a fragment meant to be a place and is not one: it is written in
 * either form and {@link readPlace} refuses it — a page there is no such
 * thing as, a key this grammar does not have. The boot says so then, rather
 * than landing somewhere else in silence; a fragment in neither form is
 * somebody else's and is left alone as before.
 */
export function unknownPlace(hash: string): boolean {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  const meant = fragment.startsWith(PLACE_PREFIX) || fragment.startsWith(PLACE_PATH_PREFIX)
  return meant && readPlace(hash) === undefined
}

/**
 * A place out of whatever a history entry's state holds — the window's
 * history is anybody's to write, so it is checked as an address is, by
 * writing what was found and reading it back.
 */
export function placeInState(state: unknown): Place | undefined {
  if (typeof state !== 'object' || state === null) return undefined
  const held = (state as Record<string, unknown>)[PLACE_STATE_KEY]
  if (typeof held !== 'object' || held === null) return undefined
  const { scope, page, id, tab, look, panel, colour, list, finding, day, group, pair, edit } = held as Record<string, unknown>
  if (typeof scope !== 'string') return undefined
  if (page !== undefined && (typeof page !== 'string' || !isPage(page))) return undefined
  if (id !== undefined && typeof id !== 'string') return undefined
  if (tab !== undefined && !(typeof page === 'string' && isPage(page) && isPageTab(page, tab))) return undefined
  return {
    scope, ...(page !== undefined ? { page } : {}), ...(id !== undefined ? { id } : {}), ...(tab !== undefined ? { tab: tab as string } : {}),
    ...(typeof look === 'string' && look !== '' ? { look } : {}),
    ...(isFramePanel(panel) ? { panel } : {}),
    ...(typeof colour === 'string' ? { colour } : {}),
    ...(typeof list === 'string' && list !== '' ? { list } : {}),
    ...(typeof finding === 'string' && finding !== '' ? { finding } : {}),
    ...(isLookDay(day) && typeof page === 'string' && isPage(page) && VIEW_PAGES.includes(page) ? { day } : {}),
    ...(typeof group === 'string' ? { group } : {}), ...(typeof pair === 'string' ? { pair } : {}),
    ...(edit === true && page === 'drawing' ? { edit: true } : {}),
  }
}

/**
 * The place a screen is: the scope that is open and its view or the page
 * over it, or, with nothing open, whose home is up and its page.
 *
 * `undefined` for a screen that is not a place yet: a scope whose workspace
 * has not said what is on it — there is no view and no page to name, for the
 * moment between a scope being chosen and its workspace being up — and a
 * screen that says nothing at all.
 */
export function placeOf(screen: Screen): Place | undefined {
  const beside = { ...(screen.panel !== undefined ? { panel: screen.panel } : {}), ...(screen.list !== undefined ? { list: screen.list } : {}), ...(screen.finding !== undefined ? { finding: screen.finding } : {}) }
  if (screen.open) {
    const scope = screen.open.path
    if (screen.page) {
      const up = screen.page
      return {
        scope, page: up.page, ...('id' in up && up.id !== undefined ? { id: up.id } : {}),
        ...('tab' in up && up.tab !== undefined ? { tab: up.tab } : {}),
        ...('look' in up && up.look !== undefined ? { look: up.look } : {}), ...beside,
      }
    }
    const view = screen.open.view
    // A scope whose last view went stays open on an empty place: its address is the scope's
    // own, which a reload lands on its home, as an open scope with no views always has.
    if (!view && screen.open.noView) return { scope, ...beside }
    return view
      ? {
          scope, page: viewPage(diagramKind(view.kind)), id: view.id, ...(view.editing ? { edit: true } : {}), ...(view.day !== undefined ? { day: view.day } : {}), ...beside,
          ...(view.tab !== undefined ? { tab: view.tab } : {}), ...(view.colour !== undefined ? { colour: view.colour } : {}), ...(view.group !== undefined ? { group: view.group } : {}), ...(view.pair !== undefined ? { pair: view.pair } : {}),
          ...(view.focus !== undefined ? { focus: view.focus } : {}), ...(view.lines !== undefined ? { lines: view.lines } : {}),
        }
      : undefined
  }
  if (screen.home) {
    const up = screen.page
    // A panel over a bare home is the panel's own short address: `#/-/work`.
    if (up === undefined && screen.panel !== undefined && screen.panel !== 'settle') return { scope: screen.home.path, page: screen.panel }
    return {
      scope: screen.home.path, page: up?.page ?? 'home',
      ...(up !== undefined && 'id' in up && up.id !== undefined ? { id: up.id } : {}),
      ...(up !== undefined && 'tab' in up && up.tab !== undefined ? { tab: up.tab } : {}), ...beside,
    }
  }
  return undefined
}

/** What a place says of the view it opens beyond which view: its reading, what it is grouped by, the pair chosen, a chart's focus and lines. */
export function viewFacetsOf(to: Destination, of: string): { of: string; tab?: string; group?: string; pair?: string; focus?: string; lines?: string } | undefined {
  if (to.tab === undefined && to.group === undefined && to.pair === undefined && to.focus === undefined && to.lines === undefined) return undefined
  return {
    of, ...(to.tab !== undefined ? { tab: to.tab } : {}), ...(to.group !== undefined ? { group: to.group } : {}), ...(to.pair !== undefined ? { pair: to.pair } : {}),
    ...(to.focus !== undefined ? { focus: to.focus } : {}), ...(to.lines !== undefined ? { lines: to.lines } : {}),
  }
}

/** The same place: the same scope, page, id, tab, look, panel, colour, list and finding carried, day, what a view keeps, and on a chart its focus and lines. */
export function samePlace(a: Place | undefined, b: Place | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  return a.scope === b.scope && a.page === b.page && a.id === b.id && Boolean(a.edit) === Boolean(b.edit) && a.tab === b.tab && a.look === b.look && a.panel === b.panel && a.colour === b.colour && a.list === b.list && a.finding === b.finding && a.day === b.day && a.group === b.group && a.pair === b.pair && a.focus === b.focus && a.lines === b.lines
}

/** The pages where moving from one record to the next is choosing, not going somewhere. */
const RECORD_PAGES: readonly Page[] = ['decisions', 'observations', 'register', 'checks']

/**
 * What a move from one place to another does to the history.
 *
 * - **Nothing** for the same place: a look that found nothing new.
 * - **Replace** the entry for the first place there is — the entry the window
 *   opened on is the app's, and pushing would leave a Back that goes nowhere
 *   — and for another record or another tab on the same record page, because
 *   a Back that walked through every record looked at would be useless. The
 *   address still names the record and the tab on screen, so a reload stays
 *   on them.
 * - **Push** for every other move. Opening a record page on a record from
 *   anywhere else is one of those.
 */
export function stepBetween(from: Place | undefined, to: Place): 'push' | 'replace' | 'none' {
  if (from === undefined) return 'replace'
  if (samePlace(from, to)) return 'none'
  if (from.scope === to.scope && from.page === to.page && to.page !== undefined && RECORD_PAGES.includes(to.page) && from.panel === to.panel) return 'replace'
  // A focus is going somewhere: Back comes out of it. The lines drawn are not.
  if (from.focus !== to.focus) return 'push'
  // Another tab on the same page is choosing as well, whichever page has tabs.
  if (from.scope === to.scope && from.page === to.page && from.id === to.id && from.panel === to.panel && Boolean(from.edit) === Boolean(to.edit)) return 'replace'
  return 'push'
}

/**
 * What the app knows about where a place was, when Back or a reload brings
 * it up again: which scopes are there now, and what the place's own scope
 * holds — its views in order, and whether a record is still in it. The last
 * two are absent where the scope was not read, and the place is then trusted.
 */
export type PlaceFacts = {
  readonly scopeIs: (path: string) => boolean
  readonly views?: readonly { readonly id: string; readonly kind: string }[]
  readonly holds?: (id: string) => boolean
}

/** The scopes above a path, nearest first, ending with the organisation's. */
function above(path: string): string[] {
  const parts = path.split('/')
  const out: string[] = []
  for (let n = parts.length - 1; n > 0; n -= 1) out.push(parts.slice(0, n).join('/'))
  if (path !== '') out.push('')
  return out
}

/**
 * Where a place lands now that the app may have changed under it.
 *
 * The history cannot skip an entry, so a place that is not there any more
 * lands as near to it as there is, and says nothing about the difference —
 * what was removed is in the Activity list:
 *
 * - a scope that was removed: the home of the nearest scope above it that is
 *   still there, the organisation's at the last;
 * - a view that was removed: its scope on the scope's first view, or the
 *   scope's home where it has none left;
 * - a record that was removed: its page without one — a plan's page is the
 *   roadmap — and a platform's or a service's report, which has no page
 *   without its record, the scope as its first view shows it.
 */
export function nearestPlace(place: Place, facts: PlaceFacts): Place {
  const { scope, page, id } = place
  if (scope !== '' && !facts.scopeIs(scope)) {
    const nearest = above(scope).find((path) => path === '' || facts.scopeIs(path)) ?? ''
    return { scope: nearest, page: 'home' }
  }
  if (page !== undefined && (HOME_PAGES.includes(page) || FRAME_PAGES.includes(page))) return place
  const views = facts.views
  const first: Place = views === undefined
    ? { scope }
    : views.length > 0 ? { scope, page: viewPage(diagramKind(views[0].kind)), id: views[0].id } : { scope, page: 'home' }
  if (page === undefined) return views !== undefined && views.length === 0 ? first : place
  if (VIEW_PAGES.includes(page)) {
    if (id === undefined || views === undefined || views.some((view) => view.id === id)) return place
    return first
  }
  if (id === undefined || facts.holds === undefined || facts.holds(id)) return place
  switch (page) {
    case 'decisions':
      return { scope, page }
    case 'observations':
      return { scope, page, ...(place.tab !== undefined ? { tab: place.tab } : {}) }
    case 'plan':
      return { scope, page: 'roadmap' }
    case 'operating':
    case 'principles':
      return { scope, page }
    default:
      return first
  }
}

/** A view's kind as the model spells it. Anything else is a board: the page a view opened on before a drawing was a kind. */
function diagramKind(kind: string): DesignDiagram['kind'] {
  switch (kind) {
    case 'layer7':
    case 'container':
    case 'sheet':
    case 'map':
    case 'technology':
    case 'drawing':
    case 'chart':
    case 'conway':
      return kind
    default:
      return 'layer7'
  }
}

/** A finding carried by a band, in an address: the check, the home whose Checks it is from, and the finding. */
export type CarriedFinding = { readonly check: string; readonly home: string; readonly id: string }

/** Spaces between, since neither a check's key nor a scope's path holds one, and the finding's id may hold anything. */
export function writeFinding({ check, home, id }: CarriedFinding): string {
  return `${check} ${home} ${id}`
}

export function readFinding(text: string): CarriedFinding | undefined {
  const first = text.indexOf(' ')
  const second = first < 0 ? -1 : text.indexOf(' ', first + 1)
  if (second < 0) return undefined
  return { check: text.slice(0, first), home: text.slice(first + 1, second), id: text.slice(second + 1) }
}
