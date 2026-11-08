// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The one tree of scopes, in two postures (the integral review's first
 * conflict): docked where the tree is the content, on a home or pinned by ⌘\,
 * and over the work from the trail's chevron, with the width left to the work.
 * The same find, the same rows and the same foot either way.
 *
 * Three ways through a thin tree. *All* keeps every scope, the empty ones in a
 * quieter ink, so the structure stays true. *With work* takes them out and
 * keeps the path down to what is left. Typing searches every scope by name and
 * by the topics relevant to it, and shows each match flat with its path, so
 * nothing needs unfolding.
 */
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent, RefObject } from 'react'
import { CaretIcon } from '../../widgets/icons'
import type { Language, Translate } from '../../i18n'
import type { Destination, Page } from '../../agent/screen'
import { flattenScopes, sortScopes } from '../../projects/scope'
import type { ProjectOrder, ScopeSummary } from '../../projects/scope'
import { ancestorScopes, parentScope, ROOT_SCOPE, scopePathLabel } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { linkHolds, topicRowsAt } from '../../projects/topics'
import type { TypeLink } from '../../projects/scopeType'
import { matchesQuery } from '../../model/textSearch'
import { MoreMenu } from '../../widgets/kit/Menu'
import type { MenuEntry } from '../../widgets/kit/Menu'
import { FindField } from '../../widgets/kit/FindField'
import { LinkLine } from '../../widgets/kit/Section'
import { Tabs } from '../../widgets/kit/Tabs'
import { heldInWords, RootRow, ScopeTree, TopicTreeRow } from '../organisation/ScopeTree'
import type { TopicRow } from '../organisation/ScopeTree'
import type { Holdings } from '../organisation/holdings'
import type { ScopeFolds } from '../organisation/useScopeFolds'
import { ORGANISATION_PLACES, placeShows } from './places'
import { useTreeKeys } from './treeKeys'

/** What a row's ⋯ can do, each its own question on the home that answers it. */
export type TreeActs = {
  onSettings: (scope: ScopeSummary) => void
  onMove: (scope: ScopeSummary) => void
  onDelete: (scope: ScopeSummary) => void
  onNewScopeUnder: (path: ScopePath) => void
  /** The kinds of view a scope can be given, each one a press. */
  newViewItems: (path: ScopePath) => readonly { label: string; onSelect: () => void }[]
}

export type ScopeTreePanelProps = TreeActs & {
  tree: ScopeSummary
  at: ScopePath
  /** The page that is up, for the foot to mark. */
  page?: Page | undefined
  order: ProjectOrder
  onOrderChange: (order: ProjectOrder) => void
  folds: ScopeFolds
  holdings: Holdings
  onHome: (path: ScopePath) => void
  go: (to: Destination & { scope: string }) => void
  writable: (path: ScopePath) => boolean
  typeLink?: ((path: ScopePath) => TypeLink | undefined) | undefined
  /** Over the work from the trail's chevron: what is typed goes to the find at once. */
  findFirst?: boolean
  /** What the foot says of a place beside its name, and on hover, where it is known. */
  placeFact?: ((page: Page) => { count: string; words: string } | undefined) | undefined
  today: string
  language: Language
  s: Translate
}

type Show = 'all' | 'work'

/** A path the listing could not read, drawn under what it is filed in with the name its address gives, so it is not created again. */
function withUnread(tree: ScopeSummary): { tree: ScopeSummary; unread: ReadonlySet<ScopePath> } {
  const unread = new Set((tree.unreadable ?? []).filter((path) => path !== ROOT_SCOPE))
  if (unread.size === 0) return { tree, unread }
  const place = (scope: ScopeSummary): ScopeSummary => ({
    ...scope,
    children: [
      ...scope.children.map(place),
      ...[...unread].filter((path) => parentScope(path) === scope.path).map((path) => ({ path, name: scopePathLabel(path), diagrams: 0, children: [] })),
    ],
  })
  return { tree: place(tree), unread }
}

function sortTree(tree: ScopeSummary, order: ProjectOrder): ScopeSummary {
  return { ...tree, children: sortScopes(tree.children, order).map((child) => sortTree(child, order)) }
}

/** Every scope a find keeps: by its name, and by the name of a topic relevant to it today. */
export function scopesFound(tree: ScopeSummary, asked: string, today: string): ScopePath[] {
  const every = flattenScopes(tree)
  const byTopic = new Set(every
    .filter((topic) => (topic.relevantTo?.length ?? 0) > 0 && matchesQuery(asked, [topic.name]))
    .flatMap((topic) => (topic.relevantTo ?? []).filter((link) => linkHolds(link, today)).map((link) => link.path)))
  return every.filter((scope) => scope.path !== ROOT_SCOPE && (byTopic.has(scope.path) || matchesQuery(asked, [scope.name]))).map((scope) => scope.path)
}

/** The rows an open scope shows for the topics relevant to it today, each called what the tree calls it. */
export function topicRowsOf(tree: ScopeSummary, today: string): (path: ScopePath) => readonly TopicRow[] {
  const every = flattenScopes(tree)
  const names = new Map(every.map((one) => [one.path, one.name]))
  return (path) => topicRowsAt(path, every, today).map((topic) => ({ path: topic, name: names.get(topic) ?? topic }))
}

function menuFor(scope: ScopeSummary, acts: TreeActs, onHome: (path: ScopePath) => void, writable: (path: ScopePath) => boolean, s: Translate): readonly MenuEntry[] {
  if (!writable(scope.path)) return []
  const movable = scope.path !== ROOT_SCOPE
  return [
    { label: s('org.rowOpen'), onSelect: () => onHome(scope.path) },
    { label: s('org.rowNewScope'), onSelect: () => acts.onNewScopeUnder(scope.path) },
    { label: s('org.rowNewView'), items: acts.newViewItems(scope.path) },
    { label: s('org.rowSettings'), onSelect: () => acts.onSettings(scope) },
    ...(movable ? [
      { label: s('org.rowMove'), onSelect: () => acts.onMove(scope) },
      // Never the root. Its confirm says what goes with it.
      { label: s('org.rowDelete'), final: true, onSelect: () => acts.onDelete(scope) },
    ] : []),
  ]
}

/** How many scope rows the tree keeps before the foot gives up its room. */
const SCOPE_ROWS_KEPT = 6

/**
 * Whether the foot stands folded: what the person chose, or, until they
 * choose, folded when opening it would leave the scopes fewer than
 * {@link SCOPE_ROWS_KEPT} rows — a short window, a large text size. The
 * scopes are what the tree is for; the places across the organisation are
 * also in row two.
 */
function useFootFold(panel: RefObject<HTMLDivElement | null>, rows: RefObject<HTMLDivElement | null>, foot: RefObject<HTMLDivElement | null>) {
  const [chosen, choose] = useState<boolean | undefined>(undefined)
  const [short, setShort] = useState(false)
  const openHeight = useRef(0)
  useLayoutEffect(() => {
    const whole = panel.current
    if (!whole || typeof ResizeObserver === 'undefined') return undefined
    const measure = () => {
      const list = rows.current
      const end = foot.current
      // Nothing laid out (a hidden window, a test's document) is no reason to fold.
      if (!list || !end || whole.clientHeight === 0) return
      const body = end.querySelector<HTMLElement>('.kit-tree__foot-body')
      if (body && !body.hidden) openHeight.current = end.scrollHeight
      const row = list.querySelector<HTMLElement>('.kit-tree__row')?.offsetHeight || 32
      const room = whole.clientHeight - (list.offsetTop - whole.offsetTop)
      setShort(room - openHeight.current < SCOPE_ROWS_KEPT * row)
    }
    const watch = new ResizeObserver(measure)
    watch.observe(whole)
    measure()
    return () => watch.disconnect()
  }, [panel, rows, foot])
  return { folded: chosen ?? short, toggle: () => choose(!(chosen ?? short)) }
}

export function ScopeTreePanel({
  tree, at, page, order, onOrderChange, folds, holdings, onHome, go, writable, typeLink, placeFact, today, language, s, findFirst = false, ...acts
}: ScopeTreePanelProps) {
  const [find, setFind] = useState('')
  const [show, setShow] = useState<Show>('all')
  // The path to where you are, and what is filed under it, stands open, whichever way you arrived.
  const { collapsed, toggleCollapsed } = folds
  useEffect(() => {
    for (const above of [at, ...ancestorScopes(at)]) if (collapsed.has(above)) toggleCollapsed(above)
    // On arrival only: a person may fold what they like after it.
  }, [at])
  const { tree: listed, unread } = useMemo(() => withUnread(sortTree(tree, order)), [tree, order])
  const asked = find.trim()
  const matching = useMemo(() => (asked === '' ? undefined : scopesFound(listed, asked, today)), [listed, asked, today])
  const topicRows = useMemo(() => topicRowsOf(listed, today), [listed, today])
  const name = tree.name.trim() || s('common.organisation')
  const menuOf = (scope: ScopeSummary) => menuFor(scope, acts, onHome, writable, s)
  const panelRef = useRef<HTMLDivElement>(null)
  const rowsRef = useRef<HTMLDivElement>(null)
  const footRef = useRef<HTMLDivElement>(null)
  const { folded, toggle } = useFootFold(panelRef, rowsRef, footRef)
  const treeKeys = useTreeKeys(rowsRef)
  // A right-click on a row opens the row's ⋯, as a view's tab answers one.
  const rowMenu = (event: MouseEvent) => {
    const more = (event.target as HTMLElement).closest('[role="treeitem"]')?.querySelector<HTMLElement>('.kit-tree__menu button')
    if (more) { event.preventDefault(); more.click() }
  }
  // Wherever the tree is opened or moved to, the scope that is up is in sight.
  useEffect(() => {
    rowsRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest' })
  }, [at, show, matching === undefined])
  return (
    <div className="kit-tree" data-testid="scope-tree-panel" ref={panelRef}>
      <div className="kit-tree__find">
        <FindField
          fill label={s('frame.findScope')} value={find} data-testid="tree-find" onChange={setFind} autoFocus={findFirst}
          onKeyDown={(event) => {
            const first = matching?.[0]
            if (event.key === 'Enter' && first !== undefined) { event.preventDefault(); onHome(first) }
            // Down goes into what was found, or the tree, by its one stop.
            if (event.key === 'ArrowDown') {
              const into = rowsRef.current?.querySelector<HTMLElement>('[role="treeitem"][data-enter]') ?? rowsRef.current?.querySelector<HTMLElement>('[role="treeitem"]')
              if (into) { event.preventDefault(); into.focus() }
            }
          }}
        />
      </div>
      <div className="kit-tree__show">
        <Tabs
          label={s('org.treeShow')} value={show} onChange={setShow}
          items={[
            // While a name is typed, what each tab would show of what was found.
            { value: 'all', label: s('org.treeAll'), count: matching ? matching.length : flattenScopes(tree).length },
            { value: 'work', label: s('org.treeWithWork'), count: matching ? matching.filter((path) => holdings.withWork.has(path)).length : holdings.withWork.size },
          ]}
        />
        <MoreMenu
          size="small" label={s('frame.treeMenu')}
          items={[
            { heading: s('frame.orderBy') },
            { label: s('picker.orderName'), checked: order === 'name', radio: true, onSelect: () => onOrderChange('name') },
            { label: s('picker.orderUpdated'), checked: order === 'updated', radio: true, onSelect: () => onOrderChange('updated') },
            { line: true },
            { label: s('org.openAll'), onSelect: folds.openAll },
            { label: s('org.foldAll'), onSelect: folds.foldAll },
          ]}
        />
      </div>
      <div className="kit-tree__rows" ref={rowsRef} role="tree" aria-label={s('org.treeScopes')} onKeyDown={treeKeys} onContextMenu={rowMenu}>
        <div className="kit-tree__head" aria-hidden="true"><span>{s('org.treeScopes')}</span><span>{s('org.treeHolds')}</span></div>
        {matching === undefined && (
          <RootRow
            tree={tree} name={name} current={at === ROOT_SCOPE} count={holdings.count(ROOT_SCOPE)} words={heldInWords(holdings.all(ROOT_SCOPE), s)}
            onHome={onHome} menuOf={menuOf} s={s}
          />
        )}
        {/* The organisation's branch is always open, so what is relevant to it shows at once. */}
        {matching === undefined && show !== 'work' && topicRows(ROOT_SCOPE).map((topic) => (
          <TopicTreeRow key={topic.path} at={ROOT_SCOPE} topic={topic} depth={1} onHome={onHome} s={s} />
        ))}
        <ScopeTree
          tree={listed} folds={folds} onHome={onHome} menuOf={menuOf} holdings={holdings} current={at} language={language} s={s} unread={unread}
          onlyWork={show === 'work'} topicRows={topicRows}
          {...(matching ? { matching, asked } : {})}
          {...(typeLink ? { typeLink } : {})}
        />
      </div>
      <div className="kit-tree__foot" data-testid="tree-foot" ref={footRef}>
        <button type="button" className="kit-tree__heading" aria-expanded={!folded} aria-controls="kit-tree-foot-body" data-testid="tree-foot-fold" onClick={toggle}>
          <span>{s('frame.acrossOrganisation')}</span>
          <CaretIcon />
        </button>
        <div className="kit-tree__foot-body" id="kit-tree-foot-body" hidden={folded}>
        {ORGANISATION_PLACES.map((place) => {
          const fact = placeFact?.(place.page)
          return (
            <Fragment key={place.page}>
            <button
              type="button" className="kit-tree__place" data-testid={`tree-place-${place.page}`} data-guide={place.guide}
              aria-current={placeShows(place, page) ? 'page' : undefined} title={fact?.words}
              onClick={() => go({ scope: ROOT_SCOPE, page: place.page })}
            >
              <span>{s(place.label)}</span>
              {fact && <span className="kit-tree__holds">{fact.count}</span>}
            </button>
            {place.within && (
              <LinkLine
                className="kit-tree__within" data-testid={`tree-within-${place.page}`}
                links={place.within.map((inside) => ({
                  label: s(inside.label), 'data-testid': `tree-within-${inside.page}${inside.tab ? `-${inside.tab}` : ''}`,
                  current: inside.tab === undefined && inside.page === page,
                  onPress: () => go({ scope: ROOT_SCOPE, page: inside.page, ...(inside.tab ? { tab: inside.tab } : {}) }),
                }))}
              />
            )}
            </Fragment>
          )
        })}
        </div>
      </div>
    </div>
  )
}
