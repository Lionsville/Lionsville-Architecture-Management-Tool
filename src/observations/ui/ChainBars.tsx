// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What stands over the chain's lists and maps: every filter of the page in the kit's
 * one bar, with what is on said in words on it, and a scope with nothing yet, where
 * there is a chain to explain and nothing to filter.
 *
 * Presentational: what the controls mean is `usePictureFilters`, which the page hands
 * in whole.
 */
import type { ReactNode } from 'react'
import type { Translate } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import { TextField } from '../../widgets/kit/Field'
import { FilterWords } from '../../widgets/kit/FilterWords'
import type { FilterField, FilterWord } from '../../widgets/kit/FilterWords'
import { OBSERVATION_TONES } from '../observation'
import type { ObservationTone } from '../observation'
import { TONE_WORD } from '../observationScope'
import type { Filters } from '../filter'
import { SavedPopover, ScopesPopover } from './FilterPopovers'
import type { ScopeOption } from './FilterPopovers'
import type { PictureFilters } from './usePictureFilters'

/** What is said beside *Mine*, by what `recordedBy.ts` says the case is. */
const MINE_SAYS = {
  nobody: 'observation.mineNobody',
  counts: 'observation.mineCounts',
  noEntry: 'observation.mineNoEntry',
} as const

const TEXT_FILTERS = [
  { field: 'observations', label: 'observation.filterObsField', example: 'observation.filterObsExample', word: 'observation.filterObs' },
  { field: 'causes', label: 'observation.filterCauseField', example: 'observation.filterCauseExample', word: 'observation.filterCause' },
  { field: 'roots', label: 'observation.filterRootField', example: 'observation.filterRootExample', word: 'observation.filterRoot' },
] as const

export type ChainFilterProps = {
  f: PictureFilters
  scopeLabel: (path: string) => string
  showMerged: boolean
  onShowMerged: (show: boolean) => void
  showArchived: boolean
  onShowArchived: (show: boolean) => void
  /** Columns are the Seen list's. */
  columns?: { readonly choices: readonly { id: string; label: string }[]; readonly shown: readonly string[]; readonly onChange: (next: readonly string[]) => void }
  actions?: ReactNode
  s: Translate
}

export function ChainFilter({ f, scopeLabel, showMerged, onShowMerged, showArchived, onShowArchived, columns, actions, s }: ChainFilterProps) {
  const set = (patch: Partial<Filters>) => f.setFilters({ ...f.filters, ...patch })
  const fields: FilterField[] = [
    { id: 'tone', label: s('observation.toneLabel'), options: OBSERVATION_TONES.map((one) => ({ value: one, label: s(TONE_WORD[one]) })) },
    { id: 'whose', label: s('observation.whoseLabel'), options: [{ value: 'mine', label: s('observation.whoseMine') }] },
    { id: 'show', label: s('observation.showLabel'), options: [{ value: 'merged', label: s('observation.showMerged') }, { value: 'archived', label: s('observation.showArchived') }] },
  ]
  const tones = OBSERVATION_TONES.filter((one) => !f.filters.tonesOff.includes(one))
  const filters = {
    ...(tones.length < OBSERVATION_TONES.length ? { tone: tones } : {}),
    ...(f.filters.mine ? { whose: ['mine'] } : {}),
    ...(showMerged || showArchived ? { show: [...(showMerged ? ['merged'] : []), ...(showArchived ? ['archived'] : [])] } : {}),
  }
  const onFilters = (next: Readonly<Record<string, readonly string[]>>) => {
    const on = next.tone
    set({
      tonesOff: on ? OBSERVATION_TONES.filter((one) => !on.includes(one)) : [],
      mine: (next.whose ?? []).includes('mine'),
    })
    onShowMerged((next.show ?? []).includes('merged'))
    onShowArchived((next.show ?? []).includes('archived'))
  }
  const here = f.inView[0]?.scope
  const scopes: ScopeOption[] = f.inView.map((one) => ({ path: one.scope, label: scopeLabel(one.scope), here: one.scope === here }))
  const words: FilterWord[] = [
    ...TEXT_FILTERS.flatMap(({ field, label, word }) => (f.filters[field].trim() ? [{
      id: field, word: `${s(word)}: ${f.filters[field].trim()}`, label: s(label), onRemove: () => set({ [field]: '' }),
    }] : [])),
    ...(f.filters.scopesOff.length > 0 ? [{
      id: 'scopes', word: s('observation.scopesOffWord', { count: f.filters.scopesOff.length }), label: s('observation.filterScopes'), onRemove: () => set({ scopesOff: [] }),
    }] : []),
  ]
  return (
    <FilterWords
      find={f.filters.search}
      onFind={(search) => set({ search })}
      findLabel={s('observation.findEvery')}
      fields={fields}
      filters={filters}
      onFilters={onFilters}
      words={words}
      onClear={() => f.setFilters({ ...f.filters, observations: '', causes: '', roots: '', scopesOff: [] })}
      filterGuide="observations.filters"
      filterExtra={(
        <div className="chain-filter" role="search" aria-label={s('observation.filters')} data-testid="filter-row" data-guide="observations.filterRow">
          {f.mineSays && <p className="chain-note" data-testid={`filter-mine-${f.mineSays}`}>{s(MINE_SAYS[f.mineSays])}</p>}
          {TEXT_FILTERS.map(({ field, label, example }) => (
            <TextField
              key={field} label={s(label)} value={f.filters[field]} placeholder={s(example)} autoComplete="off"
              onChange={(value) => set({ [field]: value })} data-testid={`filter-${field}`}
            />
          ))}
          <div className="chain-filter__row">
            <ScopesPopover scopes={scopes} off={f.filters.scopesOff} onChange={(scopesOff) => set({ scopesOff })} s={s} />
            <SavedPopover list={f.saved.list} canSave={f.active > 0} onSave={f.saved.save} onRecall={f.saved.recall} onDelete={f.saved.remove} s={s} />
          </div>
        </div>
      )}
      {...(columns ? { columns: columns.choices, shownColumns: columns.shown, onColumns: columns.onChange } : {})}
      {...(f.result.filtering ? { shown: { count: f.result.shown, total: f.result.total } } : {})}
      actions={actions}
    />
  )
}

/** Said in words where a tone filter is asked what is on: a tone chosen off the kit's own list. */
export const toneWords = (tones: readonly ObservationTone[], s: Translate) => tones.map((one) => s(TONE_WORD[one]))

/**
 * A scope with nothing yet: no zero counters, no legend, no empty sections. The chain
 * is said once, in an example's words, with one first step, because most scopes of a
 * tree look like this and a person who has not walked the chain does not know it is
 * there.
 */
export function ChainEmpty({ onNew, s }: { onNew?: (() => void) | undefined; s: Translate }) {
  const steps = [
    { label: s('observation.stageSeen'), said: s('observation.emptySeen') },
    { label: s('observation.stageWhy'), said: s('observation.emptyWhy') },
    { label: s('observation.stageSolve'), said: s('observation.emptySolve') },
    { label: s('observation.stageResults'), said: s('observation.emptyResults') },
  ]
  return (
    <div className="chain-empty" data-testid="chain-empty">
      <h2>{s('observation.emptyTitle')}</h2>
      <ol className="chain-rail">
        {steps.map((one) => (
          <li key={one.label}>
            <span className="chain-rail__label">{one.label}</span>
            <span>{one.said}</span>
          </li>
        ))}
      </ol>
      {onNew && (
        <div className="chain-empty__do">
          <Button variant="primary" onClick={onNew} data-testid="observation-empty-new">{s('observation.new')}</Button>
          <span className="chain-note">{s('observation.emptyOnlyFirst')}</span>
        </div>
      )}
    </div>
  )
}
