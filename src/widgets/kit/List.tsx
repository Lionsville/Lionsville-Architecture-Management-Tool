// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The one list. A row shows the item and nothing else: one line, or wrapped
 * where the items are sentences. What else is known about it is in the preview
 * a press opens (`Preview`) or a column somebody turned on. It is quiet because
 * a person reads a list down its left edge, and a chip on every row is noise on
 * every row.
 *
 * A grid to assistive technology (a tree grid once it has group heads that fold), with a roving focus: ↑ ↓ Home End walk the
 * rows and the group heads, Enter opens, Space ticks, Shift with an arrow ticks
 * along the way, ⌘A ticks all that is drawn, Esc lets go of the ticks. ← and →
 * fold a group from its head. When the row a preview was open on is let go of,
 * focus lands back on that row; when the row with the focus leaves the list,
 * the one that took its place has it, so fixing a finding does not lose a place.
 *
 * One handler on the grid rather than one per row, and each row memoised: a
 * register of a few hundred must not redraw whole for an arrow key.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, DragEvent, KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { CaretIcon } from '../icons'
import type { ListSort } from './listView'
import './hidden.css'
import './List.css'

/** What a row's rail says: good, bad or neither. */
export type ListTone = 'good' | 'bad' | 'neutral'

/**
 * A thin mark at the row's start, where what kind of item it is is worth seeing
 * down a long list. The colour is never the only cue: `label` names it to a
 * screen reader, and is left out only where the row already says it in words.
 */
export type ListRail = { readonly tone: ListTone; readonly label?: string }

export type ListRow = {
  readonly id: string
  /** The item, in words. Also what a tick is named by and what a clipped line shows on hover. */
  readonly text: string
  /** A key that is part of how the item is known (ADR-0003). Most lists have none. */
  readonly code?: string
  /** A mark where the mark is the point of the list: a finding's weight, say. */
  readonly mark?: ReactNode
  /** One quiet word, only where this row differs from the others: *Left 7 Nov*. */
  readonly note?: string
  /** Not read yet by this person: said in words to a screen reader, and by weight and a dot on screen. */
  readonly unread?: boolean
  /** How far under the row before it, where the items themselves nest. Drawn by indent; a row keeps its place in the order. */
  readonly depth?: number
  /** Values for the columns somebody turned on, by column id. */
  readonly cells?: Readonly<Record<string, ReactNode>>
  /** What can be done from the row, drawn under it while it is the selected one. */
  readonly actions?: ReactNode
  /** What something outside points at this row by: a test id, a `data-` name. */
  readonly attributes?: Readonly<Record<string, string>>
  /** A short fact after the name, in the quiet ink, where the name alone would not say why to press: *56 elements*. */
  readonly fact?: string
  /** A control at the end of the row, always there: its menu, say. Its press is its own and not the row's. */
  readonly end?: ReactNode
  /** How far in, for a row that belongs to the one above it. */
  readonly indent?: number
  /** A row's own stable name, where the rows of a list are different things. Defaults to the list's `rowGuide`. */
  readonly guide?: string
  readonly testId?: string
  /** Words a screen's own stylesheet reads off the row (`data-state`): how it differs, never what it says. */
  readonly state?: string
  /** A thin colour mark at the row's start. Most lists have none. */
  readonly rail?: ListRail
}

export type ListGroup = {
  readonly id: string
  /** No label is no head: a list that is not grouped is one group without one. */
  readonly label: string
  readonly rows: readonly ListRow[]
  /** The real number where the rows drawn are not all of them. Defaults to the rows' count. */
  readonly count?: number
}

export type ListColumn = {
  readonly id: string
  readonly label: string
  readonly sortable?: boolean
  /** A track of the row's grid. Defaults to a share of what is left. */
  readonly width?: string
  /** A stable name for the heading, where the screen's column has one. */
  readonly guide?: string
}

export type ListDensity = 'compact' | 'normal' | 'comfortable'

export type ListProps = {
  /** What the list is, for assistive technology. */
  readonly label: string
  readonly groups: readonly ListGroup[]
  /** The sentences variant: a row wraps, up to the system's clamp. */
  readonly wrap?: boolean
  readonly density?: ListDensity
  /** Off unless somebody asked for them; a list with no columns has no header. */
  readonly columns?: readonly ListColumn[]
  /** The heading over the item, where there are columns. */
  readonly itemLabel?: string
  readonly itemSortable?: boolean
  readonly sort?: ListSort | null
  readonly onSort?: (sort: ListSort) => void
  readonly selectedId?: string | null
  readonly onOpen?: (id: string) => void
  /** Hand both to have ticks. A reader's list hands neither, and has no boxes. */
  readonly checked?: ReadonlySet<string>
  readonly onCheckedChange?: (checked: ReadonlySet<string>) => void
  readonly bulkActions?: ReactNode
  readonly defaultFolded?: readonly string[]
  /** Which groups are folded, where the screen must know: what it draws depends on it. */
  readonly folded?: ReadonlySet<string>
  readonly onFold?: (groupId: string, folded: boolean) => void
  /** A group that is a thing of its own: a press on its head opens it, the caret and the arrows fold it. */
  readonly onOpenGroup?: (groupId: string) => void
  /** Rows may be picked up: dragged, with what the screen writes on the way. */
  readonly onRowDragStart?: (id: string, event: DragEvent<HTMLDivElement>) => void
  /** Drawn in place of the rows when there are none: a `PageState`, or a no-match line. */
  readonly empty?: ReactNode
  /**
   * Every row is a way on, as on a home, and not an item read in a list: it looks
   * like something to press before the pointer gets there.
   */
  readonly doors?: boolean
  /** What stands at the end of the list, and under `empty` too: a `ListMore`, where a filter or a limit keeps rows back. */
  readonly more?: ReactNode
  readonly dataGuide?: string
  readonly rowGuide?: string
}

const headKey = (id: string) => `head:${id}`
const rowKey = (id: string) => `row:${id}`
const idOf = (key: string) => key.slice(key.indexOf(':') + 1)
const isHead = (key: string) => key.startsWith('head:')

type RowViewProps = {
  readonly row: ListRow
  readonly groupId: string
  /** Under a head, where the list is a tree of one level; not said where it is flat. */
  readonly level?: number
  readonly columns?: readonly ListColumn[]
  readonly focusable: boolean
  readonly selected: boolean
  readonly ticks: boolean
  readonly ticked: boolean
  readonly guide?: string
  readonly words: { readonly tick: string; readonly unread: string }
  readonly draggable?: boolean
}

/** The tone a stylesheet colours the rail by, on the row so its states can place the rail. */
const railTone = (rail: ListRail | undefined) => (rail ? { 'data-rail': rail.tone } : {})

/** In the item's cell, where a grid lets it be, and drawn at the row's edge. Named where the row does not say its kind. */
function RailMark({ rail }: { readonly rail: ListRail | undefined }) {
  if (!rail) return null
  return rail.label
    ? <span className="kit-list__rail" role="img" aria-label={rail.label} />
    : <span className="kit-list__rail" aria-hidden="true" />
}

const RowView = memo(function RowView({ row, groupId, level, columns, focusable, selected, ticks, ticked, guide, words, draggable }: RowViewProps) {
  return (
    <div
      role="row"
      className="kit-list__row"
      data-kit-row={rowKey(row.id)}
      data-key={row.id}
      data-group={groupId}
      data-selected={selected || undefined}
      data-unread={row.unread || undefined}
      data-guide={row.guide ?? guide}
      data-testid={row.testId}
      data-state={row.state}
      {...railTone(row.rail)}
      draggable={draggable || undefined}
      aria-selected={selected}
      aria-level={level === undefined && row.depth === undefined ? undefined : (level ?? 1) + (row.depth ?? 0)}
      tabIndex={focusable ? 0 : -1}
      {...row.attributes}
      style={row.depth ? ({ '--kit-list-depth': row.depth } as CSSProperties) : undefined}
    >
      {ticks && (
        <div role="gridcell" className="kit-list__tick">
          <input type="checkbox" tabIndex={-1} checked={ticked} readOnly aria-label={`${words.tick}: ${row.text}`} />
        </div>
      )}
      <div role="gridcell" className="kit-list__item" data-fact={row.fact !== undefined || undefined} style={row.indent ? { paddingInlineStart: `calc(${row.indent} * var(--s-5))` } : undefined}>
        <RailMark rail={row.rail} />
        {row.unread && <span className="kit-list__dot" aria-hidden="true" />}
        {row.mark && <span className="kit-list__mark">{row.mark}</span>}
        {row.code && <span className="kit-list__code">{row.code}</span>}
        <span className="kit-list__text" title={row.text}>
          {row.unread && <span className="kit-hidden">{words.unread}: </span>}
          {row.text}
        </span>
        {row.fact !== undefined && <span className="kit-list__fact" title={row.fact}>{row.fact}</span>}
        {row.note && <span className="kit-list__note">{row.note}</span>}
        {row.end && <span className="kit-list__end" data-kit-actions="">{row.end}</span>}
      </div>
      {columns?.map((column) => (
        <div role="gridcell" className="kit-list__cell" key={column.id}>{row.cells?.[column.id]}</div>
      ))}
      {selected && row.actions && (
        <div role="gridcell" className="kit-list__actions" data-kit-actions="">{row.actions}</div>
      )}
    </div>
  )
})

function HeaderRow({ columns, itemLabel, itemSortable, sort, onSort, ticks, tickLabel }: {
  readonly columns: readonly ListColumn[]
  readonly itemLabel: string | undefined
  readonly itemSortable: boolean | undefined
  readonly sort: ListSort | null | undefined
  readonly onSort: ((sort: ListSort) => void) | undefined
  readonly ticks: boolean
  readonly tickLabel: string
}) {
  const head = (id: string, label: string, sortable: boolean | undefined, guide?: string) => {
    const on = sort?.column === id
    const ariaSort = on ? (sort.descending ? 'descending' : 'ascending') : 'none'
    return (
      <div role="columnheader" className="kit-list__colhead" key={id} aria-sort={sortable ? ariaSort : undefined} data-guide={guide}>
        {sortable && onSort ? (
          <button type="button" className="kit-list__sort" onClick={() => onSort({ column: id, descending: on && !sort.descending })}>
            {label}{on && <span aria-hidden="true"> {sort.descending ? '↓' : '↑'}</span>}
          </button>
        ) : label}
      </div>
    )
  }
  return (
    <div role="row" className="kit-list__row kit-list__row--header">
      {ticks && <div role="columnheader" className="kit-list__tick"><span className="kit-hidden">{tickLabel}</span></div>}
      {head('', itemLabel ?? '', itemSortable)}
      {columns.map((column) => head(column.id, column.label, column.sortable, column.guide))}
    </div>
  )
}

function useFolds(defaultFolded: readonly string[] | undefined, onFold: ListProps['onFold'], told: ListProps['folded']) {
  const [own, setFolded] = useState<ReadonlySet<string>>(() => new Set(defaultFolded))
  const folded = told ?? own
  const fold = useCallback((groupId: string, to: boolean) => {
    setFolded((was) => {
      if (was.has(groupId) === to) return was
      const next = new Set(was)
      if (to) next.add(groupId)
      else next.delete(groupId)
      return next
    })
    onFold?.(groupId, to)
  }, [onFold])
  return [folded, fold] as const
}

/** By walking rather than by a selector, because an id is a screen's and may hold anything. */
function rowElement(root: HTMLElement | null, key: string): HTMLElement | undefined {
  return [...(root?.querySelectorAll<HTMLElement>('[data-kit-row]') ?? [])].find((row) => row.dataset.kitRow === key)
}

/** The roving focus, and where it goes when the row holding it is taken away. */
function useRovingFocus(root: React.RefObject<HTMLDivElement | null>, keys: readonly string[], selectedId: string | null | undefined) {
  const [active, setActive] = useState<string | null>(null)
  const place = useRef(0)
  const current = active !== null && keys.includes(active)
    ? active
    : (selectedId && keys.includes(rowKey(selectedId)) ? rowKey(selectedId) : keys.find((key) => !isHead(key)) ?? keys[0] ?? null)

  const focusKey = useCallback((key: string) => {
    setActive(key)
    rowElement(root.current, key)?.focus()
  }, [root])

  const held = useRef(false)
  useLayoutEffect(() => {
    if (active === null) return
    const index = keys.indexOf(active)
    if (index >= 0) {
      place.current = index
      return
    }
    const next = keys[Math.min(place.current, keys.length - 1)]
    setActive(next ?? null)
    if (next && held.current) focusKey(next)
  }, [keys, active, focusKey])

  const onFocusIn = useCallback((event: { target: EventTarget | null }) => {
    held.current = true
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-kit-row]')
    if (row?.dataset.kitRow) setActive(row.dataset.kitRow)
  }, [])
  const onFocusOut = useCallback(() => { held.current = false }, [])

  return { current, focusKey, onFocusIn, onFocusOut }
}

/** A preview let go of hands the focus back to the row it was last on; a new one shows its row. */
function useFollowSelected(root: React.RefObject<HTMLDivElement | null>, selectedId: string | null | undefined, focusKey: (key: string) => void) {
  const last = useRef(selectedId ?? null)
  useEffect(() => {
    const was = last.current
    last.current = selectedId ?? null
    if (selectedId) {
      rowElement(root.current, rowKey(selectedId))?.scrollIntoView?.({ block: 'nearest' })
    } else if (was) {
      focusKey(rowKey(was))
    }
  }, [root, selectedId, focusKey])
}

/** Ticking one, a range from the last ticked, or a whole group. */
function useTicks(checked: ListProps['checked'], onCheckedChange: ListProps['onCheckedChange'], rowIds: readonly string[]) {
  const anchor = useRef<string | null>(null)
  const change = useCallback((next: ReadonlySet<string>) => onCheckedChange?.(next), [onCheckedChange])

  const toggleRow = useCallback((id: string, range: boolean) => {
    if (!checked) return
    const next = new Set(checked)
    const from = anchor.current === null ? -1 : rowIds.indexOf(anchor.current)
    const to = rowIds.indexOf(id)
    if (range && from >= 0 && to >= 0) {
      for (const one of rowIds.slice(Math.min(from, to), Math.max(from, to) + 1)) next.add(one)
    } else {
      if (next.has(id)) next.delete(id)
      else next.add(id)
      anchor.current = id
    }
    change(next)
  }, [checked, rowIds, change])

  const toggleGroup = useCallback((group: ListGroup) => {
    if (!checked) return
    const ids = group.rows.map((row) => row.id)
    const all = ids.every((id) => checked.has(id))
    const next = new Set(checked)
    for (const id of ids) {
      if (all) next.delete(id)
      else next.add(id)
    }
    change(next)
  }, [checked, change])

  return { anchor, change, toggleRow, toggleGroup }
}

function GroupHead({ group, folded, focusable, selected, ticks, tickedHere, tickWord }: {
  readonly group: ListGroup
  readonly selected: boolean
  readonly folded: boolean
  readonly focusable: boolean
  readonly ticks: boolean
  readonly tickedHere: number
  readonly tickWord: string
}) {
  return (
    <div
      role="row" className="kit-list__head" data-kit-row={headKey(group.id)} data-selected={selected || undefined} aria-level={1} aria-expanded={!folded}
      tabIndex={focusable ? 0 : -1}
    >
      <div role="gridcell" className="kit-list__headCell">
        {ticks && (
          <input
            type="checkbox" tabIndex={-1} readOnly
            checked={group.rows.length > 0 && tickedHere === group.rows.length}
            ref={(box) => { if (box) box.indeterminate = tickedHere > 0 && tickedHere < group.rows.length }}
            aria-label={`${tickWord}: ${group.label}`}
          />
        )}
        <span className="kit-list__caret" data-folded={folded || undefined} aria-hidden="true"><CaretIcon /></span>
        <span>{group.label} · {group.count ?? group.rows.length}</span>
      </div>
    </div>
  )
}

const INTERACTIVE = 'button, a, input, select, textarea, [data-kit-actions]'

export function List({
  label, groups, wrap, density = 'normal', columns, itemLabel, itemSortable, sort, onSort, selectedId, onOpen,
  checked, onCheckedChange, bulkActions, defaultFolded, folded: foldedTold, onFold, onOpenGroup, onRowDragStart, empty, more, doors, dataGuide, rowGuide,
}: ListProps) {
  const { t } = useStrings()
  const root = useRef<HTMLDivElement>(null)
  const [folded, fold] = useFolds(defaultFolded, onFold, foldedTold)
  const ticks = checked !== undefined && onCheckedChange !== undefined
  const hasRows = groups.some((group) => group.rows.length > 0)

  const keys = useMemo(() => groups.flatMap((group) => [
    ...(group.label ? [headKey(group.id)] : []),
    ...(folded.has(group.id) ? [] : group.rows.map((row) => rowKey(row.id))),
  ]), [groups, folded])
  const rowIds = useMemo(() => keys.filter((key) => !isHead(key)).map(idOf), [keys])

  const { current, focusKey, onFocusIn, onFocusOut } = useRovingFocus(root, keys, selectedId)
  useFollowSelected(root, selectedId, focusKey)

  const { anchor, change, toggleRow, toggleGroup } = useTicks(checked, onCheckedChange, rowIds)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const row = event.target as HTMLElement
    const key = row.dataset.kitRow
    if (!key) return
    const index = keys.indexOf(key)
    const head = isHead(key)
    const id = idOf(key)
    const move = (to: number) => {
      const next = keys[Math.max(0, Math.min(keys.length - 1, to))]
      if (next) focusKey(next)
      return next
    }
    const stepTo = (to: number) => {
      const next = move(to)
      if (ticks && event.shiftKey && !head && checked && next && !isHead(next)) {
        anchor.current ??= id
        const ticked = new Set(checked).add(id).add(idOf(next))
        change(ticked)
      }
    }
    const act: Record<string, () => void> = {
      ArrowDown: () => stepTo(index + 1),
      ArrowUp: () => stepTo(index - 1),
      Home: () => move(0),
      End: () => move(keys.length - 1),
      Enter: () => {
        if (!head) onOpen?.(id)
        else if (onOpenGroup) onOpenGroup(id)
        else fold(id, !folded.has(id))
      },
      ' ': () => {
        if (head) fold(id, !folded.has(id))
        else if (ticks) toggleRow(id, event.shiftKey)
        else onOpen?.(id)
      },
      ArrowLeft: () => { if (head) fold(id, true) },
      ArrowRight: () => { if (head) fold(id, false) },
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a' && ticks) {
      event.preventDefault()
      change(new Set(rowIds))
      return
    }
    if (event.key === 'Escape' && ticks && checked && checked.size > 0) {
      event.stopPropagation()
      change(new Set())
      return
    }
    const handler = act[event.key]
    if (handler) {
      event.preventDefault()
      handler()
    }
  }

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const row = target.closest<HTMLElement>('[data-kit-row]')
    const key = row?.dataset.kitRow
    if (!row || !key) return
    const box = target.closest('input[type="checkbox"]')
    if (box) {
      // The box is only a picture of the state, and the focus stays on the row, where the keys are.
      row.focus()
      if (isHead(key)) {
        const group = groups.find((one) => one.id === idOf(key))
        if (group) toggleGroup(group)
      } else toggleRow(idOf(key), event.shiftKey)
      return
    }
    if (target.closest(INTERACTIVE)) return
    if (!isHead(key)) onOpen?.(idOf(key))
    else if (onOpenGroup && !target.closest('.kit-list__caret')) onOpenGroup(idOf(key))
    else fold(idOf(key), !folded.has(idOf(key)))
  }

  const wordsForRow = useMemo(() => ({ tick: t('kit.list.tick'), unread: t('kit.list.unread') }), [t])
  const tracks = useMemo(() => [
    ...(ticks ? ['var(--s-5)'] : []),
    'minmax(0, 1fr)',
    ...(columns ?? []).map((column) => column.width ?? 'minmax(0, 1fr)'),
  ].join(' '), [ticks, columns])

  return (
    <div className="kit-list" data-density={density} data-wrap={wrap || undefined} data-doors={doors || undefined} data-guide={dataGuide} style={{ '--kit-list-cols': tracks } as CSSProperties}>
      {ticks && checked.size > 0 && (
        <div className="kit-list__bulk" role="group" aria-label={t('kit.list.bulk')}>
          <span aria-live="polite">{t('kit.list.ticked', { count: checked.size })}</span>
          <span className="kit-list__bulkActions">{bulkActions}</span>
          <button type="button" className="kit-list__clear" onClick={() => change(new Set())}>{t('kit.list.clearTicks')}</button>
        </div>
      )}
      {!hasRows ? empty : (
        <div
          ref={root} role={groups.some((group) => group.label || group.rows.some((row) => row.depth !== undefined)) ? 'treegrid' : 'grid'} aria-label={label} aria-multiselectable={ticks || undefined}
          className="kit-list__grid" onKeyDown={onKeyDown} onClick={onClick} onFocus={onFocusIn} onBlur={onFocusOut}
          onDragStart={onRowDragStart ? (event) => {
            const key = (event.target as HTMLElement).closest<HTMLElement>('[data-kit-row]')?.dataset.kitRow
            if (key && !isHead(key)) onRowDragStart(idOf(key), event)
          } : undefined}
        >
          {columns && columns.length > 0 && (
            <div role="rowgroup">
              <HeaderRow columns={columns} itemLabel={itemLabel} itemSortable={itemSortable} sort={sort} onSort={onSort} ticks={ticks} tickLabel={t('kit.list.tick')} />
            </div>
          )}
          {groups.map((group) => {
            const isFolded = folded.has(group.id)
            const tickedHere = ticks ? group.rows.filter((row) => checked.has(row.id)).length : 0
            return (
              <div role="rowgroup" key={group.id}>
                {group.label && (
                  <GroupHead
                    group={group} folded={isFolded} focusable={current === headKey(group.id)} selected={selectedId === group.id}
                    ticks={ticks} tickedHere={tickedHere} tickWord={t('kit.list.tickGroup')}
                  />
                )}
                {!isFolded && group.rows.map((row) => (
                  <RowView
                    key={row.id} row={row} groupId={group.id} level={group.label ? 2 : undefined} columns={columns} guide={rowGuide}
                    focusable={current === rowKey(row.id)} selected={selectedId === row.id}
                    ticks={ticks} ticked={ticks && checked.has(row.id)} words={wordsForRow} draggable={onRowDragStart !== undefined}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}
      {more}
    </div>
  )
}
