// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The facts in a plan's head, each read as words and pressed to change
 * (ADR-0009, amended): the status, with the gate on each forward move said where
 * the decision is; the window, which is not written backwards; and who answers.
 *
 * Each writes through the one patch it is handed and holds no more state than what
 * is being typed. A reader sees the same words with nothing to press.
 */
import { NextStep } from '../../widgets/kit/NextStep'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { TRANSITION_STATUSES, portsOf, transitionStatusesFrom, unplannedPorts } from '../../model'
import type { DesignModel, Transition, TransitionStatus } from '../../model'
import type { Adr } from '../../model/adr'
import { openPlanItems, planGate, statusPatch } from '../../model/transition'
import type { PlanGate, PlanGateItem } from '../../model/transition'
import { useStrings } from '../../i18n'
import type { StringKey, Translate } from '../../i18n'
import { usePersonNames } from '../../people/ui/names'
import { PersonRefField } from '../../people/ui/PersonRefField'
import type { DialogAnswers } from '../../widgets/kit/Dialog'
import { PropertyRow, PropertyRows, DateInput } from '../../widgets/kit/Field'
import { MenuButton } from '../../widgets/kit/Menu'
import type { MenuEntry } from '../../widgets/kit/Menu'
import { PLAN_STATUS_LABEL as STATUS_LABEL } from '../labels'
import { gateElement, planGateHint } from '../planGateHints'
import type { DescribeElsewhere } from '../planGateHints'
import { useWindowWords } from './planWords'

/** Each line of a plan's gate, in the words the page says it in. */
const GATE_LABEL: Record<PlanGateItem, StringKey> = {
  window: 'plan.gate.window',
  owner: 'plan.gate.owner',
  names: 'plan.gate.names',
  decisions: 'plan.gate.decisions',
  started: 'plan.gate.started',
  introducedLive: 'plan.gate.introducedLive',
  retiredDated: 'plan.gate.retiredDated',
  interfacesPorted: 'plan.gate.interfacesPorted',
}

/** Where a line of the gate is cleared. */
export type GateWay = 'window' | 'owner' | 'changes' | 'restsOn' | 'interfaces'

const WAY_OF: Record<PlanGateItem, GateWay> = {
  window: 'window', owner: 'owner', started: 'window', names: 'changes', introducedLive: 'changes', retiredDated: 'changes',
  decisions: 'restsOn', interfacesPorted: 'interfaces',
}

/**
 * The gate on every move the status offers, by the status it leads to. Only the
 * forward moves have one; the rest are always open (ADR-0009).
 */
function gatesFor(
  plan: Transition, model: DesignModel, decisions: readonly Adr[], today: string, describe: DescribeElsewhere | undefined,
): Map<TransitionStatus, PlanGate> {
  const byId = new Map(model.elements.map((element) => [element.id, element]))
  const gates = new Map<TransitionStatus, PlanGate>()
  for (const to of transitionStatusesFrom(plan.status)) {
    const gate = planGate(plan, to, {
      decisions,
      // A stand-in is dated by the scope that defines it, through the tree.
      element: (id) => gateElement(byId.get(id), describe),
      unported: () => unplannedPorts(portsOf(model, plan)).length,
      today,
    })
    if (gate) gates.set(to, gate)
  }
  return gates
}

type StatusProps = {
  plan: Transition
  model: DesignModel
  /** Every record the plan may rest on: this scope's and those above. */
  decisions: readonly Adr[]
  today: string
  readOnly: boolean
  /** What the tree says about a stand-in: where it is defined and when it goes. */
  describe?: DescribeElsewhere | undefined
  set: (patch: Partial<Transition>) => void
  /** Go to where a line of the gate is cleared. */
  goTo: (way: GateWay) => void
}

/**
 * The status, offering only where the machine allows. A move whose gate is not
 * clear says *not yet*, with what holds it as ways to what clears it. Abandoned is
 * a final act, so it goes last. The day a plan is done is written with the move.
 */
function StatusControl({ plan, model, decisions, today, readOnly, describe, set, goTo }: StatusProps) {
  const { t } = useStrings()
  const said = t(STATUS_LABEL[plan.status])
  if (readOnly) return <span data-testid="plan-status">{said}</span>
  const gates = gatesFor(plan, model, decisions, today, describe)
  const reading = { plan, elements: model.elements, decisions, describe, t }
  const offered = TRANSITION_STATUSES.filter((status) => status === plan.status || transitionStatusesFrom(plan.status).includes(status))
  const items: MenuEntry[] = offered.map((status) => {
    const gate = gates.get(status)
    const open = openPlanItems(gate).length > 0
    return {
      label: t(STATUS_LABEL[status]),
      checked: status === plan.status,
      ...(status === 'abandoned' ? { final: true } : {}),
      ...(open ? { refused: t('plan.statusNot') } : {}),
      ...(open && gate ? {
        holds: gate.items.map(({ item, ok }) => ({
          label: t(GATE_LABEL[item]), ok, hint: planGateHint(item, ok, reading),
          ...(ok ? {} : { onSelect: () => goTo(WAY_OF[item]) }),
        })),
      } : {}),
      onSelect: () => { if (status !== plan.status) set(statusPatch(plan, status, today)) },
    }
  })
  return <MenuButton label={said} menuLabel={t('roadmap.status')} items={items} size="small" data-guide="plan.status" />
}

/**
 * The plan's next step, in the band under the head where every record has it: the
 * move forward as the accent button, held while anything holds it, each hold a way
 * to where it is cleared. The status menu still offers every other move.
 */
export function PlanNext({ plan, model, decisions, today, describe, set, goTo }: StatusProps) {
  const { t } = useStrings()
  const [next] = [...gatesFor(plan, model, decisions, today, describe).values()]
  if (!next) return null
  const open = openPlanItems(next)
  const to = t(STATUS_LABEL[next.to])
  return (
    <span data-testid="plan-standing">
      <NextStep
        inline
        question={open.length === 0 ? t('plan.ready', { status: to }) : t(open.length === 1 ? 'plan.holdsOne' : 'plan.holds', { count: open.length, status: to })}
        actions={[{ label: t('plan.moveTo', { status: to }), primary: true, held: open.length > 0, onPress: () => set(statusPatch(plan, next.to, today)), testId: 'plan-move-next' }]}
        holds={open.map((item) => ({ label: t(GATE_LABEL[item]), onPress: () => goTo(WAY_OF[item]) }))}
      />
    </span>
  )
}

/**
 * A row while it is a form of more than one field: leaving it keeps what it says,
 * a press outside it does too, and Escape goes back to the row. What it holds
 * writes as it is changed or on `onLeave`, the form's to choose.
 */
export function PressedForm({ onClose, onLeave, children }: { onClose: () => void; onLeave?: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const closing = useRef({ onClose, onLeave })
  closing.current = { onClose, onLeave }
  useEffect(() => {
    const press = (event: PointerEvent) => {
      const target = event.target as Element | null
      // A list a field opened is drawn elsewhere and still belongs to the form.
      if (box.current?.contains(target) || target?.closest?.('[role="presentation"], [role="dialog"], [role="listbox"]')) return
      closing.current.onLeave?.()
      closing.current.onClose()
    }
    document.addEventListener('pointerdown', press, true)
    return () => document.removeEventListener('pointerdown', press, true)
  }, [])
  return (
    <div
      ref={box} className="plan-form"
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
        else if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') { event.preventDefault(); onLeave?.(); onClose() }
      }}
    >
      {children}
    </div>
  )
}

/** From and To. A window typed backwards is not written: it stays on screen as it was, and says why in place. */
function WindowForm({ plan, set, onClose }: { plan: Transition; set: StatusProps['set']; onClose: () => void }) {
  const { t } = useStrings()
  const [backwards, setBackwards] = useState(false)
  const setWindow = (patch: Pick<Transition, 'from'> | Pick<Transition, 'to'>) => {
    const from = 'from' in patch ? patch.from : plan.from
    const to = 'to' in patch ? patch.to : plan.to
    if (from && to && to < from) { setBackwards(true); return }
    setBackwards(false)
    set(patch)
  }
  const wrong = backwards || Boolean(plan.from && plan.to && plan.to < plan.from)
  return (
    <PressedForm onClose={onClose}>
      <span className="plan-window">
        <DateInput autoFocus aria-label={t('roadmap.planFrom')} value={plan.from ?? ''} onChange={(value) => setWindow({ from: value || undefined })} />
        <DateInput aria-label={t('roadmap.planTo')} aria-invalid={wrong || undefined} value={plan.to ?? ''} onChange={(value) => setWindow({ to: value || undefined })} />
      </span>
      {wrong && <p className="plan-refused" role="alert">{t('plan.windowBackwards')}</p>}
    </PressedForm>
  )
}

export function PlanStatusLine(props: StatusProps & { editing: string | undefined; onEditing: (row: string | undefined) => void; initiative: boolean }) {
  const { plan, readOnly, set, editing, onEditing, initiative } = props
  const { t } = useStrings()
  const names = usePersonNames()
  const windowWords = useWindowWords()
  return (
    <div className="plan-status">
      <StatusControl {...props} />
      <PropertyRows line readOnly={readOnly} editing={editing} onEditing={onEditing}>
        <PropertyRow
          rowId="window" label={t('plan.window')} value={windowWords(plan)}
          edit={(editor) => <WindowForm plan={plan} set={set} onClose={editor.cancel} />}
        />
        <PropertyRow
          rowId="owner" label={t('roadmap.owner')} value={names.text(plan.owner)} empty={t('plan.noOwner')}
          edit={(editor) => (
            <PressedForm onClose={editor.cancel}>
              <span className="plan-form__grow">
                <PersonRefField
                  value={plan.owner} names={names} label={t('roadmap.owner')} disabled={readOnly}
                  onChange={(owner) => set({ owner })} testId="plan-owner" inputTestId="plan-owner-text" s={t}
                />
              </span>
            </PressedForm>
          )}
        />
      </PropertyRows>
      {initiative && plan.initiative && <span className="plan-standing">{t('plan.initiativeOn')}</span>}
    </div>
  )
}

export function deleteAnswers(t: Translate, onCancel: () => void, onDelete: () => void): DialogAnswers {
  return { cancel: { onClick: onCancel, label: t('common.cancel') }, outcome: { onClick: onDelete, label: t('roadmap.delete'), danger: true } }
}
