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
import { ListMore } from '../../widgets/kit/ListMore'
import type { FilterField, FilterWord } from '../../widgets/kit/FilterWords'
import { CHAINS_ALL, CHAINS_FIRST, CHAINS_MORE } from '../chain'
import type { MapWindow } from '../chain'
import { OBSERVATION_TONES } from '../observation'
import type { Analysis, ObservationBelow } from '../observation'
import { implementedOn, isLive, seenSinceImplemented } from '../solution'
import type { Solution, SolutionPlan } from '../solution'
import type { ObservationStage } from '../tabs'
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
    { id: 'tone', label: s('observation.toneLabel'), guide: 'observations.tone', options: OBSERVATION_TONES.map((one) => ({ value: one, label: s(TONE_WORD[one]) })) },
    { id: 'whose', label: s('observation.whoseLabel'), guide: 'observations.mine', options: [{ value: 'mine', label: s('observation.whoseMine') }] },
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
          <Button variant="primary" onClick={onNew} data-testid="observation-empty-new" data-guide="observations.new">{s('observation.new')}</Button>
          <span className="chain-note">{s('observation.emptyOnlyFirst')}</span>
        </div>
      )}
    </div>
  )
}

/** What can be done with what is ticked: one question for a group, or one merge. A cause explains its own scope, so a group is of one. */
export function BulkActions({ ticked, stage, here, onClear, onAsk, onMerge, s }: {
  ticked: ReadonlySet<string>
  stage: ObservationStage
  here: string
  onClear: () => void
  onAsk: (ids: readonly string[], scope: string | undefined) => void
  onMerge: (kind: 'observation' | 'cause', at: { scope: string; id: string }, others: readonly { scope: string; id: string }[]) => void
  s: Translate
}) {
  const at = [...ticked].map((key) => {
    const hash = key.lastIndexOf('#')
    return hash < 0 ? { id: key, scope: undefined } : { id: key.slice(hash + 1), scope: key.slice(0, hash) }
  })
  const oneScope = at.every((one) => one.scope === at[0]?.scope)
  return (
    <>
      {stage === 'register' && (
        <Button
          variant="primary" size="small" reason={oneScope ? undefined : s('observation.bulkOneScope')} data-testid="bulk-ask-why"
          onClick={() => { onAsk(at.map((one) => one.id), at[0]?.scope); onClear() }}
        >
          {ticked.size === 1 ? s('observation.bulkAskWhyOne') : s('observation.bulkAskWhy', { count: ticked.size })}
        </Button>
      )}
      <Button
        size="small" reason={ticked.size < 2 ? s('observation.bulkMergeTwo') : undefined} data-testid="bulk-merge"
        onClick={() => {
          const [first, ...rest] = at.map((one) => ({ scope: one.scope ?? here, id: one.id }))
          if (first) onMerge(stage === 'register' ? 'observation' : 'cause', first, rest)
          onClear()
        }}
      >
        {s('observation.bulkMerge')}
      </Button>
    </>
  )
}

/**
 * How much of a large scope's map is drawn, and the way to the rest, under the map
 * where a person arrives having read it: the choice is the person's, and kept.
 */
export function MapWindowBar({ window: drawn, kept, loose, belowInView, onKeep, s }: {
  window: MapWindow
  kept: number
  loose: number
  /** Scopes below are drawn too, so the first chains are this scope's rather than simply the heaviest. */
  belowInView: boolean
  onKeep: (chains: number) => void
  s: Translate
}) {
  const { shownChains, totalChains } = drawn
  if (totalChains === 0) return null
  const name = { 'data-testid': 'map-window', 'data-guide': 'observations.mapWindow' }
  const showAll = <Button size="small" onClick={() => onKeep(CHAINS_ALL)} data-testid="map-all">{s('observation.mapShowAll')}</Button>
  if (shownChains < totalChains) {
    const top = s(belowInView ? 'observation.mapTopHere' : 'observation.mapTop', { shown: shownChains, total: totalChains })
    return (
      <ListMore {...name} said={`${top} · ${s('observation.mapHidden', { count: totalChains - shownChains })}`}>
        {showAll}
        <Button variant="quiet" size="small" onClick={() => onKeep(shownChains + CHAINS_MORE)} data-testid="map-more">{s('observation.mapShowMore', { count: CHAINS_MORE })}</Button>
      </ListMore>
    )
  }
  if (kept === CHAINS_ALL) {
    return (
      <ListMore {...name} said={s('observation.mapAll', { total: totalChains })}>
        <Button variant="quiet" size="small" onClick={() => onKeep(CHAINS_FIRST)} data-testid="map-top">{s('observation.mapBackTop', { count: CHAINS_FIRST })}</Button>
      </ListMore>
    )
  }
  return loose > 0
    ? <ListMore {...name} said={loose === 1 ? s('observation.mapPileHiddenOne') : s('observation.mapPileHidden', { count: loose })}>{showAll}</ListMore>
    : <ListMore {...name} said={s('observation.mapAll', { total: totalChains })} />
}

/**
 * What a filter or the scopes below being off keep back of what is on screen, said
 * at the end of it. *Show all* takes both away, since that is what the words offer.
 */
export function HiddenBar({ f, onMap, listHidden, s }: {
  f: PictureFilters
  onMap: boolean
  /** What this stage's list would draw and does not. Asked only where something can be kept back: it draws the list twice. */
  listHidden: () => number
  s: Translate
}) {
  const filtering = f.result.filtering
  const belowOff = f.hasBelow && !f.viewLocal
  // On a map what is kept back is counted over all its records; a list says what it would itself have drawn.
  const count = onMap ? f.result.total - f.result.shown + f.hiddenLocal : filtering || belowOff ? listHidden() : 0
  if (count === 0) return null
  const said = filtering && belowOff ? 'observation.hiddenBoth' : filtering ? 'observation.hiddenByFilter' : 'observation.hiddenBelow'
  const onShowAll = () => { f.clear(); f.setViewLocal(true) }
  return (
    <ListMore said={s(said, { count })} data-testid="observation-hidden">
      <Button size="small" onClick={onShowAll} data-testid="observation-show-all">{s('observation.mapShowAll')}</Button>
    </ListMore>
  )
}

/** What Did it work says it holds. */
export function ResultsSaid({ solutions, plans, analysis, belowAll, s }: {
  solutions: readonly Solution[]; plans: readonly SolutionPlan[]; analysis: Analysis; belowAll: readonly ObservationBelow[]; s: Translate
}) {
  const built = solutions.filter((one) => isLive(one) && implementedOn(one, plans) !== undefined).length
  const back = solutions.filter((one) => seenSinceImplemented(one, analysis, belowAll, plans).length > 0).length
  return <span data-testid="stage-said">{built === 0 ? s('solution.saidNothingBuilt') : s('solution.saidBuilt', { built, back })}</span>
}
