// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a list is narrowed by, said in words. At rest there is a Find field and
 * a Filter button; a filter that is on is a word on one line with its ×. No row
 * of open filters, no filter as a tab: most people never use most filters, and
 * what is on has to be readable at a glance, because a list that looks whole and
 * is not is a list that lies.
 *
 * Find, Filter, Group and View are one toolbar, so every list has them in the
 * same order; a page offers only what it hands in. The state is the screen's,
 * and it belongs in the address (`listView.ts`).
 */
import { useCallback, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import Popover from '@mui/material/Popover'
import { useStrings } from '../../i18n/LanguageContext'
import { CaretIcon, CloseIcon } from '../icons'
import { Button } from './Button'
import type { ListDensity } from './List'
import './FilterWords.css'

export type FilterOption = {
  readonly value: string
  readonly label: string
  /** The word on the line where the label alone would not say which field it is. */
  readonly word?: string
  /** Only where it is a real number. */
  readonly count?: number
  /** A heading the options fall under, said once where it changes. */
  readonly group?: string
}

export type FilterField = {
  readonly id: string
  readonly label: string
  readonly options: readonly FilterOption[]
  /** A long list keeps a field to type in, so that all of it can stay in the list and none of it is in the way. */
  readonly narrow?: boolean
  readonly guide?: string
}

export type FilterChoice = { readonly id: string; readonly label: string }

/** A filter that is on and is not a value of a list, such as text typed in `filterExtra`: said on the line all the same. */
export type FilterWord = { readonly id: string; readonly word: string; readonly label: string; readonly onRemove: () => void }

export type FilterWordsProps = {
  readonly find: string
  readonly onFind: (find: string) => void
  readonly findLabel?: string
  /** A bar over a short fixed list: no Find, only what else it offers. */
  readonly noFind?: boolean
  readonly fields?: readonly FilterField[]
  readonly filters?: Readonly<Record<string, readonly string[]>>
  readonly onFilters?: (filters: Readonly<Record<string, readonly string[]>>) => void
  /** What else belongs in the Filter panel and is not a list of values: saved filters, say. */
  readonly filterExtra?: ReactNode
  /** What else is on, said on the line with what `fields` says. */
  readonly words?: readonly FilterWord[]
  /** *Clear* lets go of those as well. */
  readonly onClear?: () => void
  readonly filterGuide?: string
  readonly groups?: readonly FilterChoice[]
  readonly group?: string | null
  readonly onGroup?: (group: string | null) => void
  readonly columns?: readonly FilterChoice[]
  readonly shownColumns?: readonly string[]
  readonly onColumns?: (columns: readonly string[]) => void
  readonly density?: ListDensity
  readonly onDensity?: (density: ListDensity) => void
  readonly onReset?: () => void
  /** Said when the list is narrowed: *3 of 44*. */
  readonly shown?: { readonly count: number; readonly total: number }
  /** The page's own action, at the end of the bar. */
  readonly actions?: ReactNode
  readonly dataGuide?: string
}

/** A small panel off a button: the focus goes in, Esc brings it back, and it is drawn over nothing else. */
function Pop({ label, face, active, children, guide }: {
  readonly label: string
  readonly face: ReactNode
  readonly active?: boolean
  readonly children: ReactNode
  readonly guide?: string
}) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLSpanElement>(null)
  // On the panel's arrival, once: its content mounts a render after `open` turns true.
  const inside = useCallback((panel: HTMLDivElement | null) => {
    panel?.querySelector<HTMLElement>('input, button')?.focus()
  }, [])
  return (
    <>
      <span ref={anchor} className="kit-filter__anchor" data-on={active || undefined}>
        <Button variant="plain" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} data-guide={guide}>
          {face}
        </Button>
      </span>
      <Popover
        open={open} anchorEl={anchor.current} onClose={() => setOpen(false)} transitionDuration={0}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { className: 'kit-filter__pop' } }}
      >
        <div ref={inside} role="dialog" aria-label={label}>{children}</div>
      </Popover>
    </>
  )
}

function onOff(list: readonly string[], value: string, on: boolean): readonly string[] {
  return on ? [...list, value] : list.filter((one) => one !== value)
}

function GroupPop({ groups, group, onGroup, name }: {
  readonly groups: readonly FilterChoice[]
  readonly group: string | null | undefined
  readonly onGroup: (group: string | null) => void
  readonly name: string
}) {
  const { t } = useStrings()
  const label = groups.find((one) => one.id === group)?.label ?? t('kit.filter.groupNone')
  return (
    <Pop label={t('kit.filter.group')} face={<>{t('kit.filter.groupOn', { group: label })} <CaretIcon /></>}>
      <fieldset className="kit-filter__field" data-guide={field.guide}>
        <legend>{t('kit.filter.group')}</legend>
        {[{ id: '', label: t('kit.filter.groupNone') }, ...groups].map((one) => (
          <label className="kit-filter__option" key={one.id}>
            <input type="radio" name={name} checked={(group ?? '') === one.id} onChange={() => onGroup(one.id || null)} />
            <span>{one.label}</span>
          </label>
        ))}
      </fieldset>
    </Pop>
  )
}

function ViewPop({ columns, shownColumns, onColumns, density, onDensity, onReset, name }: {
  readonly columns: FilterWordsProps['columns']
  readonly shownColumns: readonly string[]
  readonly onColumns: FilterWordsProps['onColumns']
  readonly density: FilterWordsProps['density']
  readonly onDensity: FilterWordsProps['onDensity']
  readonly onReset: FilterWordsProps['onReset']
  readonly name: string
}) {
  const { t } = useStrings()
  return (
    <Pop label={t('kit.filter.view')} face={<>{t('kit.filter.view')} <CaretIcon /></>}>
      {columns && onColumns && (
        <fieldset className="kit-filter__field">
          <legend>{t('kit.filter.columns')}</legend>
          {columns.map((column) => (
            <label className="kit-filter__option" key={column.id}>
              <input
                type="checkbox" checked={shownColumns.includes(column.id)}
                onChange={(event) => onColumns(onOff(shownColumns, column.id, event.target.checked))}
              />
              <span>{column.label}</span>
            </label>
          ))}
        </fieldset>
      )}
      {onDensity && (
        <fieldset className="kit-filter__field">
          <legend>{t('kit.filter.density')}</legend>
          {(['compact', 'normal', 'comfortable'] as const).map((one) => (
            <label className="kit-filter__option" key={one}>
              <input type="radio" name={name} checked={(density ?? 'normal') === one} onChange={() => onDensity(one)} />
              <span>{t(`kit.filter.density.${one}`)}</span>
            </label>
          ))}
        </fieldset>
      )}
      {onReset && <button type="button" className="kit-filter__link" onClick={onReset}>{t('kit.filter.reset')}</button>}
    </Pop>
  )
}

/** One filter's options, under their headings, narrowed by what was typed where the field asks for that. */
function FieldPart({ field, values, onValues }: {
  readonly field: FilterField
  readonly values: readonly string[]
  readonly onValues: (values: readonly string[]) => void
}) {
  const { t } = useStrings()
  const [typed, setTyped] = useState('')
  const wanted = typed.trim().toLowerCase()
  const options = field.options.filter((option) => !wanted || option.label.toLowerCase().includes(wanted))
  return (
    <fieldset className="kit-filter__field">
      <legend>{field.label}</legend>
      {field.narrow && (
        <input
          type="search" className="kit-filter__narrow" aria-label={t('kit.filter.narrow', { field: field.label })}
          placeholder={t('kit.filter.narrow', { field: field.label })} value={typed} onChange={(event) => setTyped(event.target.value)}
        />
      )}
      {options.map((option, index) => (
        <div key={option.value}>
          {option.group !== undefined && option.group !== options[index - 1]?.group && (
            <div className="kit-filter__optionGroup">{option.group}</div>
          )}
          <label className="kit-filter__option">
            <input
              type="checkbox" checked={values.includes(option.value)}
              onChange={(event) => onValues(onOff(values, option.value, event.target.checked))}
            />
            <span>{option.label}</span>
            {option.count !== undefined && <span className="kit-filter__count">{option.count}</span>}
          </label>
        </div>
      ))}
    </fieldset>
  )
}

export function FilterWords({
  find, onFind, findLabel, noFind, fields = [], filters = {}, onFilters, filterExtra, words = [], onClear, filterGuide, groups, group, onGroup,
  columns, shownColumns = [], onColumns, density, onDensity, onReset, shown, actions, dataGuide,
}: FilterWordsProps) {
  const { t } = useStrings()
  const on = fields.flatMap((field) => (filters[field.id] ?? []).map((value) => {
    const option = field.options.find((one) => one.value === value)
    return { field, value, word: option?.word ?? option?.label ?? value }
  }))
  const setField = (id: string, values: readonly string[]) => {
    const { [id]: _gone, ...rest } = filters
    onFilters?.(values.length ? { ...rest, [id]: values } : rest)
  }
  const label = findLabel ?? t('kit.filter.find')
  const saidOn = on.length + words.length
  const onFindKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && find) {
      event.stopPropagation()
      onFind('')
    }
  }

  return (
    <div className="kit-filter" data-guide={dataGuide}>
      <div className="kit-filter__bar">
        {!noFind && (
          <input
            type="search" className="kit-filter__find" aria-label={label} placeholder={label}
            value={find} onChange={(event) => onFind(event.target.value)} onKeyDown={onFindKey}
          />
        )}
        {(fields.length > 0 || filterExtra) && (
          <Pop label={t('kit.filter.filter')} active={saidOn > 0} guide={filterGuide} face={saidOn ? `${t('kit.filter.filter')} · ${saidOn}` : t('kit.filter.filter')}>
            {fields.map((field) => (
              <FieldPart key={field.id} field={field} values={filters[field.id] ?? []} onValues={(values) => setField(field.id, values)} />
            ))}
            {filterExtra}
          </Pop>
        )}
        {groups && groups.length > 0 && onGroup && <GroupPop groups={groups} group={group} onGroup={onGroup} name={`kit-group-${dataGuide ?? 'list'}`} />}
        {(onColumns || onDensity) && (
          <ViewPop
            columns={columns} shownColumns={shownColumns} onColumns={onColumns} density={density} onDensity={onDensity}
            onReset={onReset} name={`kit-density-${dataGuide ?? 'list'}`}
          />
        )}
        {shown && shown.count !== shown.total && (
          <span className="kit-filter__shown" role="status">{t('kit.filter.shown', { count: shown.count, total: shown.total })}</span>
        )}
        {actions && <span className="kit-filter__actions">{actions}</span>}
      </div>
      {saidOn > 0 && (
        <div className="kit-filter__line">
          <span className="kit-filter__showing">{t('kit.filter.showing')}</span>
          {on.map(({ field, value, word }) => (
            <span className="kit-filter__word" key={`${field.id}:${value}`}>
              {word}
              <button
                type="button" className="kit-filter__remove"
                aria-label={t('kit.filter.remove', { field: field.label, value: word })}
                onClick={() => setField(field.id, (filters[field.id] ?? []).filter((one) => one !== value))}
              >
                <CloseIcon size={12} />
              </button>
            </span>
          ))}
          {words.map((one) => (
            <span className="kit-filter__word" key={one.id}>
              {one.word}
              <button type="button" className="kit-filter__remove" aria-label={t('kit.filter.remove', { field: one.label, value: one.word })} onClick={one.onRemove}>
                <CloseIcon size={12} />
              </button>
            </span>
          ))}
          <button type="button" className="kit-filter__link" onClick={() => { onFilters?.({}); onClear?.() }}>{t('kit.filter.clear')}</button>
        </div>
      )}
    </div>
  )
}
