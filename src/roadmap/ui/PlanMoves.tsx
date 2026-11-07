// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a plan does, one line each: what it changes, its milestones, the decisions
 * it rests on. A line reads as words; a press makes that one line a form, and the
 * add row shows only after + (ADR-0009, amended). A reader sees no + and no form.
 *
 * Each row says the three things its gate line cannot clear without: a record or an
 * element deleted since is *no longer here*, rather than an id nobody can place; a
 * record not yet accepted says its status; and a stand-in says where its dates are
 * kept, rather than offering three date fields its scope would refuse to write
 * (ADR-0012 §3). The dates on an element are the element's own, and are written
 * through a separate action rather than into the plan.
 */
import { useState } from 'react'
import { DATED_PHASES, datesInOrder, isDay } from '../../model'
import type { DesignElement, DesignModel, ElementId, LifecycleDates, Transition, TransitionRole } from '../../model'
import type { Adr } from '../../model/adr'
import { STATUS_LABEL as ADR_STATUS_LABEL, formatAdrNumber } from '../../decisions'
import { ELEMENT_KINDS, KIND_LABEL_KEYS } from '../../model/kinds'
import type { ElementKind } from '../../model/types'
import { formatDay } from '../../i18n/dates'
import { useStrings } from '../../i18n'
import type { StringKey } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import { PropertyRow, PropertyRows, Select, TextInput } from '../../widgets/kit/Field'
import { Mark } from '../../widgets/kit/Mark'
import { Picker } from '../../widgets/kit/Picker'
import { OrderedDateFields } from '../../widgets/OrderedDateFields'
import type { DescribeElsewhere } from '../planGateHints'
import { outsideWindow } from '../planReading'
import { PressedForm } from './PlanFacts'

const ROLES: readonly TransitionRole[] = ['introduces', 'retires', 'changes']

/**
 * The kinds a plan can bring in or take out: the ones whose lifecycle is dated on
 * the roadmap. A capability or a journey step is changed by a plan, never
 * introduced or retired by one.
 */
const DATED_KINDS: ReadonlySet<ElementKind> = new Set<ElementKind>(['application', 'component', 'platform', 'platformService'])

/** Applications first, because that is what a plan is usually about; then the rest in the model's order. */
const KIND_ORDER: readonly ElementKind[] = ['application', ...ELEMENT_KINDS.filter((kind) => kind !== 'application')]

/** Where a stand-in's dates are kept, and, for one the plan retires, the day gone its scope gives it. */
function standInWords(id: ElementId, role: TransitionRole, describe: DescribeElsewhere | undefined, t: ReturnType<typeof useStrings>['t'], day: (d: string) => string): string {
  const told = describe?.(id)
  const scope = told?.where
  return role === 'retires' && scope && isDay(told?.retired)
    ? t('plan.standInGoneOn', { day: day(told.retired), scope })
    : scope ? t('plan.standInDates', { scope }) : t('plan.standInDatesSomewhere')
}

/** The date that matters on a line, said at its end, and what is missing where a gate is waiting for it. */
function RowDates({ role, element }: { role: TransitionRole; element: DesignElement }) {
  const { t, language } = useStrings()
  if (role === 'changes') return null
  const phase = role === 'introduces' ? 'live' : 'retired'
  const day = element.lifecycleDates?.[phase]
  if (isDay(day)) return <>{t(role === 'introduces' ? 'plan.liveFrom' : 'plan.goneOn', { day: formatDay(day, language) })}</>
  return <span className="plan-warning"><Mark kind="review" />{t(role === 'introduces' ? 'plan.noLiveDay' : 'plan.noGoneDay')}</span>
}

export function ChangesRows({ plan, model, readOnly, describe, set, onOpen, onDates, adding, onAdding }: {
  plan: Transition
  model: DesignModel
  readOnly: boolean
  describe?: DescribeElsewhere | undefined
  set: (patch: Partial<Transition>) => void
  onOpen: (id: ElementId) => void
  onDates: (id: ElementId, dates: LifecycleDates | undefined) => void
  adding: boolean
  onAdding: (on: boolean) => void
}) {
  const { t, language } = useStrings()
  const byId = new Map(model.elements.map((element) => [element.id, element]))
  const setElements = (elements: Transition['elements']) => set({ elements })
  return (
    <>
      {plan.elements.length === 0 && !adding && <p className="plan-sentence">{t('plan.noElements')}</p>}
      <PropertyRows readOnly={readOnly}>
        {plan.elements.map((one, index) => {
          const element = byId.get(one.elementId)
          const standIn = element !== undefined && element.ref !== undefined
          return (
            <PropertyRow
              key={one.elementId} label={t(`plan.${one.role}` as StringKey)}
              value={element?.name ?? t('plan.goneElement')}
              display={element ? (readOnly ? <button type="button" className="roadmap-link" onClick={() => onOpen(one.elementId)}>{element.name}</button> : element.name) : <span className="plan-gone" data-gone="">{t('plan.goneElement')}</span>}
              aside={element && (standIn && one.role !== 'changes'
                ? <span data-testid={`plan-standin-${element.id}`}>{standInWords(element.id, one.role, describe, t, (day) => formatDay(day, language))}</span>
                : <RowDates role={one.role} element={element} />)}
              edit={(editor) => (
                <PressedForm onClose={editor.cancel}>
                  <Select
                    autoFocus aria-label={t('plan.role')} value={one.role}
                    options={ROLES.map((role) => ({ value: role, label: t(`plan.${role}` as StringKey) }))}
                    onChange={(event) => setElements(plan.elements.map((row, at) => (at === index ? { ...row, role: event.target.value as TransitionRole } : row)))}
                  />
                  <span className="plan-form__grow">
                    {element
                      ? <button type="button" className="roadmap-link" onClick={() => onOpen(one.elementId)}>{element.name}</button>
                      : <span className="plan-gone">{t('plan.goneElement')}</span>}
                  </span>
                  {element && one.role !== 'changes' && !standIn && (
                    <OrderedDateFields
                      keys={DATED_PHASES} values={element.lifecycleDates}
                      label={(phase) => t(`plan.date.${phase}` as StringKey)}
                      ariaLabel={(phase) => `${element.name}: ${t(`plan.date.${phase}` as StringKey)}`}
                      size="small" accepts={datesInOrder} refusal={t('command.datesOutOfOrder')}
                      onChange={(dates) => onDates(element.id, dates)}
                    />
                  )}
                  <Button size="small" variant="quiet" onClick={() => { editor.cancel(); setElements(plan.elements.filter((_row, at) => at !== index)) }}>{t('plan.remove')}</Button>
                </PressedForm>
              )}
            />
          )
        })}
      </PropertyRows>
      {adding && !readOnly && (
        <AddElement
          plan={plan} model={model}
          onAdd={(row) => setElements([...plan.elements, row])}
          onClose={() => onAdding(false)}
        />
      )}
    </>
  )
}

/**
 * Naming one more element, with its role. Grouped by kind, applications first:
 * "Billing" the application and "Billing" the capability are two different things
 * to retire. Introduced and retired only where a lifecycle is dated; changed, anything.
 */
function AddElement({ plan, model, onAdd, onClose }: {
  plan: Transition
  model: DesignModel
  onAdd: (row: Transition['elements'][number]) => void
  onClose: () => void
}) {
  const { t } = useStrings()
  const [role, setRole] = useState<TransitionRole>('introduces')
  const named = new Set(plan.elements.map((one) => one.elementId))
  const rank = (kind: ElementKind) => KIND_ORDER.indexOf(kind)
  const candidates = model.elements
    .filter((element) => !named.has(element.id))
    .filter((element) => role === 'changes' || DATED_KINDS.has(element.kind))
    .sort((a, b) => rank(a.kind) - rank(b.kind) || a.name.localeCompare(b.name))
  return (
    <div className="plan-form plan-add" data-testid="plan-add-element">
      <span className="plan-form__grow">
        <Picker
          label={t('plan.addElementLabel')} placeholder={t('plan.addElementLabel')} autoFocus posture="popup"
          options={candidates.map((element) => ({ id: element.id, label: element.name, group: t(KIND_LABEL_KEYS[element.kind]) }))}
          onPick={(option) => { onAdd({ elementId: option.id, role }); onClose() }}
          onEscape={onClose}
        />
      </span>
      <Select
        aria-label={t('plan.role')} value={role} onChange={(event) => setRole(event.target.value as TransitionRole)}
        options={ROLES.map((one) => ({ value: one, label: t(`plan.${one}` as StringKey) }))}
      />
      <Button size="small" variant="quiet" onClick={onClose}>{t('common.cancel')}</Button>
    </div>
  )
}

/** A milestone while it is a form: nothing is written until it is left, and Escape drops what was typed. */
function MilestoneForm({ held, onSave, onRemove, onLook, onClose }: {
  held: { date: string; name: string }
  onSave: (next: { date: string; name: string }) => void
  onRemove?: () => void
  /** Open the board on this day, where there is a board to open. */
  onLook?: (day: string) => void
  onClose: () => void
}) {
  const { t } = useStrings()
  const [draft, setDraft] = useState(held)
  const save = () => { if (draft.name !== held.name || draft.date !== held.date) onSave(draft) }
  return (
    <PressedForm onClose={onClose} onLeave={save}>
      <TextInput type="date" aria-label={t('plan.milestoneDate')} value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
      <span className="plan-form__grow">
        <TextInput autoFocus aria-label={t('plan.milestoneName')} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      </span>
      {onLook && isDay(draft.date) && <Button size="small" variant="quiet" onClick={() => onLook(draft.date)}>{t('plan.lookOnDay')}</Button>}
      {onRemove && <Button size="small" variant="quiet" onClick={() => { onClose(); onRemove() }}>{t('plan.remove')}</Button>}
    </PressedForm>
  )
}

export function MilestoneRows({ plan, readOnly, set, picked, onPicked, adding, onAdding, onLook }: {
  plan: Transition
  readOnly: boolean
  set: (patch: Partial<Transition>) => void
  /** The milestone that is a form: its index, as a row's name. */
  picked: string | undefined
  onPicked: (id: string | undefined) => void
  adding: boolean
  onAdding: (on: boolean) => void
  onLook?: (day: string) => void
}) {
  const { t, language } = useStrings()
  const setMilestones = (milestones: Transition['milestones']) => set({ milestones })
  return (
    <>
      {plan.milestones.length === 0 && !adding && <p className="plan-sentence">{t('plan.noMilestones')}</p>}
      <PropertyRows readOnly={readOnly} editing={picked} onEditing={onPicked}>
        {plan.milestones.map((milestone, index) => {
          const outside = outsideWindow(plan, milestone.date)
          return (
            <PropertyRow
              key={index} rowId={String(index)} data-guide="plan.milestone"
              label={isDay(milestone.date) ? formatDay(milestone.date, language) : t('plan.milestoneNoDay')}
              value={milestone.name} empty={t('plan.milestoneNoName')}
              aside={outside && <span className="plan-warning"><Mark kind="review" />{t(outside === 'after' ? 'plan.outsideAfter' : 'plan.outsideBefore')}</span>}
              edit={(editor) => (
                <MilestoneForm
                  held={milestone} onClose={editor.cancel} {...(onLook ? { onLook } : {})}
                  onSave={(next) => setMilestones(plan.milestones.map((row, at) => (at === index ? next : row)))}
                  onRemove={() => setMilestones(plan.milestones.filter((_row, at) => at !== index))}
                />
              )}
            />
          )
        })}
      </PropertyRows>
      {adding && !readOnly && (
        <div className="plan-add">
          <MilestoneForm
            held={{ date: plan.to ?? plan.from ?? '', name: '' }} onClose={() => onAdding(false)}
            onSave={(next) => { if (next.name.trim()) setMilestones([...plan.milestones, next]) }}
          />
        </div>
      )}
    </>
  )
}

export function RestsOnRows({ plan, decisions, decidedAbove, readOnly, set, onOpen, adding, onAdding }: {
  plan: Transition
  decisions: readonly Adr[]
  decidedAbove: readonly Adr[]
  readOnly: boolean
  set: (patch: Partial<Transition>) => void
  onOpen?: ((id: string) => void) | undefined
  adding: boolean
  onAdding: (on: boolean) => void
}) {
  const { t } = useStrings()
  const restsOn = new Set(plan.decisions)
  const candidates = decisions.filter((adr) => !restsOn.has(adr.id))
  const remove = (id: string) => set({ decisions: plan.decisions.filter((one) => one !== id) })
  return (
    <>
      {plan.decisions.length === 0 && !adding && <p className="plan-sentence">{t('plan.noDecisions')}</p>}
      <PropertyRows readOnly={readOnly}>
        {plan.decisions.map((id) => {
          const adr = decisions.find((one) => one.id === id) ?? decidedAbove.find((one) => one.id === id)
          const words = adr ? `${formatAdrNumber(adr.number)} ${adr.title}` : t('plan.goneDecision')
          return (
            <PropertyRow
              key={id} label={adr ? formatAdrNumber(adr.number) : '—'} value={words}
              display={adr
                ? (readOnly && onOpen ? <button type="button" className="roadmap-link" onClick={() => onOpen(id)}>{adr.title}</button> : adr.title)
                : <span className="plan-gone" data-gone="">{t('plan.goneDecision')}</span>}
              aside={adr && adr.status !== 'accepted' && t(ADR_STATUS_LABEL[adr.status])}
              edit={(editor) => (
                <PressedForm onClose={editor.cancel}>
                  <span className="plan-form__grow">
                    {adr && onOpen ? <button type="button" className="roadmap-link" onClick={() => onOpen(id)}>{adr.title}</button> : words}
                  </span>
                  <Button autoFocus size="small" variant="quiet" onClick={() => { editor.cancel(); remove(id) }}>{t('plan.remove')}</Button>
                </PressedForm>
              )}
            />
          )
        })}
      </PropertyRows>
      {adding && !readOnly && (
        <div className="plan-form plan-add" data-testid="plan-add-decision">
          <span className="plan-form__grow">
            <Picker
              label={t('plan.decision')} placeholder={t('plan.decision')} autoFocus posture="popup"
              options={candidates.map((adr) => ({ id: adr.id, label: `${formatAdrNumber(adr.number)} ${adr.title}` }))}
              onPick={(option) => { set({ decisions: [...plan.decisions, option.id] }); onAdding(false) }}
              onEscape={() => onAdding(false)}
            />
          </span>
          <Button size="small" variant="quiet" onClick={() => onAdding(false)}>{t('common.cancel')}</Button>
        </div>
      )}
    </>
  )
}
