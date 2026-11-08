// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The lines on what a plan moves away from: one row per line, where it goes and
 * when. Derived from the lines themselves (`model/porting`), so a port written
 * anywhere (here, by the agent, by hand in the inspector) shows here, and the list
 * doubles as the status of the migration without a status field anywhere.
 *
 * Repetition hid the work: where they all go is said once, no day is words rather
 * than an empty field, and the question *which still have no day* is a filter. A
 * row opens the large preview, which reads a label whole, walks the rows with ‹ ›,
 * and is where one line's day is set. *Give the rest a day…* is the old Port all.
 */
import { useMemo, useState } from 'react'
import { elementsWithRole, portsOf } from '../../model'
import type { DesignModel, ElementId, Port, Transition } from '../../model'
import { formatDay } from '../../i18n/dates'
import { useStrings } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { SelectField, DateField } from '../../widgets/kit/Field'
import { FilterWords } from '../../widgets/kit/FilterWords'
import { List } from '../../widgets/kit/List'
import { FRESH_VIEW, listed } from '../../widgets/kit/listView'
import type { ListView } from '../../widgets/kit/listView'
import { Preview, PreviewFact } from '../../widgets/kit/Preview'

type PortState = 'noDay' | 'planned' | 'moved'

/** Which end of the twin is the introduced element: the same end the original leaves from. */
function endOf(port: Port): 'sourceId' | 'targetId' {
  return port.from.sourceId === port.fromElementId ? 'sourceId' : 'targetId'
}

const arrow = (port: Port) => (port.from.isBidirectional ? '↔' : port.from.sourceId === port.fromElementId ? '→' : '←')

export type InterfacesActions = {
  port(planId: string, connectionId: string, toId: ElementId, on: string): void
  portAll(planId: string, toId: ElementId, on: string): void
  unport(planId: string, connectionId: string): void
  onOpenElement(id: ElementId): void
}

export function PlanInterfaces({ plan, model, today, readOnly, actions }: {
  plan: Transition
  model: DesignModel
  /** So a port whose day has come reads as done. */
  today: string
  readOnly: boolean
  actions: InterfacesActions
}) {
  const { t, language } = useStrings()
  const ports = useMemo(() => portsOf(model, plan), [model, plan])
  const targets = elementsWithRole(plan, 'introduces')
  const name = (id: ElementId) => model.elements.find((element) => element.id === id)?.name ?? id
  // Where a port goes when there is only one place it can: a one-for-one replacement asks for a day and nothing else.
  const only = targets.length === 1 ? targets[0] : undefined
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [view, setView] = useState<ListView>(FRESH_VIEW)
  const [opened, setOpened] = useState<string | null>(null)
  const [giving, setGiving] = useState(false)
  const targetFor = (port: Port) => port.to?.[endOf(port)] ?? choice[port.from.id] ?? only ?? ''
  const stateOf = (port: Port): PortState => (port.on === undefined ? 'noDay' : port.on <= today ? 'moved' : 'planned')
  const stateWord: Record<PortState, string> = { noDay: t('plan.notPlanned'), planned: t('plan.planned'), moved: t('plan.ported') }
  const rowName = (port: Port) => (port.from.label ? `${name(port.counterpartId)} · ${port.from.label}` : name(port.counterpartId))
  const remaining = ports.filter((port) => port.on === undefined)

  if (ports.length === 0) return <p className="plan-sentence">{t('plan.noInterfaces')}</p>

  const groups = listed(ports, view, {
    words: (port) => [name(port.counterpartId), port.from.label ?? '', port.from.protocol ?? ''],
    filterBy: { state: (port) => stateOf(port) },
  })
  const shown = groups.flatMap((group) => group.rows)
  const current = shown.find((port) => port.from.id === opened) ?? ports.find((port) => port.from.id === opened)
  const several = targets.length > 1
  return (
    <>
      <p className="plan-sentence" data-testid="plan-interfaces-said">
        {only !== undefined && `${t('plan.allMoveTo', { name: name(only) })} `}
        {t('plan.haveADay', { done: ports.length - remaining.length, total: ports.length })}
      </p>
      <FilterWords
        find={view.find} onFind={(find) => setView({ ...view, find })} findLabel={t('plan.findLine')}
        fields={[{
          id: 'state', label: t('plan.stateField'),
          options: (['noDay', 'planned', 'moved'] as const).map((state) => ({ value: state, label: stateWord[state], count: ports.filter((port) => stateOf(port) === state).length })),
        }]}
        filters={view.filters} onFilters={(filters) => setView({ ...view, filters })}
        shown={{ count: shown.length, total: ports.length }}
        {...(!readOnly && remaining.length > 0 ? { actions: <Button onClick={() => setGiving(true)}>{t('plan.giveTheRest')}</Button> } : {})}
      />
      <List
        label={t('plan.interfaces')} itemLabel={t('plan.counterpart')} selectedId={opened} onOpen={setOpened}
        columns={[
          { id: 'protocol', label: t('plan.protocol'), width: '110px' },
          ...(several ? [{ id: 'to', label: t('plan.movesTo'), width: '180px' }] : []),
          { id: 'on', label: t('plan.onDay'), width: '130px' },
        ]}
        groups={groups.map((group) => ({
          id: group.id, label: group.label,
          rows: group.rows.map((port) => ({
            id: port.from.id, text: rowName(port), mark: <span aria-hidden="true">{arrow(port)}</span>,
            cells: {
              protocol: port.from.protocol ?? '',
              ...(several ? { to: targetFor(port) ? name(targetFor(port)) : '' } : {}),
              on: port.on ? formatDay(port.on, language) : t('plan.noDay'),
            },
          })),
        }))}
      />
      <p className="plan-note">{t('plan.interfacesFoot')}</p>
      {current && (
        <Preview
          ids={shown.map((port) => port.from.id)} currentId={current.from.id} onSelect={setOpened}
          title={name(current.counterpartId)} listWord={t('plan.interfaces')}
          facts={(
            <>
              <PreviewFact label={t('plan.stateField')}>{stateWord[stateOf(current)]}</PreviewFact>
              <PreviewFact label={t('plan.protocol')}>{current.from.protocol ?? '—'}</PreviewFact>
              <PreviewFact label={t('plan.direction')}>{name(current.fromElementId)} {arrow(current)} {name(current.counterpartId)}</PreviewFact>
            </>
          )}
          foot={(
            <>
              <Button onClick={() => { setOpened(null); actions.onOpenElement(current.counterpartId) }}>{t('roadmap.showOnBoard')}</Button>
              {/* Only a dated twin was written as a port. An undated line that happens to match is somebody's drawing, and not ours to delete. */}
              {!readOnly && current.to && current.on && <Button onClick={() => actions.unport(plan.id, current.from.id)}>{t('plan.unport')}</Button>}
            </>
          )}
        >
          {current.from.label && <p className="plan-sentence">{current.from.label}</p>}
          {readOnly
            ? <PreviewFact label={t('plan.onDay')}>{current.on ? formatDay(current.on, language) : t('plan.noDay')}</PreviewFact>
            : (
              <div className="plan-form">
                {several && (
                  <SelectField
                    label={t('plan.movesTo')} value={targetFor(current)}
                    options={[{ value: '', label: '' }, ...targets.map((id) => ({ value: id, label: name(id) }))]}
                    onChange={(to) => {
                      setChoice((held) => ({ ...held, [current.from.id]: to }))
                      if (current.on && to) actions.port(plan.id, current.from.id, to, current.on)
                    }}
                  />
                )}
                <DateField label={t('plan.onDay')} value={current.on ?? ''} disabled={!targetFor(current)}
                  hint={targetFor(current) ? undefined : t('plan.pickTargetFirst')}
                  onChange={(day) => {
                    if (day) actions.port(plan.id, current.from.id, targetFor(current), day)
                    else if (current.to) actions.unport(plan.id, current.from.id)
                  }}
                />
              </div>
            )}
        </Preview>
      )}
      {giving && (
        <GiveTheRest
          count={remaining.length} targets={targets} name={name} start={plan.to ?? ''} onClose={() => setGiving(false)}
          onGive={(to, on) => { actions.portAll(plan.id, to, on); setGiving(false) }}
        />
      )}
    </>
  )
}

/** Every interface with no day yet, onto one element on one day, as one step. */
function GiveTheRest({ count, targets, name, start, onGive, onClose }: {
  count: number
  targets: readonly ElementId[]
  name: (id: ElementId) => string
  start: string
  onGive: (to: ElementId, on: string) => void
  onClose: () => void
}) {
  const { t } = useStrings()
  const [to, setTo] = useState<string>(targets.length === 1 ? targets[0] : '')
  const [on, setOn] = useState(start)
  return (
    <Dialog
      open title={t('plan.giveTheRest')} onClose={onClose}
      actions={(
        <>
          <Button variant="quiet" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!to || !on} onClick={() => onGive(to, on)}>{t('plan.giveAct', { count })}</Button>
        </>
      )}
    >
      {targets.length > 1 && (
        <SelectField
          label={t('plan.movesTo')} value={to} onChange={setTo}
          options={[{ value: '', label: '' }, ...targets.map((id) => ({ value: id, label: name(id) }))]}
        />
      )}
      <DateField label={t('plan.onDay')} hint={t('plan.giveHelp')} value={on} onChange={setOn} />
    </Dialog>
  )
}
