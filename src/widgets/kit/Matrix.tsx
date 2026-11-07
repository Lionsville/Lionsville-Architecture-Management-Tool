// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A crossing of two lists: a RACI, a coverage, a pair grid, ratings. The headings
 * stay fixed while the crossing scrolls, because a cell means nothing without its
 * row and its column; the crosshair and the line under the grid say which, in words.
 *
 * A press selects and only selects: reading a row must not write a letter. A key
 * writes, and only where the screen says keys write (`keys`, handed in; a reader's
 * matrix has none). So ← ↑ → ↓ Home End walk, with one focus to tab to, and the
 * headings are stops on the walk: Enter or Space on a heading folds what it heads.
 *
 * The rows are memoised and the column's crosshair is a `<col>`'s background, so a
 * step of the arrow redraws two rows of a grid that may have thousands of cells.
 */
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { CaretIcon } from '../icons'
import { Mark } from './Mark'
import './Matrix.css'

export type MatrixColumn = {
  readonly id: string
  readonly label: string
  /** The group this column folds away under, by `MatrixColumnGroup.id`. */
  readonly group?: string
  /** A state of what the heading names, beside its name: a mark, *you*. */
  readonly mark?: ReactNode
  /** A second line under the heading: who holds it, say. */
  readonly under?: ReactNode
}

export type MatrixColumnGroup = {
  readonly id: string
  readonly label: string
  /** What the folded column says in place of *label (count)*: *+9*. */
  readonly short?: string
}

export type MatrixRowDef = {
  readonly id: string
  readonly label: string
  /** Under which row this one folds away. */
  readonly parent?: string
  /** A state of what the heading names, beside its name: a mark, *you*. */
  readonly mark?: ReactNode
  /** A heading over the rows under it, drawn as one: nothing in it is a cell to read. */
  readonly heading?: boolean
}

export type MatrixTone = 'plain' | 'soft' | 'solid'

export type MatrixCell = {
  /** What the cell shows: a letter, a mark. An empty cell is empty; the empty cell says nothing. */
  readonly show?: ReactNode
  /** What it means, in words: read out, and said on the line under the grid. */
  readonly meaning: string
  readonly tone?: MatrixTone
  /** Asks for attention: fill, border and a triangle, so it is never hue alone. */
  readonly attention?: boolean
}

export type MatrixPick = { readonly row: string; readonly column: string }

export type MatrixProps = {
  readonly label: string
  /** The heading over the rows' own column. */
  readonly rowHeading?: string
  readonly rows: readonly MatrixRowDef[]
  readonly columns: readonly MatrixColumn[]
  readonly columnGroups?: readonly MatrixColumnGroup[]
  readonly cellOf: (row: string, column: string) => MatrixCell | null
  /** The answer pinned beside the row's name: what the row comes to. */
  readonly answer?: { readonly label: string; readonly of: (row: string) => ReactNode }
  /** More than one answer pinned, in this order, where the row comes to several things. */
  readonly answers?: readonly { readonly label: string; readonly of: (row: string) => ReactNode }[]
  readonly selected?: MatrixPick | null
  readonly onSelect?: (pick: MatrixPick) => void
  /** The keys that write here, lower case, ' ' for Space. None is a matrix that only reads. */
  readonly keys?: readonly string[]
  readonly onKey?: (pick: MatrixPick, key: string) => void
  /** What keys may be pressed, added to the line: *Press R, A, C, I or Space.* */
  readonly hint?: string
  readonly defaultFoldedRows?: readonly string[]
  readonly defaultFoldedGroups?: readonly string[]
  readonly onFoldRow?: (row: string, folded: boolean) => void
  readonly onFoldGroup?: (group: string, folded: boolean) => void
  /** Pressing a heading's name opens what it names, where it goes anywhere. */
  readonly onOpenRow?: (row: string) => void
  readonly onOpenColumn?: (column: string) => void
  /** A crossing that is not there, such as a triangle's other half: drawn as nothing, and pressing it does nothing. */
  readonly absent?: (row: string, column: string) => boolean
  /** The column lit from outside the grid, while what it names is open elsewhere. */
  readonly litColumn?: string
  /** Long names wrap to two lines rather than stopping at the edge. */
  readonly wrapRows?: boolean
  /** A row that folds opens on its name too, and folds on its caret: for rows that are records themselves. */
  readonly openFoldable?: boolean
  /** A band over the columns naming each group, which folds it. */
  readonly groupBand?: boolean
  readonly rotateHeads?: boolean
  readonly dataGuide?: string
}

type Drawn =
  | { readonly kind: 'column'; readonly id: string; readonly label: string; readonly mark?: ReactNode; readonly under?: ReactNode }
  | { readonly kind: 'folded'; readonly id: string; readonly label: string; readonly hides: number; readonly short?: string }

/** What is drawn of the columns: a folded group is one narrow column that says how many it holds. */
function drawnColumns(columns: readonly MatrixColumn[], groups: readonly MatrixColumnGroup[] | undefined, folded: ReadonlySet<string>): readonly Drawn[] {
  const drawn: Drawn[] = []
  const met = new Set<string>()
  for (const column of columns) {
    if (column.group && folded.has(column.group)) {
      if (met.has(column.group)) continue
      met.add(column.group)
      const group = groups?.find((one) => one.id === column.group)
      drawn.push({
        kind: 'folded', id: column.group, label: group?.label ?? column.group,
        hides: columns.filter((one) => one.group === column.group).length,
        ...(group?.short !== undefined ? { short: group.short } : {}),
      })
    } else drawn.push({ kind: 'column', id: column.id, label: column.label, ...(column.mark !== undefined ? { mark: column.mark } : {}), ...(column.under !== undefined ? { under: column.under } : {}) })
  }
  return drawn
}

/** The rows in order with the ones under a folded row taken out, each with how deep it sits. */
function drawnRows(rows: readonly MatrixRowDef[], folded: ReadonlySet<string>) {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const parents = new Set(rows.flatMap((row) => (row.parent ? [row.parent] : [])))
  const walk = (row: MatrixRowDef) => {
    let depth = 0
    let hidden = false
    let at = row.parent ? byId.get(row.parent) : undefined
    while (at) {
      depth += 1
      if (folded.has(at.id)) hidden = true
      at = at.parent ? byId.get(at.parent) : undefined
    }
    return { depth, hidden }
  }
  return rows.flatMap((row) => {
    const { depth, hidden } = walk(row)
    return hidden ? [] : [{ row, depth, foldable: parents.has(row.id), folded: folded.has(row.id) }]
  })
}

type CellProps = Pick<MatrixProps, 'cellOf' | 'absent'> & {
  readonly row: MatrixRowDef
  readonly depth: number
  readonly foldable: boolean
  readonly folded: boolean
  readonly columns: readonly Drawn[]
  readonly rowIndex: number
  readonly answers: NonNullable<MatrixProps['answers']>
  /** Which column holds the focus or the pick, where this row does: all a row needs of them. */
  readonly focusColumn: number | null
  readonly selectedColumn: string | null
  readonly crossed: boolean
  readonly foldWord: string
  readonly emptyWord: string
}

const MatrixRowView = memo(function MatrixRowView({
  row, depth, foldable, folded, columns, rowIndex, answers, cellOf, absent, focusColumn, selectedColumn, crossed, foldWord, emptyWord,
}: CellProps) {
  return (
    <tr data-crossed={crossed || undefined} data-heading={row.heading || undefined} data-picked={selectedColumn !== null || undefined}>
      <th
        scope="row" className="kit-matrix__rowHead" data-kit-cell={`${rowIndex}:-1`} tabIndex={focusColumn === -1 ? 0 : -1}
        aria-expanded={foldable ? !folded : undefined} style={{ '--kit-matrix-depth': depth } as CSSProperties}
        aria-label={foldable ? `${row.label}, ${foldWord}` : undefined}
      >
        {foldable && <span className="kit-matrix__caret" data-folded={folded || undefined} aria-hidden="true"><CaretIcon /></span>}
        <span className="kit-matrix__rowName" title={row.label}>{row.label}</span>
        {row.mark !== undefined && <span className="kit-matrix__headMark">{row.mark}</span>}
      </th>
      {answers.map((answer, index) => <td key={answer.label} role="gridcell" className="kit-matrix__answer" style={{ '--kit-matrix-answer-at': index } as CSSProperties}>{answer.of(row.id)}</td>)}
      {columns.map((column, index) => {
        if (column.kind === 'folded') return <td key={column.id} role="gridcell" className="kit-matrix__cell" data-folded="" data-kit-cell={`${rowIndex}:${index}`} tabIndex={focusColumn === index ? 0 : -1} aria-label={`${row.label}, ${column.label}`} />
        if (absent?.(row.id, column.id)) return <td key={column.id} role="gridcell" className="kit-matrix__cell" data-absent="" data-kit-cell={`${rowIndex}:${index}`} tabIndex={focusColumn === index ? 0 : -1} aria-label={`${row.label}, ${column.label}`} />
        const cell = cellOf(row.id, column.id)
        return (
          <td
            key={column.id} role="gridcell" className="kit-matrix__cell" data-kit-cell={`${rowIndex}:${index}`}
            data-tone={cell?.tone} data-attention={cell?.attention || undefined}
            aria-selected={selectedColumn === column.id}
            aria-label={`${row.label}, ${column.label}: ${cell?.meaning ?? emptyWord}`}
            tabIndex={focusColumn === index ? 0 : -1}
          >
            {cell?.attention && <span className="kit-matrix__triangle"><Mark kind="review" /></span>}
            {cell?.show}
          </td>
        )
      })}
    </tr>
  )
})

function GroupBand({ answers, drawn, columns, groups }: {
  readonly answers: number
  readonly drawn: readonly Drawn[]
  readonly columns: readonly MatrixColumn[]
  readonly groups: readonly MatrixColumnGroup[]
}) {
  const spans: { id: string; label: string; span: number }[] = []
  for (const one of drawn) {
    const group = one.kind === 'folded' ? one.id : columns.find((column) => column.id === one.id)?.group
    const last = spans[spans.length - 1]
    if (group !== undefined && last?.id === group) last.span += 1
    else spans.push({ id: group ?? one.id, label: groups.find((held) => held.id === group)?.label ?? '', span: 1 })
  }
  return (
    <tr className="kit-matrix__band">
      <th scope="col" className="kit-matrix__corner" colSpan={answers + 1} />
      {spans.map((one) => <th scope="colgroup" key={one.id} colSpan={one.span} className="kit-matrix__groupHead" data-kit-group={one.id}>{one.label}</th>)}
    </tr>
  )
}

function MatrixHead({ rowHeading, answerLabels, drawn, columns, row, column, opens, lit, band }: {
  readonly rowHeading: string | undefined
  readonly answerLabels: readonly string[]
  readonly band?: ReactNode
  readonly drawn: readonly Drawn[]
  readonly columns: readonly MatrixColumn[]
  readonly row: number
  readonly column: number
  readonly opens: boolean
  readonly lit: string | undefined
}) {
  const { t } = useStrings()
  return (
    <thead>
      {band}
      <tr>
        <th scope="col" className="kit-matrix__corner">{rowHeading}</th>
        {answerLabels.map((label, index) => <th scope="col" key={label} className="kit-matrix__answer kit-matrix__answerHead" style={{ '--kit-matrix-answer-at': index } as CSSProperties}>{label}</th>)}
        {drawn.map((one, index) => {
          const foldable = one.kind === 'folded' || columns.some((c) => c.id === one.id && c.group)
          return (
            <th
              scope="col" key={one.id} className="kit-matrix__colHead" data-folded={one.kind === 'folded' || undefined}
              data-kit-cell={`-1:${index}`} tabIndex={row === -1 && column === index ? 0 : -1}
              aria-expanded={foldable ? one.kind !== 'folded' : undefined}
              data-crossed={index === column || lit === one.id || undefined}
              data-opens={(opens && one.kind === 'column') || undefined}
            >
              <span className="kit-matrix__colName" title={one.kind === 'folded' ? `${one.label} (${one.hides})` : one.label}>
                {one.kind === 'folded' ? one.short ?? t('kit.matrix.foldedColumn', { group: one.label, count: one.hides }) : one.label}
              </span>
              {one.kind === 'column' && one.mark !== undefined && <span className="kit-matrix__headMark">{one.mark}</span>}
              {one.kind === 'column' && one.under !== undefined && <span className="kit-matrix__colUnder">{one.under}</span>}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}

function useFolded(initial: readonly string[] | undefined, told: ((id: string, folded: boolean) => void) | undefined) {
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set(initial))
  const toggle = useCallback((id: string) => {
    const to = !folded.has(id)
    const next = new Set(folded)
    if (to) next.add(id)
    else next.delete(id)
    setFolded(next)
    told?.(id, to)
  }, [folded, told])
  return [folded, toggle] as const
}

export function Matrix({
  label, rowHeading, rows, columns, columnGroups, cellOf, answer, answers: moreAnswers, selected, onSelect, keys, onKey, hint,
  defaultFoldedRows, defaultFoldedGroups, onFoldRow, onFoldGroup, onOpenRow, openFoldable, onOpenColumn, absent, litColumn, wrapRows, groupBand, rotateHeads, dataGuide,
}: MatrixProps) {
  const answers = useMemo(() => [...(answer ? [answer] : []), ...(moreAnswers ?? [])], [answer, moreAnswers])
  const { t } = useStrings()
  const table = useRef<HTMLTableElement>(null)
  const [foldedRows, toggleRow] = useFolded(defaultFoldedRows, onFoldRow)
  const [foldedGroups, toggleGroup] = useFolded(defaultFoldedGroups, onFoldGroup)
  const drawn = useMemo(() => drawnColumns(columns, columnGroups, foldedGroups), [columns, columnGroups, foldedGroups])
  const shownRows = useMemo(() => drawnRows(rows, foldedRows), [rows, foldedRows])
  // The walk runs from the headings (-1) to the last row and column.
  const [at, setAt] = useState({ row: 0, column: 0 })
  const row = Math.min(at.row, shownRows.length - 1)
  const column = Math.min(at.column, drawn.length - 1)
  const wantFocus = useRef(false)

  useLayoutEffect(() => {
    if (!wantFocus.current) return
    wantFocus.current = false
    table.current?.querySelector<HTMLElement>(`[data-kit-cell="${row}:${column}"]`)?.focus()
  }, [row, column])

  // A pick from outside, or the rows moving under one: the crosshair and the line stay on what is picked.
  const pickedRow = selected ? shownRows.findIndex((one) => one.row.id === selected.row) : -1
  const pickedColumn = selected ? drawn.findIndex((one) => one.id === selected.column) : -1
  useLayoutEffect(() => {
    if (pickedRow >= 0 && pickedColumn >= 0) setAt({ row: pickedRow, column: pickedColumn })
  }, [pickedRow, pickedColumn])

  const hereRow = shownRows[row]?.row
  const hereColumn = drawn[column]
  const here = hereRow && hereColumn?.kind === 'column' ? { row: hereRow.id, column: hereColumn.id } : null
  const hereCell = here ? cellOf(here.row, here.column) : null

  const go = (nextRow: number, nextColumn: number) => {
    wantFocus.current = true
    setAt({
      row: Math.max(-1, Math.min(shownRows.length - 1, nextRow)),
      column: Math.max(-1, Math.min(drawn.length - 1, nextColumn)),
    })
  }

  const foldHere = () => {
    if (row === -1) {
      const head = drawn[column]
      if (head?.kind === 'folded') toggleGroup(head.id)
      else if (head && onOpenColumn) onOpenColumn(head.id)
      else if (head) {
        const group = columns.find((one) => one.id === head.id)?.group
        if (group) toggleGroup(group)
        else onOpenColumn?.(head.id)
      }
      return true
    }
    if (column === -1 && hereRow) {
      if (shownRows[row]?.foldable) toggleRow(hereRow.id)
      else onOpenRow?.(hereRow.id)
      return true
    }
    return false
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const walk: Record<string, () => void> = {
      ArrowDown: () => go(row + 1, column),
      ArrowUp: () => go(row - 1, column),
      ArrowRight: () => go(row, column + 1),
      ArrowLeft: () => go(row, column - 1),
      Home: () => go(event.metaKey || event.ctrlKey ? 0 : row, 0),
      End: () => go(event.metaKey || event.ctrlKey ? shownRows.length - 1 : row, drawn.length - 1),
    }
    const step = walk[event.key]
    if (step) {
      event.preventDefault()
      step()
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      if (foldHere()) {
        event.preventDefault()
        return
      }
    }
    if (event.key === 'Enter' && here) {
      event.preventDefault()
      if (!absent?.(here.row, here.column)) onSelect?.(here)
      return
    }
    const letter = event.key.toLowerCase()
    if (here && keys?.includes(letter) && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault()
      onKey?.(here, letter)
    }
  }

  const onClick = (event: MouseEvent<HTMLTableElement>) => {
    const target = event.target as HTMLElement
    const band = target.closest<HTMLElement>('[data-kit-group]')?.dataset.kitGroup
    if (band !== undefined) {
      if (columnGroups?.some((group) => group.id === band)) toggleGroup(band)
      return
    }
    const cell = target.closest<HTMLElement>('[data-kit-cell]')
    const address = cell?.dataset.kitCell?.split(':').map(Number)
    if (!address) return
    const [pressedRow = 0, pressedColumn = 0] = address
    wantFocus.current = true
    setAt({ row: pressedRow, column: pressedColumn })
    const rowDef = shownRows[pressedRow]
    const columnDef = drawn[pressedColumn]
    if (pressedRow === -1) {
      if (columnDef?.kind === 'column' && onOpenColumn) {
        onOpenColumn(columnDef.id)
        return
      }
      const group = columnDef?.kind === 'folded' ? columnDef.id : columns.find((one) => one.id === columnDef?.id)?.group
      if (group) toggleGroup(group)
    } else if (pressedColumn === -1 && rowDef) {
      const onCaret = target.closest('.kit-matrix__caret') !== null
      if (rowDef.foldable && (onCaret || !openFoldable)) toggleRow(rowDef.row.id)
      else onOpenRow?.(rowDef.row.id)
    } else if (rowDef && columnDef?.kind === 'column') {
      if (!absent?.(rowDef.row.id, columnDef.id)) onSelect?.({ row: rowDef.row.id, column: columnDef.id })
    }
  }

  const onFocus = (event: { target: EventTarget | null }) => {
    const address = (event.target as HTMLElement).dataset?.kitCell?.split(':').map(Number)
    if (address) setAt({ row: address[0] ?? 0, column: address[1] ?? 0 })
  }

  const line = hereRow
    ? [
        here && !absent?.(here.row, here.column) ? `${hereRow.label} × ${hereColumn?.label}: ${hereCell?.meaning ?? t('kit.matrix.empty')}.` : hereRow.label,
        here && keys?.length ? hint : undefined,
      ].filter(Boolean).join(' ')
    : ''

  return (
    <div className="kit-matrix" data-rotate={rotateHeads || undefined} data-wrap={wrapRows || undefined} data-band={(groupBand && columnGroups) ? '' : undefined} data-guide={dataGuide}>
      <div className="kit-matrix__scroll">
        <table ref={table} role="grid" aria-label={label} className="kit-matrix__table" onKeyDown={onKeyDown} onClick={onClick} onFocus={onFocus}>
          <colgroup>
            <col />
            {answers.map((one) => <col key={one.label} />)}
            {drawn.map((one, index) => <col key={one.id} data-crossed={index === column || litColumn === one.id || undefined} />)}
          </colgroup>
          <MatrixHead
            rowHeading={rowHeading} answerLabels={answers.map((one) => one.label)} drawn={drawn} columns={columns} row={row} column={column}
            opens={onOpenColumn !== undefined} lit={litColumn}
            band={groupBand && columnGroups ? <GroupBand answers={answers.length} drawn={drawn} columns={columns} groups={columnGroups} /> : undefined}
          />
          <tbody>
            {shownRows.map(({ row: rowDef, depth, foldable, folded }, index) => (
              <MatrixRowView
                key={rowDef.id} row={rowDef} depth={depth} foldable={foldable} folded={folded} columns={drawn} rowIndex={index}
                answers={answers} cellOf={cellOf} absent={absent} focusColumn={row === index ? column : null}
                selectedColumn={selected?.row === rowDef.id ? selected.column : null} crossed={row === index}
                foldWord={t('kit.matrix.foldable')} emptyWord={t('kit.matrix.empty')}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="kit-matrix__line" role="status">{line}</div>
    </div>
  )
}
