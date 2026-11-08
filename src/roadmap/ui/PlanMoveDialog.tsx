// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Move this plan*: says what will move before it does, one step and one undo. A
 * slip is a common and important act and its reach was invisible; what stays where
 * it is, the days already set on interfaces, is said too.
 */
import { useState } from 'react'
import type { DesignModel, Transition } from '../../model'
import { formatDay } from '../../i18n/dates'
import { useStrings } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { PropertyRow, PropertyRows, TextField } from '../../widgets/kit/Field'
import { Segmented } from '../../widgets/kit/Segmented'
import { slipOf } from '../planReading'
import { useWindowWords } from './planWords'

export function PlanMoveDialog({ plan, model, onMove, onClose }: {
  plan: Transition
  model: Pick<DesignModel, 'elements'>
  onMove: (days: number) => void
  onClose: () => void
}) {
  const { t, language } = useStrings()
  const windowWords = useWindowWords()
  const [typed, setTyped] = useState('30')
  const [way, setWay] = useState<'later' | 'earlier'>('later')
  const count = Math.abs(Math.trunc(Number(typed)))
  const days = Number.isFinite(count) ? (way === 'later' ? count : -count) : 0
  const slip = slipOf(plan, model, days)
  const said = (day: string) => formatDay(day, language)
  return (
    <Dialog
      open size="m" title={t('plan.moveTitle')} onClose={onClose}
      actions={(
        <>
          <Button variant="quiet" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={days === 0} onClick={() => onMove(days)}>{t('plan.moveAct', { count })}</Button>
        </>
      )}
    >
      <div className="plan-form">
        <span className="plan-form__grow">
          <TextField label={t('roadmap.shiftDays')} type="number" min={1} autoFocus value={typed} onChange={setTyped} />
        </span>
        <Segmented
          label={t('plan.moveWay')} value={way} onChange={setWay}
          options={[{ value: 'later', label: t('plan.later') }, { value: 'earlier', label: t('plan.earlier') }]}
        />
      </div>
      <h3 className="plan-note">{t('plan.whatMoves')}</h3>
      <PropertyRows readOnly>
        <PropertyRow label={t('plan.window')} value={t('plan.windowBecomes', { was: windowWords(plan), now: windowWords(slip) })} />
        <PropertyRow
          label={t('roadmap.milestones')}
          value={slip.lastMilestone ? t('plan.moveMilestones', { count: slip.milestones, day: said(slip.lastMilestone) }) : t('plan.moveNone')}
        />
        <PropertyRow
          label={t('plan.moveElements')}
          value={slip.elements.length > 0
            ? slip.elements.map((one) => t(one.phase === 'live' ? 'plan.goesLive' : 'plan.goesGone', { name: one.name, day: said(one.day) })).join('; ')
            : t('plan.moveNone')}
        />
        <PropertyRow label={t('plan.units')} value={slip.units > 0 ? t('plan.moveUnits', { count: slip.units }) : t('plan.moveNone')} />
      </PropertyRows>
      <p className="plan-note">{t('plan.moveStays')}</p>
    </Dialog>
  )
}
