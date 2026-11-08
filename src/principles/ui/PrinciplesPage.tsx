// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's principles (ADR-0041), under Guidance: one quiet line per principle,
 * grouped in the order the scope keeps; then those in force here from the scopes
 * above and from the topics relevant here, each under where it comes from. A row
 * says only what stands out, since nearly all are accepted and flexible and saying
 * so on each is noise: the fixed ones are what a designer must not break. Selecting
 * a row opens it large; an own principle's selection is carried by the address.
 *
 * A page over a home, reached from its card, never the first view: its script
 * arrives when it is first opened.
 */
import { useEffect, useMemo, useState } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import type { WindowChrome } from '../../platform/windowChrome'
import { Button } from '../../widgets/kit/Button'
import { FilterWords } from '../../widgets/kit/FilterWords'
import { List } from '../../widgets/kit/List'
import type { ListGroup } from '../../widgets/kit/List'
import { FRESH_VIEW, listed } from '../../widgets/kit/listView'
import type { ListHow, ListView } from '../../widgets/kit/listView'
import { PageDialog } from '../../widgets/PageDialog'
import { formatAspectNumber, formatPrincipleNumber, groupedPrinciples, PRINCIPLE_REGIMES, PRINCIPLE_STATUSES } from '../principle'
import type { Principle, PrincipleRef } from '../principle'
import type { PrincipleInForce } from '../suggest'
import { GroupsDialog } from './GroupsDialog'
import { GuidanceEmpty, GuidanceFrame } from './GuidanceFrame'
import { PrincipleEditor } from './PrincipleEditor'
import { PrincipleReader } from './PrincipleReader'
import { usePrinciples } from './PrinciplesContext'
import type { PrinciplesAccess } from './PrinciplesContext'
import { REGIME_WORD, STATUS_WORD } from './words'

export type PrinciplesPageProps = {
  open: boolean
  onClose: () => void
  /** The scope whose principles these are: the one open. */
  scope: string
  /** A principle of the scope to pick when the page opens, by id. */
  select?: string
  /** The request's number: asking for the same principle again is a new request. */
  nonce?: number
  /** An own principle picked or let go of, for the address to carry. */
  onSelect?: (id: string | undefined) => void
  windowChrome: WindowChrome
}

const rowId = (ref: PrincipleRef) => `${ref.scope}#${ref.id}`

const HOW: ListHow<PrincipleInForce> = {
  // What Find covers: the number, its aspects' numbers, its words and keywords.
  words: ({ principle }) => [
    formatPrincipleNumber(principle.number), principle.title, principle.statement, ...(principle.keywords ?? []),
    ...principle.aspects.flatMap((one) => [formatAspectNumber(principle.number, one.number), one.text]),
  ],
  filterBy: {
    status: ({ principle }) => principle.status,
    regime: ({ principle }) => principle.regime,
    group: ({ principle }) => principle.groups,
  },
}

/** Retired ones stay out until somebody asks for them, in a search too: they no longer guide anything. */
const keepRetired = (view: ListView) => (view.filters.status ?? []).includes('retired')

/** The word on a row: nothing for accepted and flexible. */
function noteOf(principle: Principle, word: (key: Parameters<ReturnType<typeof useStrings>['t']>[0]) => string): string | undefined {
  const said = [
    ...(principle.status === 'accepted' ? [] : [word(STATUS_WORD[principle.status])]),
    ...(principle.regime === 'fixed' ? [word(REGIME_WORD.fixed)] : []),
  ]
  return said.length ? said.join(', ') : undefined
}

/** The principles in force here from elsewhere, under where each comes from: the scopes above, nearest first, then the topics. */
function otherSources(access: PrinciplesAccess, here: string, list: readonly PrincipleInForce[]) {
  const by = new Map<string, PrincipleInForce[]>()
  for (const one of list) by.set(one.scope, [...(by.get(one.scope) ?? []), one])
  return [...by.entries()].map(([scope, items]) => ({
    scope, topic: access.sourceOf(here, scope).kind === 'topic', items: [...items].sort((a, b) => a.principle.number - b.principle.number),
  }))
}

export function PrinciplesPage({ open, onClose, scope, select, nonce, onSelect, windowChrome }: PrinciplesPageProps) {
  const access = usePrinciples()
  const { t, language } = useStrings()
  const [view, setView] = useState<ListView>(FRESH_VIEW)
  const [picked, setPicked] = useState<PrincipleRef | undefined>(undefined)
  const [editing, setEditing] = useState<{ principle?: Principle; scope: string; title?: string } | undefined>(undefined)
  const [groupsOpen, setGroupsOpen] = useState(false)
  useEffect(() => {
    if (open) setPicked(select ? { scope, id: select } : undefined)
  }, [open, select, scope, nonce])
  const version = access?.version ?? 0
  const own = useMemo(() => access?.own(scope) ?? { principles: [], groups: [] }, [access, scope, version])
  const inForce = useMemo(() => access?.inForce(scope) ?? [], [access, scope, version])
  const every = useMemo(() => {
    const mine: PrincipleInForce[] = own.principles.filter((one) => !one.mergedInto).map((principle) => ({ scope, principle, groups: own.groups }))
    return [...mine, ...inForce.filter((one) => one.scope !== scope)]
  }, [own, inForce, scope])
  const kept = useMemo(() => (listed(every, view, { ...HOW, language })[0]?.rows ?? []).filter((one) => keepRetired(view) || one.principle.status !== 'retired'), [every, view, language])
  if (!access) return null
  const label = access.scopeLabel(scope)
  const mayWrite = access.mayWrite(scope)
  const elsewhere = otherSources(access, scope, kept.filter((one) => one.scope !== scope))
  const row = (one: PrincipleInForce) => {
    const note = noteOf(one.principle, t)
    return { id: rowId({ scope: one.scope, id: one.principle.id }), code: formatPrincipleNumber(one.principle.number), text: one.principle.title, ...(note ? { note } : {}) }
  }
  const sections = groupedPrinciples(kept.filter((one) => one.scope === scope).map((one) => one.principle), own.groups)
  const groups: ListGroup[] = [
    ...sections.map(({ group, principles }) => ({
      id: group?.id ?? '-',
      label: group?.name ?? (elsewhere.length ? t('principles.keptIn', { scope: label }) : t('principles.ungrouped')),
      rows: principles.map((principle) => row({ scope, principle, groups: own.groups })),
    })),
    ...elsewhere.map((from) => ({
      id: `from:${from.scope}`,
      label: t(from.topic ? 'principles.fromTopicHeading' : 'principles.fromHeading', { scope: access.scopeLabel(from.scope) }),
      rows: from.items.map(row),
    })),
  ]
  const ids = groups.flatMap((group) => group.rows.map((one) => one.id))
  const current = picked ? access.find(picked) : undefined
  const pick = (ref: PrincipleRef | undefined) => {
    setPicked(ref)
    if (ref === undefined || ref.scope === scope) onSelect?.(ref?.id)
  }
  const refOf = (id: string): PrincipleRef | undefined => {
    const one = every.find((held) => rowId({ scope: held.scope, id: held.principle.id }) === id)
    return one ? { scope: one.scope, id: one.principle.id } : undefined
  }
  const count = (of: (one: PrincipleInForce) => boolean) => every.filter(of).length
  const newOne = mayWrite ? { label: t('principles.new'), onPress: () => setEditing({ scope }), dataGuide: 'principles.new' } : undefined
  const empty = every.length === 0
  return (
    <PageDialog open={open} topInset={windowChrome.topInset} onClose={onClose} aria-label={t('principles.title')}>
      <GuidanceFrame tab="principles">
        {empty ? <div className="guidance__body"><GuidanceEmpty tab="principles" {...(newOne ? { action: newOne } : {})} /></div> : (
          <>
            <div className="guidance__bar">
              <FilterWords
                find={view.find} onFind={(find) => setView((was) => ({ ...was, find }))} findLabel={t('principles.search')}
                filters={view.filters} onFilters={(filters) => setView((was) => ({ ...was, filters }))}
                shown={{ count: kept.length, total: count((one) => one.principle.status !== 'retired') }}
                summary={t('principles.countLine', { principles: count((one) => one.principle.status !== 'retired'), groups: own.groups.length })}
                fields={[
                  { id: 'status', label: t('principles.statusFilter'), options: PRINCIPLE_STATUSES.map((one) => ({ value: one, label: t(STATUS_WORD[one]), count: count((held) => held.principle.status === one) })) },
                  { id: 'regime', label: t('principles.regimeFilter'), options: PRINCIPLE_REGIMES.map((one) => ({ value: one, label: t(REGIME_WORD[one]), count: count((held) => held.principle.regime === one) })) },
                  ...(own.groups.length ? [{ id: 'group', label: t('principles.groupFilter'), options: own.groups.map((one) => ({ value: one.id, label: one.name, count: count((held) => held.scope === scope && held.principle.groups.includes(one.id)) })) }] : []),
                ]}
                actions={mayWrite && (
                  <>
                    <Button variant="plain" onClick={() => setGroupsOpen(true)} data-testid="principles-groups">{t('principles.manageGroups')}</Button>
                    <Button variant="primary" onClick={() => setEditing({ scope })} data-testid="principles-new" data-guide="principles.new">{t('principles.new')}</Button>
                  </>
                )}
              />
            </div>
            {own.principles.length === 0 && mayWrite && <p className="guidance__note">{t('principles.noneOwn', { scope: label })}</p>}
            <div className="guidance__list" data-testid="principles-list">
              <List
                label={t('principles.title')} groups={groups} selectedId={picked ? rowId(picked) : null}
                onOpen={(id) => pick(refOf(id))}
                empty={(
                  <div className="guidance__note" role="status">
                    <p>{t('principles.searchEmpty', { query: view.find })}</p>
                    <p>{t('principles.searchReads')}</p>
                    <Button variant="plain" onClick={() => setView((was) => ({ ...was, filters: { ...was.filters, status: [...PRINCIPLE_STATUSES] } }))}>{t('principles.includeRetired')}</Button>
                    {mayWrite && view.find.trim() && <>{' '}<Button variant="quiet" onClick={() => setEditing({ scope, title: view.find.trim() })}>{t('principles.writeAsNew')}</Button></>}
                  </div>
                )}
              />
            </div>
          </>
        )}
      </GuidanceFrame>
      {current && picked && (
        <PrincipleReader
          key={rowId(picked)} found={current} here={scope} ids={ids} currentId={rowId(picked)}
          onSelect={(id) => pick(id === null ? undefined : refOf(id))}
          onEdit={() => setEditing({ principle: current.principle, scope: current.scope })}
          onPick={(ref) => pick(ref)}
        />
      )}
      {editing && (
        <PrincipleEditor
          open scope={editing.scope}
          {...(editing.principle ? { principle: editing.principle } : {})}
          {...(editing.title ? { title: editing.title } : {})}
          onClose={(made) => { setEditing(undefined); if (made) pick({ scope: editing.scope, id: made }) }}
        />
      )}
      <GroupsDialog open={groupsOpen} scope={scope} onClose={() => setGroupsOpen(false)} />
    </PageDialog>
  )
}
