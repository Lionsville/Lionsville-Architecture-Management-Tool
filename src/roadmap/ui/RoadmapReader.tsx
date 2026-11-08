// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a press on a row opens beside the axis, in the one Panel: the axis stays
 * in view with the related rows picked out, and *Open plan* or *Open on the board*
 * is the second press. Whole names and dates are read here, since a row cuts them.
 */
import type { ReactNode } from 'react'
import { isDay, portProgress, RELATION_LABEL, transitionLabel } from '../../model'
import type { DesignElement, DesignModel, Transition } from '../../model'
import { KIND_LABEL_KEYS } from '../../model/kinds'
import type { Finding } from '../../model/checks'
import { formatDay } from '../../i18n/dates'
import { useStrings } from '../../i18n'
import type { StringKey } from '../../i18n'
import { usePersonNames } from '../../people/ui/names'
import { Button } from '../../widgets/kit/Button'
import { MenuButton } from '../../widgets/kit/Menu'
import { Panel, PanelSection } from '../../widgets/kit/Panel'
import { PropertyRow, PropertyRows } from '../../widgets/kit/Field'
import { PLAN_STATUS_LABEL } from '../labels'
import type { RelationTrack } from '../timeline'
import { findingWords } from './FindingSentence'
import { useWindowWords } from './planWords'
import type { Initiative, RoadmapActions } from './RoadmapPage'
import { PANEL_HELP } from '../../platform/helpPlaces'

const PHASES = ['live', 'retiring', 'retired'] as const

function Foot({ children }: { children: ReactNode }) {
  return <div className="roadmap-readerfoot">{children}</div>
}

function PlanFacts({ plan }: { plan: Transition }) {
  const { t } = useStrings()
  const names = usePersonNames()
  const windowWords = useWindowWords()
  const owner = names.text(plan.owner)
  return (
    <>
      {t(PLAN_STATUS_LABEL[plan.status])}. {windowWords(plan)}
      {owner && `, ${t('plan.ownedBy', { name: owner })}`}.
    </>
  )
}

function Milestones({ plan }: { plan: Transition }) {
  const { t, language } = useStrings()
  const dated = plan.milestones.filter((one) => isDay(one.date)).sort((a, b) => a.date.localeCompare(b.date))
  if (dated.length === 0) return null
  return (
    <PanelSection title={t('roadmap.milestones')}>
      <PropertyRows readOnly>
        {dated.map((one, at) => <PropertyRow key={at} label={formatDay(one.date, language)} value={one.name} />)}
      </PropertyRows>
    </PanelSection>
  )
}

function WhatItChanges({ plan, model }: { plan: Transition; model: DesignModel }) {
  const { t } = useStrings()
  if (plan.elements.length === 0) return null
  const name = (id: string) => model.elements.find((one) => one.id === id)?.name ?? t('plan.goneElement')
  const progress = portProgress(model, plan)
  return (
    <PanelSection title={t('roadmap.touches')}>
      <PropertyRows readOnly>
        {plan.elements.map((one) => <PropertyRow key={one.elementId} label={t(`plan.${one.role}` as StringKey)} value={name(one.elementId)} />)}
      </PropertyRows>
      {progress.total > 0 && <p className="roadmap-quiet">{t('roadmap.planPorted', { done: String(progress.done), total: String(progress.total) })}</p>}
    </PanelSection>
  )
}

function FindingsAbout({ about }: { about: readonly Finding[] }) {
  const { t, language } = useStrings()
  if (about.length === 0) return null
  return (
    <PanelSection title={t('check.title')}>
      {about.map((problem) => <p key={`${problem.kind}-${problem.id}`} className="roadmap-readerline">{findingWords(problem, t, language)}</p>)}
    </PanelSection>
  )
}

export function PlanReader({ plan, model, about, actions, onClose }: {
  plan: Transition; model: DesignModel; about: readonly Finding[]; actions: RoadmapActions; onClose: () => void
}) {
  const { t, language } = useStrings()
  const days = plan.milestones.filter((one) => isDay(one.date))
  return (
    <Panel helpAt={PANEL_HELP.roadmap} kind={transitionLabel(plan)} name={plan.title} facts={<PlanFacts plan={plan} />} onClose={onClose} wide>
      <Milestones plan={plan} />
      <WhatItChanges plan={plan} model={model} />
      <FindingsAbout about={about} />
      <Foot>
        <Button variant="primary" onClick={() => actions.onOpenPlan(plan.id)}>{t('roadmap.openPlan')}</Button>
        {days.length > 0 && (
          <MenuButton
            label={t('roadmap.showBoardOn')}
            items={days.map((one) => ({ label: `${formatDay(one.date, language)} ${one.name}`, onSelect: () => actions.setAsOf(one.date) }))}
          />
        )}
      </Foot>
    </Panel>
  )
}

export function ElementReader({ element, below, plans, about, actions, onClose, onPick }: {
  element: DesignElement
  /** Brought by an initiative: said, and opened where it is kept. */
  below: { scope: string; label: string; planId: string } | undefined
  plans: readonly Transition[]
  about: readonly Finding[]
  actions: RoadmapActions
  onClose: () => void
  onPick: (id: string) => void
}) {
  const { t, language } = useStrings()
  const dates = element.lifecycleDates
  return (
    <Panel helpAt={PANEL_HELP.roadmap} kind={t(KIND_LABEL_KEYS[element.kind])} name={element.name} onClose={onClose} wide>
      <PanelSection title={t('roadmap.status')}>
        <PropertyRows readOnly>
          {PHASES.filter((phase) => isDay(dates?.[phase])).map((phase) => (
            <PropertyRow key={phase} label={t(`plan.date.${phase}` as StringKey)} value={formatDay(dates![phase]!, language)} />
          ))}
        </PropertyRows>
      </PanelSection>
      {plans.length > 0 && (
        <PanelSection title={t('roadmap.namedBy')}>
          {plans.map((plan) => (
            <p key={plan.id} className="roadmap-readerline">
              <button type="button" className="roadmap-link" onClick={() => onPick(plan.id)}>{transitionLabel(plan)} {plan.title}</button>
            </p>
          ))}
        </PanelSection>
      )}
      <FindingsAbout about={about} />
      <Foot>
        {below
          ? <Button variant="primary" onClick={() => actions.onOpenElsewhere?.(below.scope, below.planId)}>{t('roadmap.openInitiative', { scope: below.label })}</Button>
          : <Button variant="primary" onClick={() => actions.onOpenElement(element.id)}>{t('roadmap.showOnBoard')}</Button>}
      </Foot>
    </Panel>
  )
}

export function ConnectionReader({ track, about, actions, onClose }: { track: RelationTrack; about: readonly Finding[]; actions: RoadmapActions; onClose: () => void }) {
  const { t, language } = useStrings()
  const { relation, sourceName, targetName } = track
  return (
    <Panel helpAt={PANEL_HELP.roadmap} kind={t('roadmap.connection')} name={relation.label || t('roadmap.connectionName', { from: sourceName, to: targetName })} onClose={onClose} wide>
      <PropertyRows readOnly>
        <PropertyRow label={t('roadmap.planFrom')} value={sourceName} />
        <PropertyRow label={t('roadmap.planTo')} value={targetName} />
        <PropertyRow label={t('roadmap.connectionType')} value={t(RELATION_LABEL[relation.type])} />
        {isDay(relation.validFrom) && <PropertyRow label={t('roadmap.planFrom')} value={formatDay(relation.validFrom, language)} />}
        {isDay(relation.validUntil) && <PropertyRow label={t('roadmap.planTo')} value={formatDay(relation.validUntil, language)} />}
      </PropertyRows>
      <FindingsAbout about={about} />
      <Foot>
        <Button variant="primary" onClick={() => actions.onOpenElement(relation.sourceId)}>{t('roadmap.showOnBoard')}</Button>
      </Foot>
    </Panel>
  )
}

export function InitiativeReader({ initiative, canOpen, actions, onClose }: { initiative: Initiative; canOpen: boolean; actions: RoadmapActions; onClose: () => void }) {
  const { t } = useStrings()
  const { plan, label, scope } = initiative
  return (
    <Panel helpAt={PANEL_HELP.roadmap} kind={`${t('roadmap.initiative')} · ${transitionLabel(plan)}`} name={plan.title} facts={<PlanFacts plan={plan} />} status={t('roadmap.inScope', { scope: label })} onClose={onClose} wide>
      <Milestones plan={plan} />
      {canOpen && (
        <Foot>
          <Button variant="primary" onClick={() => actions.onOpenElsewhere?.(scope, plan.id)}>{t('roadmap.openInitiative', { scope: label })}</Button>
        </Foot>
      )}
    </Panel>
  )
}
