// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *They should not depend on each other: plan it away…*: a plan of this scope,
 * or a new one, and what the interface joins put on it, so a mismatch does not
 * end at noticing. One step, and the plan opens. An application another scope
 * keeps is not put on a plan here; the sentence says it stays for the plan's
 * author to bring in.
 */
import type { Translate } from '../../i18n'
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import { nextTransitionNumber } from '../../model/transition'
import type { ElementId } from '../../model/types'
import { Dialog } from '../../widgets/kit/Dialog'
import { Picker } from '../../widgets/kit/Picker'
import type { UnitViewsHere } from './unitViewsHere'

export function ConwayPlanDialog({ ids, model, here, declare, onClose, onOpenPlan, t }: {
  ids: readonly ElementId[]
  model: HostModel
  here: UnitViewsHere
  declare: { dispatch: (command: Command) => unknown; newPlanId: () => string; planBody: () => string }
  onClose: () => void
  onOpenPlan?: ((id: string) => void) | undefined
  t: Translate
}) {
  const plans = (model.transitions ?? []).filter((plan) => plan.status !== 'done' && plan.status !== 'abandoned')
  const held = [...new Set(ids)].filter(here.heldHere)
  const elements = held.map((id) => ({ elementId: id, role: 'changes' as const }))
  const landed = (id: string) => { onClose(); onOpenPlan?.(id) }
  const toExisting = (id: string) => {
    const plan = plans.find((one) => one.id === id)
    if (!plan) return
    const known = new Set(plan.elements.map((one) => one.elementId))
    const added = elements.filter((one) => !known.has(one.elementId))
    if (added.length > 0) declare.dispatch({ type: 'transition.update', id, patch: { elements: [...plan.elements, ...added] } })
    landed(id)
  }
  const toNew = (title: string) => {
    const id = declare.newPlanId()
    declare.dispatch({
      type: 'transition.add',
      transition: { id, number: nextTransitionNumber(model.transitions ?? []), title, status: 'draft', elements, decisions: [], milestones: [], body: declare.planBody() },
    })
    landed(id)
  }
  return (
    <Dialog
      open size="s" title={t('conway.plan.title')} onClose={onClose}
      actions={{
        cancel: { onClick: onClose, label: t('common.cancel') },
      }}
    >
      <p className="conway__quiet">{t('conway.plan.about')}</p>
      <Picker
        autoFocus label={t('conway.plan.pick')} placeholder={t('conway.plan.pick')}
        options={plans.map((plan) => ({ id: plan.id, label: plan.title }))}
        onPick={(option) => toExisting(option.id)}
        onCreate={toNew} createLabel={(title) => t('conway.plan.new', { title })}
      />
    </Dialog>
  )
}
