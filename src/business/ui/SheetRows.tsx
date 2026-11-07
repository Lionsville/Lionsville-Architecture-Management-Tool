// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The areas in the window: a reflowing grid of one-line rows under area
 * headings, downward only. A name wraps and is never cut, since most names in
 * real use are long compounds, and a parent is the same row with a caret and a
 * count rather than a box in a box.
 *
 * What a row says at its end is the lens's: the responsible unit is on the area
 * always, and on a row only under *Who answers* (the owner's decision 8). The
 * layout never moves for a lens.
 *
 * ↑ ↓ walk the rows, ← → fold and unfold, Enter names the row. While a row is
 * being named Enter adds the next one and Tab files it under the one above.
 */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import type { DesignElement, ElementId } from '../../model'
import type { Translate } from '../../i18n'
import { plural } from '../../i18n/strings'
import { CaretIcon } from '../../widgets/icons'
import { Mark } from '../../widgets/kit/Mark'
import { tokenVar } from '../../widgets/kit/tokens'
import type { LensValue, SheetLens } from '../lens'
import type { SheetArea } from '../sheet'
import type { SheetRow } from '../sheetRows'
import { unfoldedRows } from '../sheetRows'
import { UnitLabel } from './Responsible'
import type { Who } from './Responsible'
import { lookOf, valueWord } from './sheetLook'

/** What every row of the page reads. */
export type RowContext = {
  lens: SheetLens | undefined
  valueOf(element: DesignElement): LensValue | undefined
  /** How a name at a row's end reads: a domain's, a retiring application's. */
  named(id: ElementId): string
  who: Who | undefined
  selectedId: ElementId | undefined
  /** A value on the key pressed: the rest go quiet. */
  only: string | undefined
  /** While finding: what is lit. */
  hits: ReadonlySet<ElementId> | undefined
  folded: ReadonlySet<ElementId>
  /** Something covers it, by a system or by people. */
  answers(id: ElementId): boolean
  onFold(id: ElementId): void
  onSelect(id: ElementId): void
  /** The row being named, in place; absent under `readOnly`. */
  naming: { id: ElementId } | undefined
  onNamed(id: ElementId, name: string, then: 'stop' | 'next' | 'under'): void
  onName(id: ElementId): void
  /** Add under this row. Absent under `readOnly`, so a reader is offered nothing. */
  onAddUnder?(parent: DesignElement): void
  t: Translate
}

/** How much of a list of functions is answered, in the coverage's own words: the count on a heading and its meter. */
export type Answered = { answered: number; total: number; parts: readonly { value: string; count: number }[] }

export function CoverageMeter({ answered, label }: { answered: Answered; label: string }) {
  if (answered.total === 0) return null
  return (
    <span className="sheet-meter" role="img" aria-label={label}>
      {answered.parts.map((part) => (
        <span
          key={part.value}
          style={{
            width: `${(part.count / answered.total) * 100}%`,
            background: tokenVar(lookOf('coveredBy', { value: part.value }).colour ?? 'line-strong'),
          }}
        />
      ))}
    </span>
  )
}

/** A row's own end: a number, a name, a unit. Nothing is written twice on a row that says it by its mark. */
function RowEnd({ element, value, context }: { element: DesignElement; value: LensValue | undefined; context: RowContext }) {
  const { lens, t, who } = context
  if (!value || !lens) return null
  if (lens === 'who' && value.value === 'held') {
    const others = who?.of(element.id) ?? []
    return (
      <span className="sheet-row__end">
        <UnitLabel who={who} functionId={element.id} t={t} />
        {others.length > 0 && ` ${others.map((one) => one.name).join(', ')}`}
      </span>
    )
  }
  if (value.names && (lens === 'domains' || lens === 'retiring')) {
    return <span className="sheet-row__end" title={value.names.map(context.named).join(', ')}>{value.names.map(context.named).join(', ')}</span>
  }
  if (lens === 'coveredBy' && value.value !== 'moving') return null
  return value.said ? <span className="sheet-row__end">{value.said}</span> : null
}

function RowMark({ lens, value, t }: { lens: SheetLens | undefined; value: LensValue | undefined; t: Translate }) {
  if (!lens || !value) return null
  const look = lookOf(lens, value)
  const word = valueWord(lens, value.value, t)
  if (look.mark) return <span className="sheet-row__mark"><Mark kind={look.mark} label={word} /></span>
  if (look.colour && !look.hollow) return <span className="sheet-row__mark"><span className="sheet-row__dot" style={{ background: tokenVar(look.colour) }} role="img" aria-label={word} /></span>
  return null
}

/** The name in place: Enter and Tab answer here so the next row is one key away. */
function NameField({ element, label, onNamed }: { element: DesignElement; label: string; onNamed: RowContext['onNamed'] }) {
  const [typed, setTyped] = useState(element.name)
  const field = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  useEffect(() => { field.current?.focus(); field.current?.select() }, [])
  const finish = (then: 'stop' | 'next' | 'under') => {
    if (done.current) return
    done.current = true
    onNamed(element.id, typed.trim() || element.name, then)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation()
    if (event.key === 'Enter') { event.preventDefault(); finish('next') }
    if (event.key === 'Tab' && !event.shiftKey) { event.preventDefault(); finish('under') }
    if (event.key === 'Escape') { event.preventDefault(); done.current = true; onNamed(element.id, element.name, 'stop') }
  }
  return (
    <input
      ref={field} className="sheet-row__name" aria-label={label} value={typed}
      onChange={(event) => setTyped(event.target.value)} onKeyDown={onKeyDown} onBlur={() => finish('stop')}
    />
  )
}

function Row({ row, count, context }: { row: SheetRow; count?: string; context: RowContext }) {
  const { element } = row
  const { t, onSelect, onFold } = context
  const value = context.valueOf(element)
  const selected = context.selectedId === element.id
  const heat = value?.heat
  const style = {
    '--sheet-depth': row.depth,
    ...(heat !== undefined ? { '--sheet-heat': `var(--heat-${heat})`, '--sheet-on-heat': `var(--on-heat-${heat})` } : {}),
  } as CSSProperties
  const test = row.parent && row.depth === 0 ? `sheet-grouping-${element.id}` : `sheet-capability-${element.id}`
  const dim = context.only !== undefined && value?.value !== context.only
  const folded = context.folded.has(element.id)
  return (
    <div
      className="sheet-row" style={style} data-parent={row.parent || undefined} data-heat={heat}
      data-selected={selected || undefined} data-dim={dim || undefined} data-hit={context.hits?.has(element.id) || undefined}
    >
      {row.parent
        ? (
          <button
            type="button" className="sheet-row__caret" tabIndex={-1} aria-expanded={!folded}
            aria-label={t(folded ? 'sheet.unfold' : 'sheet.fold', { name: element.name })} data-sheet-add
            onClick={() => onFold(element.id)}
          >
            <CaretIcon />
          </button>
        )
        : <span className="sheet-row__pad" />}
      {context.naming?.id === element.id
        ? <NameField element={element} label={t('common.name')} onNamed={context.onNamed} />
        : (
          <button
            type="button" className="sheet-row__main" data-testid={test} data-element-id={element.id} data-sheet-row
            aria-expanded={row.parent ? !folded : undefined} aria-current={selected || undefined}
            onClick={() => onSelect(element.id)}
          >
            <RowMark lens={context.lens} value={value} t={t} />
            <span>
              {element.name}
              {context.lens === 'coveredBy' && value && (
                <span className="kit-hidden" data-testid={`sheet-coverage-${element.id}`}>{valueWord('coveredBy', value.value, t)}</span>
              )}
            </span>
          </button>
        )}
      {count !== undefined && <span className="sheet-row__end">{count}</span>}
      <RowEnd element={element} value={value} context={context} />
      {context.onAddUnder && (
        <button
          type="button" className="sheet-row__add" data-sheet-add aria-label={t('sheet.addCapabilityTo', { name: element.name })}
          onClick={() => context.onAddUnder?.(element)}
        >+</button>
      )}
    </div>
  )
}

/** One area: its heading, what answers for it, and its rows. */
export function AreaBlock({ area, rows, answered, context, width, problem, standIn, children, position }: {
  area: SheetArea
  rows: readonly SheetRow[]
  answered: Answered
  context: RowContext
  /** Where a picture places it: the screen flows, and paper packs. */
  position?: CSSProperties
  width?: number
  /** A path no scope has: said here as well as in the panel. */
  problem?: string
  /** Taken up from above, and where it sits there. */
  standIn?: string
  children?: ReactNode
}) {
  const { t, onSelect } = context
  const { element } = area
  const selected = context.selectedId === element.id
  const shown = unfoldedRows(rows, context.folded)
  const meter = t('sheet.meter', { answered: answered.answered, total: answered.total })
  return (
    <section
      className="sheet-area" data-testid={`sheet-area-${element.id}`} aria-label={element.name}
      data-selected={selected || undefined} data-standin={standIn !== undefined || undefined} data-span={width} style={position}
    >
      <div className="sheet-area__head">
        {context.naming?.id === element.id
          ? <NameField element={element} label={t('common.name')} onNamed={context.onNamed} />
          : (
            <button type="button" className="sheet-area__headMain" data-element-id={element.id} data-sheet-row aria-current={selected || undefined} onClick={() => onSelect(element.id)}>
              {element.name}
            </button>
          )}
        <span className="sheet-area__count" title={meter}>{answered.answered}/{answered.total}</span>
        <CoverageMeter answered={answered} label={meter} />
        {context.onAddUnder && (
          <button
            type="button" className="sheet-row__add" data-sheet-add aria-label={t('sheet.addCapabilityTo', { name: element.name })}
            onClick={() => context.onAddUnder?.(element)}
          >+</button>
        )}
      </div>
      {context.who && context.who.units(element.id).length > 0 && (
        <div className="sheet-area__note"><UnitLabel who={context.who} functionId={element.id} t={t} /></div>
      )}
      {standIn !== undefined && <div className="sheet-area__note">{standIn}</div>}
      {problem !== undefined && <div className="sheet-area__problem"><Mark kind="review" />{problem}</div>}
      {shown.map((row) => (
        <Row
          key={row.element.id} row={row} context={context}
          {...(row.parent ? { count: `${row.leaves.filter((id) => context.answers(id)).length}/${row.leaves.length}` } : {})}
        />
      ))}
      {children}
    </section>
  )
}

/** The walk of the keyboard over whatever rows are drawn. */
export function onRowKeys(event: KeyboardEvent<HTMLElement>, context: Pick<RowContext, 'onFold' | 'folded' | 'onName'>): void {
  const here = (event.target as HTMLElement).closest<HTMLElement>('[data-sheet-row]')
  if (!here) return
  const id = here.dataset.elementId
  const rows = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-sheet-row]')]
  const at = rows.indexOf(here)
  const go = (to: number) => { event.preventDefault(); rows[to]?.focus() }
  switch (event.key) {
    case 'ArrowDown': go(at + 1); break
    case 'ArrowUp': go(at - 1); break
    case 'Home': go(0); break
    case 'End': go(rows.length - 1); break
    case 'ArrowLeft':
      if (id !== undefined && here.getAttribute('aria-expanded') === 'true') { event.preventDefault(); context.onFold(id) }
      break
    case 'ArrowRight':
      if (id !== undefined && here.getAttribute('aria-expanded') === 'false') { event.preventDefault(); context.onFold(id) }
      break
    case 'F2':
      if (id !== undefined) { event.preventDefault(); context.onName(id) }
      break
    default:
  }
}

/** Overview: every area, one square per capability, drawn by the lens. A press opens Names at that area. */
export function OverviewTile({ area, leaves, answered, valueOf, lens, onOpen, items, t }: {
  area: SheetArea
  leaves: readonly DesignElement[]
  answered: Answered
  valueOf(element: DesignElement): LensValue | undefined
  lens: SheetLens | undefined
  onOpen(id: ElementId): void
  /** How many rows it holds, parents among them. */
  items: number
  t: Translate
}) {
  const meter = t('sheet.meter', { answered: answered.answered, total: answered.total })
  return (
    <button type="button" className="sheet-tile" data-testid={`sheet-tile-${area.element.id}`} data-element-id={area.element.id} onClick={() => onOpen(area.element.id)}>
      <span className="sheet-tile__name">{area.element.name}</span>
      <span className="sheet-tile__squares" aria-hidden="true">
        {leaves.map((leaf) => {
          const value = valueOf(leaf)
          const look = lens && value ? lookOf(lens, value) : {}
          return (
            <span
              key={leaf.id} className="sheet-tile__square" data-hollow={look.hollow || undefined} title={leaf.name}
              style={look.colour ? { '--sheet-square': tokenVar(look.colour) } as CSSProperties : undefined}
            />
          )
        })}
      </span>
      <span className="sheet-tile__foot">
        <span>{answered.answered}/{answered.total}</span>
        <CoverageMeter answered={answered} label={meter} />
        <span className="sheet-tile__items">{plural(t, { one: 'sheet.itemsOne', other: 'sheet.itemsOther' }, items)}</span>
      </span>
    </button>
  )
}
