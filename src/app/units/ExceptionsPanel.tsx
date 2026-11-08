// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Lines: Exceptions* as a list, beside the same picture: where the chart departs
 * from what the operating model says, each said in words, going to its unit when
 * pressed. A dotted line or an exception could only be seen one person at a time,
 * so *where do we depart from the model?* had no answer. Where one is true for
 * many people it is the model that should change, so the way there is said here.
 */
import type { Translate } from '../../i18n'
import { pickedPerson } from '../../model/person'
import type { Organisation } from '../../model/units'
import { personOf } from '../../model/units'
import type { ElementId } from '../../model/types'
import type { PersonNames } from '../../people/ui/names'
import { Panel, PanelSection } from '../../widgets/kit/Panel'
import type { ChartException } from './chartLines'
import { PANEL_HELP } from '../../platform/helpPlaces'

export function ExceptionsPanel({ exceptions, organisation, names, onGoTo, onOperating, onClose, t }: {
  exceptions: readonly ChartException[]; organisation: Organisation; names: PersonNames
  onGoTo: (unit: ElementId) => void
  /** The operating model, where this chart can reach it. */
  onOperating?: (() => void) | undefined
  onClose: () => void
  t: Translate
}) {
  const unit = (id: ElementId) => organisation.units.find((one) => one.id === id)?.name ?? id
  const role = (id: string) => organisation.roles.find((one) => one.id === id)?.name ?? id
  const lines = exceptions.filter((one) => one.kind === 'line')
  const placements = exceptions.filter((one) => one.kind === 'placement')
  return (
    <Panel helpAt={PANEL_HELP.exceptions}
      kind={t('chart.exceptionsKind')} name={t('chart.exceptionsTitle')} onClose={onClose} dataGuide="chart.exceptions"
      facts={t('chart.exceptionsLead', { count: exceptions.length })}
    >
      <div data-testid="chart-exceptions">
        {exceptions.length === 0 && <p className="chart-panel__lead">{t('chart.exceptionsNone')}</p>}
        {lines.length > 0 && (
          <PanelSection title={t('chart.exceptionsLines')}>
            {lines.map((one) => (
              <button key={one.key} type="button" className="chart-panel__item" data-testid="chart-exception" onClick={() => onGoTo(one.unitId)}>
                {t('chart.exceptionLine', { fromRole: role(one.roleId), from: unit(one.unitId), toRole: role(one.lands.roleId), to: unit(one.lands.unitId) })}
                <span className="chart-panel__sub">
                  {t(one.source === 'person' ? 'chart.lineOwnPerson' : 'chart.lineOwnUnitPlain')}{one.lineKind === 'dotted' ? ` · ${t('chart.exceptionDotted')}` : ''}
                </span>
              </button>
            ))}
          </PanelSection>
        )}
        {placements.length > 0 && (
          <PanelSection title={t('chart.exceptionsPlacements')}>
            {placements.map((one) => (
              <button key={one.key} type="button" className="chart-panel__item" data-testid="chart-exception" onClick={() => onGoTo(one.unitId)}>
                {t('chart.exceptionPlacement', { person: names.text(pickedPerson(personOf(one.assignment))), role: role(one.assignment.roleId), unit: unit(one.unitId) })}
                <span className="chart-panel__sub">{t('unit.exceptionPlacement', { role: role(one.assignment.roleId), unit: unit(one.unitId) })}</span>
              </button>
            ))}
          </PanelSection>
        )}
        {onOperating && (
          <PanelSection title={t('chart.exceptionsMany')}>
            <p className="chart-panel__lead">
              {t('chart.exceptionsManyLead')}{' '}
              <button type="button" className="chart-panel__link" onClick={onOperating}>{t('chart.addOpenOperating')}</button>
            </p>
          </PanelSection>
        )}
      </div>
    </Panel>
  )
}
