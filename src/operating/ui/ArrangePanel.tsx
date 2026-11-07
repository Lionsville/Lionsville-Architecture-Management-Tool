// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * All the reordering of the Responsibilities tab in one place, out of the reading
 * view: whether the grid goes in the organisation's own order or A to Z, and the
 * groups, the part's responsibilities and the role columns, each move one step.
 */
import { inOwnOrder, responsibilityGroups } from '../../model/operatingModel'
import type { Command } from '../../model/commands'
import { useStrings } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import { Panel, PanelSection } from '../../widgets/kit/Panel'
import { Segmented } from '../../widgets/kit/Segmented'
import { moveGroup, moveResponsibility, moveRole } from '../edit'
import type { OperatingModel } from '../edit'
import type { MatrixOrder } from '../matrixView'

function Row({ label, up, down, words, dispatch }: { label: string; up: Command | undefined; down: Command | undefined; words: readonly [string, string]; dispatch(command: Command): void }) {
  return (
    <div className="op-arrange__row">
      <span>{label}</span>
      <Button variant="quiet" size="small" aria-label={`${words[0]}: ${label}`} reason={up ? undefined : words[0]} onClick={() => up && dispatch(up)}>↑</Button>
      <Button variant="quiet" size="small" aria-label={`${words[1]}: ${label}`} reason={down ? undefined : words[1]} onClick={() => down && dispatch(down)}>↓</Button>
    </div>
  )
}

export function ArrangePanel({ model, order, onOrder, part, dispatch, onClose, readOnly }: {
  model: OperatingModel; order: MatrixOrder; onOrder(order: MatrixOrder): void; part: string | undefined; dispatch(command: Command): void; onClose(): void; readOnly: boolean
}) {
  const { t } = useStrings()
  const groups = responsibilityGroups(inOwnOrder(model.responsibilities)).filter((one) => one.group !== '')
  const mates = inOwnOrder(model.responsibilities).filter((one) => part === undefined || (one.group?.trim() ?? '') === part)
  const up = t('operating.orderUp')
  const down = t('operating.orderDown')
  return (
    <Panel kind={t('operating.arrange')} name={t('operating.arrangeName')} onClose={onClose} dataGuide="operating.arrange">
      <Segmented
        label={t('operating.matrixOrder')} value={order} onChange={onOrder} data-guide="operating.matrixOrder"
        options={[{ value: 'own', label: t('operating.orderOwn') }, { value: 'name', label: t('operating.orderName') }]}
      />
      {!readOnly && order === 'own' && (
        <>
          <PanelSection title={t('operating.arrangeGroups')}>
            <div className="op-arrange" data-guide="operating.groupOrder">
              {groups.map(({ group }) => <Row key={group} label={group} up={moveGroup(model, group, -1)} down={moveGroup(model, group, 1)} words={[t('operating.groupUp', { group }), t('operating.groupDown', { group })]} dispatch={dispatch} />)}
            </div>
          </PanelSection>
          <PanelSection title={part !== undefined ? t('operating.arrangeRowsIn', { part: part || t('operating.noGroup') }) : t('operating.arrangeRows')}>
            <div className="op-arrange" data-guide="operating.responsibilityOrder">
              {mates.map((one) => <Row key={one.id} label={one.name} up={moveResponsibility(model, one.id, -1)} down={moveResponsibility(model, one.id, 1)} words={[up, down]} dispatch={dispatch} />)}
            </div>
          </PanelSection>
          <PanelSection title={t('operating.arrangeColumns')}>
            <div className="op-arrange" data-guide="operating.roleOrder">
              {inOwnOrder(model.roles).map((one) => <Row key={one.id} label={one.name} up={moveRole(model, one.id, -1)} down={moveRole(model, one.id, 1)} words={[t('operating.orderLeft'), t('operating.orderRight')]} dispatch={dispatch} />)}
            </div>
          </PanelSection>
        </>
      )}
    </Panel>
  )
}
