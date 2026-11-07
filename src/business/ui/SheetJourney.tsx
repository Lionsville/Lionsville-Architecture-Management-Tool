// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The journey: its own calm band, one line until asked and fit to the width when
 * opened. Its phases are not the areas' columns, because lined up they suggested a
 * link between them that does not exist.
 */
import type { CSSProperties } from 'react'
import type { DesignElement, ElementId } from '../../model'
import type { Translate } from '../../i18n'
import { CaretIcon } from '../../widgets/icons'
import { Button } from '../../widgets/kit/Button'
import type { SheetJourney, SheetLane, SheetStep } from '../sheet'
import type { Author } from './SheetAuthor'

/** The lane column's width: a stakeholder's name, wrapped. */
const LANE_LABEL = 'minmax(96px, 136px)'

function Step({ step, selected, onSelect, t }: { step: SheetStep; selected: boolean; onSelect(id: ElementId): void; t: Translate }) {
  return (
    <button
      type="button" className="sheet-step" data-testid={`sheet-step-${step.element.id}`} data-element-id={step.element.id}
      data-outside={step.outside || undefined} data-selected={selected || undefined}
      aria-label={step.outside ? t('sheet.outsideStep', { name: step.element.name }) : step.element.name}
      onClick={() => onSelect(step.element.id)}
    >
      {step.element.name}
    </button>
  )
}

function Lane({ lane, phases, first, selectedId, onSelect, author, t }: {
  lane: SheetLane
  phases: readonly DesignElement[]
  first: boolean
  selectedId: ElementId | undefined
  onSelect(id: ElementId): void
  author: Author | undefined
  t: Translate
}) {
  const name = lane.actor?.name ?? (first ? t('sheet.commonLane') : lane.actorId ?? '')
  const key = lane.actorId ?? 'common'
  return (
    <div className="sheet-lane" data-testid={`sheet-lane-${key}`}>
      <div className="sheet-lane__label">{name}{lane.actor?.outside ? ` ${t('sheet.outsideWord')}` : ''}</div>
      {lane.cells.map((cell, index) => (
        <div className="sheet-lane__cell" key={cell.phaseId} data-testid={`sheet-cell-${key}-${cell.phaseId}`}>
          {cell.steps.map((step) => <Step key={step.element.id} step={step} selected={selectedId === step.element.id} onSelect={onSelect} t={t} />)}
          {cell.passThrough && <span className="sheet-lane__above" data-testid={`sheet-passthrough-${key}-${cell.phaseId}`}>{t('sheet.asAbove')}</span>}
          {author && (
            <button
              type="button" className="sheet-lane__add" data-sheet-add
              aria-label={t('sheet.addStepTo', { phase: phases[index]?.name ?? cell.phaseId, lane: name })}
              onClick={() => author.made(author.actions.addElement({
                kind: 'step', name: t('sheet.nameStep'), parentId: cell.phaseId,
                ...(lane.actorId !== undefined ? { lane: lane.actorId } : {}),
              }))}
            >{t('sheet.addStep')}</button>
          )}
        </div>
      ))}
    </div>
  )
}

export function JourneyBand({ journey, open, onOpen, selectedId, onSelect, onNewLane, author, t }: {
  journey: SheetJourney
  open: boolean
  onOpen(open: boolean): void
  selectedId: ElementId | undefined
  onSelect(id: ElementId): void
  onNewLane(): void
  author: Author | undefined
  t: Translate
}) {
  const steps = journey.lanes.reduce((sum, lane) => sum + lane.cells.reduce((inLane, cell) => inLane + cell.steps.length, 0), 0)
  const columns = { gridTemplateColumns: `${LANE_LABEL} repeat(${journey.phases.length}, minmax(96px, 1fr))` } as CSSProperties
  return (
    <div className="sheet-journey" data-testid="sheet-journey">
      <div className="sheet-journey__line">
        <button type="button" className="sheet-row__caret" aria-expanded={open} aria-label={t(open ? 'sheet.fold' : 'sheet.unfold', { name: journey.element.name })} data-sheet-add onClick={() => onOpen(!open)}>
          <CaretIcon />
        </button>
        <button type="button" className="sheet-page__link sheet-journey__name" data-element-id={journey.element.id} onClick={() => onSelect(journey.element.id)}>{journey.element.name}</button>
        {!open && <span className="sheet-journey__phases" title={journey.phases.map((phase) => phase.name).join(' · ')}>{journey.phases.map((phase) => phase.name).join(' · ')}</span>}
        <span className="sheet-journey__sum">{t('sheet.journeySum', { phases: journey.phases.length, steps, lanes: Math.max(0, journey.lanes.length - 1) })}</span>
      </div>
      {open && (
        <>
          <div className="sheet-journey__grid" style={columns}>
            <span />
            {journey.phases.map((phase) => (
              <button
                type="button" key={phase.id} className="sheet-phase" title={phase.name} data-testid={`sheet-phase-${phase.id}`} data-element-id={phase.id}
                data-selected={selectedId === phase.id || undefined} onClick={() => onSelect(phase.id)}
              >{phase.name}</button>
            ))}
            {journey.lanes.map((lane, index) => (
              <Lane key={lane.actorId ?? 'common'} lane={lane} phases={journey.phases} first={index === 0} selectedId={selectedId} onSelect={onSelect} author={author} t={t} />
            ))}
          </div>
          {author && (
            <div className="sheet-adds" data-sheet-add>
              <Button
                variant="quiet" size="small" aria-label={t('sheet.addPhaseTo', { name: journey.element.name })}
                onClick={() => author.made(author.actions.addElement({ kind: 'step', name: t('sheet.namePhase'), parentId: journey.element.id }))}
              >{t('sheet.addPhase')}</Button>
              <Button variant="quiet" size="small" onClick={onNewLane}>{t('sheet.addLane')}</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
