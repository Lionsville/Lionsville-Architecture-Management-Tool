// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** A responsibility read: what it is, its group, who has a part, and where it stands among its group's. */
import { useId } from 'react'
import { dutyOf, inOwnOrder } from '../../model/operatingModel'
import type { Responsibility } from '../../model/operatingModel'
import { useStrings } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import { PropertyRow, PropertyRows } from '../../widgets/kit/Field'
import { PanelSection } from '../../widgets/kit/Panel'
import { editResponsibility, moveResponsibility } from '../edit'
import { groupsOf } from '../matrixView'
import { Prose, readerFoot, SourceWord, stackedFrame } from './ReaderParts'
import type { ReaderFrame, ReaderParts } from './ReaderParts'
import { DutyLine } from './dutyWords'
import { partWords } from './reading'
import { claimKey } from '../../widgets/kit/keys'

export function ResponsibilityReader({ responsibility, parts, frame = stackedFrame }: { responsibility: Responsibility; parts: ReaderParts; frame?: ReaderFrame }) {
  const { t } = useStrings()
  const { model, readOnly, dispatch } = parts
  const groupsId = useId()
  const group = responsibility.group?.trim() ?? ''
  const mates = inOwnOrder(model.responsibilities).filter((one) => (one.group?.trim() ?? '') === group)
  const at = mates.findIndex((one) => one.id === responsibility.id)
  const up = moveResponsibility(model, responsibility.id, -1)
  const down = moveResponsibility(model, responsibility.id, 1)
  const parties = inOwnOrder(model.roles).flatMap((role) => {
    const duty = dutyOf(role, responsibility.id)
    return duty ? [{ role, duty }] : []
  })
  // Its group, its place among the group's and where it came from: the facts beside the text.
  const facts = (
    <>
      <PropertyRows readOnly={readOnly}>
        <PropertyRow
          label={t('operating.group')} value={responsibility.group ?? ''} empty={t('operating.noGroup')}
          // Offers the groups there are, and allows a new one: a typing slip no longer makes one unseen.
          edit={(editor) => (
            <>
              <input {...editor.ties} list={groupsId} className="kit-input" value={editor.value} onChange={(event) => editor.onChange(event.target.value)}
                onBlur={() => editor.commit()} onKeyDown={(event) => { if (event.key === 'Enter') editor.commit(); else if (event.key === 'Escape') { claimKey(event); editor.cancel() } }} />
              <datalist id={groupsId}>{groupsOf(model.responsibilities).filter(Boolean).map((one) => <option key={one} value={one} />)}</datalist>
            </>
          )}
          onCommit={(value) => dispatch(editResponsibility(responsibility.id, 'group', value))}
        />
      </PropertyRows>
      <div className="op-rowEnd">
        <span>{t('operating.responsibilityOrderAt', { place: at + 1, count: mates.length, group: group || t('operating.noGroup') })}</span>
        {!readOnly && (
          <span className="op-actions" data-guide="operating.responsibilityOrder">
            <Button variant="quiet" size="small" reason={up ? undefined : t('operating.orderFirst')} onClick={() => up && dispatch(up)}>{t('operating.orderUp')}</Button>
            <Button variant="quiet" size="small" reason={down ? undefined : t('operating.orderLast')} onClick={() => down && dispatch(down)}>{t('operating.orderDown')}</Button>
          </span>
        )}
      </div>
      <SourceWord basedOn={responsibility.basedOn} />
    </>
  )
  const body = (
    <div data-testid="operating-responsibility-reader">
      <Prose label={t('operating.description')} value={responsibility.description ?? ''} readOnly={readOnly} render={parts.renderMarkdown}
        onChange={(next) => dispatch(editResponsibility(responsibility.id, 'description', next))} testId="operating-description" />
      <PanelSection title={t('operating.whoHasPart')} aside={parties.length ? partWords(parties.map((one) => one.duty)) : undefined}>
        {parties.length === 0
          ? <span className="op-quiet">{t('operating.nobodyHasPart')}</span>
          : parties.map(({ role, duty }) => (
            <DutyLine key={role.id} duty={duty} t={t}><button type="button" className="op-link" onClick={() => parts.onSelect(role.id)}>{role.name}</button></DutyLine>
          ))}
      </PanelSection>
      {parts.aside}
    </div>
  )
  return frame({ body, facts, foot: readerFoot(parts) })
}
