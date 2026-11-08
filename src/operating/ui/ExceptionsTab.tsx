// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where reality differs: every place that says otherwise than the model, with the
 * default it departs from, read and put back from one list. Where many say the
 * same it says so: then the model is what to change, and that is asked first,
 * since it can move lines for many units, and is one step with one undo.
 */
import { useMemo, useState } from 'react'
import { linesSaid, linesWith } from '../../model/operatingModel'
import type { Command } from '../../model/commands'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { FilterWords } from '../../widgets/kit/FilterWords'
import { List } from '../../widgets/kit/List'
import type { ListColumn } from '../../widgets/kit/List'
import { useDensity } from '../../widgets/kit/density'
import { FRESH_VIEW, listed } from '../../widgets/kit/listView'
import type { ListView } from '../../widgets/kit/listView'
import { Preview, PreviewFact } from '../../widgets/kit/Preview'
import { moveLineToRole, setReportsTo } from '../edit'
import type { OperatingModel } from '../edit'
import { manySayTheSame } from '../exceptions'
import type { ManySay } from '../exceptions'
import type { OutsideTheModel } from '../organisationFacts'
import { ListMore } from '../../widgets/kit/ListMore'
import { ReaderActions } from './ReaderParts'
import { roleNamed } from './reading'

/** Who says otherwise, in words. */
function whoWords(one: OutsideTheModel, model: OperatingModel, t: Translate): string {
  switch (one.on) {
    case 'type': return t('operating.exByType', { type: model.unitTypes.find((type) => type.id === one.typeId)?.name ?? one.typeId ?? '' })
    case 'unit': return t('operating.exByUnit', { unit: one.unitName ?? '' })
    case 'holder': return t('operating.exByHolder', { holder: one.holder ?? '', unit: one.unitName ?? '' })
    case 'outside': return t('operating.exOutside', { holder: one.holder ?? '', unit: one.unitName ?? '' })
  }
}

/** The reader's title: the role, and where it is said otherwise, since *Lead* alone could be any of them. */
function titleOf(one: OutsideTheModel, model: OperatingModel, t: Translate): string {
  const role = roleNamed(model.roles, one.roleId)
  const where = one.on === 'type' ? model.unitTypes.find((type) => type.id === one.typeId)?.name : one.unitName
  return where ? t('operating.exTitle', { role, where }) : role
}

const saysWords = (one: OutsideTheModel, model: OperatingModel, t: Translate) => {
  if (one.on === 'outside') return roleNamed(model.roles, one.roleId)
  if (one.saysRole === undefined) return t('operating.byNestingCap')
  return one.saysUnit ? `${roleNamed(model.roles, one.saysRole)}, ${one.saysUnit}` : roleNamed(model.roles, one.saysRole)
}

const insteadWords = (one: OutsideTheModel, model: OperatingModel, t: Translate) => {
  if (one.on === 'outside') return '—'
  return one.departsFrom !== undefined ? roleNamed(model.roles, one.departsFrom) : t('operating.byNesting')
}

export function ExceptionsTab({ model, exceptions, readOnly, dispatch, onBackBelow, onOpenRole, onOpenType, onOpenUnit, selected, onSelect }: {
  model: OperatingModel; exceptions: readonly OutsideTheModel[]; readOnly: boolean; dispatch(command: Command): void
  /** Puts a unit's or a holder's own line back, where it is kept. */
  onBackBelow: ((one: OutsideTheModel) => void) | undefined
  onOpenRole(id: string): void
  onOpenType(id: string): void
  onOpenUnit: ((unit: { id: string; scope: string }) => void) | undefined
  selected: string | undefined
  onSelect(key: string | undefined): void
}) {
  const { t, language } = useStrings()
  const [view, setView] = useState<ListView>(FRESH_VIEW)
  const [density, setDensity] = useDensity()
  const [asking, setAsking] = useState<ManySay | undefined>(undefined)
  const wanted = view.filters.kind?.length ? view : { ...view, filters: { ...view.filters, kind: ['solid'] } }
  const columnsAll: readonly ListColumn[] = useMemo(() => [
    { id: 'who', label: t('operating.exWho'), sortable: true },
    { id: 'says', label: t('operating.exSays'), sortable: true },
    { id: 'instead', label: t('operating.exInstead'), sortable: true },
    { id: 'units', label: t('operating.exUnits'), sortable: true, width: '5em' },
  ], [t])
  const rows = useMemo(() => listed(exceptions, wanted, {
    words: (one) => [roleNamed(model.roles, one.roleId), whoWords(one, model, t), saysWords(one, model, t), insteadWords(one, model, t)],
    filterBy: { kind: (one) => one.kind, on: (one) => one.on },
    sortBy: {
      item: (one) => roleNamed(model.roles, one.roleId), who: (one) => whoWords(one, model, t), says: (one) => saysWords(one, model, t),
      instead: (one) => insteadWords(one, model, t), units: (one) => one.units,
    },
    language,
  }), [exceptions, wanted, model, t, language])
  const ids = rows.flatMap((group) => group.rows.map((one) => one.key))
  const open = exceptions.find((one) => one.key === selected)
  const many = manySayTheSame(exceptions.filter((one) => one.kind === 'solid'))
  const canBack = (one: OutsideTheModel) => !readOnly && (one.on === 'type' || (onBackBelow !== undefined && (one.on === 'unit' || one.on === 'holder')))
  const back = (one: OutsideTheModel) => {
    if (one.on === 'type') {
      const type = model.unitTypes.find((held) => held.id === one.typeId)
      const slot = type?.slots[one.slotIndex ?? -1]
      if (type && slot) dispatch(setReportsTo(type, one.slotIndex as number, linesWith(linesSaid(slot.reportsTo), one.kind, undefined)).command)
    } else onBackBelow?.(one)
    onSelect(undefined)
  }
  const toRole = () => {
    const role = model.roles.find((one) => one.id === asking?.roleId)
    if (role && asking) dispatch(moveLineToRole(model, role, asking.line))
    setAsking(undefined)
  }
  return (
    <>
      <p className="op-concept" data-testid="operating-exceptions-intro">{t('operating.exIntro', { count: exceptions.length })}</p>
      {!readOnly && many.map((one) => {
        const role = roleNamed(model.roles, one.roleId)
        const was = linesSaid(model.roles.find((held) => held.id === one.roleId)?.reportsTo).find((line) => line.kind === one.kind)
        return (
          <div className="op-suggest" key={`${one.roleId}/${one.saysRole}`} data-testid="operating-many-say">
            <p>{t('operating.exMany', { role, types: one.types, units: one.units, says: roleNamed(model.roles, one.saysRole), was: was?.role !== undefined ? roleNamed(model.roles, was.role) : t('operating.byNesting') })}</p>
            <Button variant="plain" onClick={() => setAsking(one)}>{t('operating.changeTheRole')}</Button>
          </div>
        )
      })}
      <FilterWords
        find={view.find} onFind={(find) => setView({ ...view, find })} findLabel={t('operating.exFind')}
        fields={[
          { id: 'kind', label: t('operating.lineKind'), options: [{ value: 'solid', label: t('operating.lineSolid') }, { value: 'dotted', label: t('operating.lineDotted') }] },
          { id: 'on', label: t('operating.exWho'), options: [
            { value: 'type', label: t('operating.exOnType') }, { value: 'unit', label: t('operating.exOnUnit') },
            { value: 'holder', label: t('operating.exOnHolder') }, { value: 'outside', label: t('operating.exOnOutside') },
          ] },
        ]}
        filters={view.filters} onFilters={(filters) => setView({ ...view, filters })}
        density={density} onDensity={setDensity} onReset={() => setView(FRESH_VIEW)}
        shown={{ count: ids.length, total: exceptions.length }} dataGuide="operating.exceptionsBar"
      />
      <List
        label={t('operating.tabExceptions')} density={density} dataGuide="operating.exceptions" itemLabel={t('operating.role')} itemSortable
        columns={columnsAll} sort={view.sort} onSort={(sort) => setView({ ...view, sort })}
        selectedId={selected ?? null} onOpen={onSelect}
        groups={rows.map((group) => ({
          id: group.id, label: group.label,
          rows: group.rows.map((one) => ({
            id: one.key, text: roleNamed(model.roles, one.roleId),
            cells: { who: whoWords(one, model, t), says: saysWords(one, model, t), instead: insteadWords(one, model, t), units: one.units },
          })),
        }))}
        empty={<p className="op-quiet">{t('operating.exNone')}</p>}
      />
      {/* Solid lines come first; what that leaves out is a press away, not a filter to find. */}
      {!view.filters.kind?.length && ids.length < exceptions.length && (
        <ListMore said={t('operating.exSolidFirst')} data-testid="operating-ex-more">
          <Button variant="quiet" size="small" onClick={() => setView({ ...view, filters: { ...view.filters, kind: ['solid', 'dotted'] } })}>{t('operating.exShowAll', { count: exceptions.length })}</Button>
        </ListMore>
      )}
      <p className="op-small">{t('operating.exFootnote')}</p>
      <Preview
        ids={ids} currentId={open ? open.key : null} onSelect={(id) => onSelect(id ?? undefined)} title={open ? titleOf(open, model, t) : ''}
        listWord={t('operating.exWord')}
        facts={open && (
          <>
            <PreviewFact label={t('operating.exWho')}>{whoWords(open, model, t)}</PreviewFact>
            <PreviewFact label={t('operating.exSays')}>{saysWords(open, model, t)}</PreviewFact>
            <PreviewFact label={t('operating.exInstead')}>{insteadWords(open, model, t)}</PreviewFact>
            <PreviewFact label={t('operating.exUnits')}>{open.units}</PreviewFact>
          </>
        )}
        foot={open && (
          // Back to default takes the exception away: the far end, alone, as Remove is on every other reader here.
          <ReaderActions away={canBack(open) && <Button variant="danger" data-testid="operating-back-to-default" onClick={() => back(open)}>{t('operating.backToDefault')}</Button>}>
            {open.on === 'type' && open.typeId && <Button variant="plain" onClick={() => onOpenType(open.typeId as string)}>{t('operating.openType')}</Button>}
            {open.unitId && onOpenUnit && <Button variant="plain" onClick={() => onOpenUnit({ id: open.unitId as string, scope: open.scope ?? '' })}>{t('operating.openInOrganisation')}</Button>}
            <Button variant="plain" onClick={() => onOpenRole(open.roleId)}>{t('operating.openRole')}</Button>
          </ReaderActions>
        )}
      >
        {open && <p>{t(open.on === 'outside' ? 'operating.exWhyOutside' : 'operating.exWhy')}</p>}
      </Preview>
      <Dialog
        open={asking !== undefined} onClose={() => setAsking(undefined)} title={t('operating.changeTheRole')} size="s"
        actions={<><Button variant="plain" onClick={() => setAsking(undefined)}>{t('operating.cancel')}</Button><Button variant="primary" data-testid="operating-change-role-confirm" onClick={toRole}>{t('operating.changeTheRole')}</Button></>}
      >
        {asking && <p>{t('operating.changeRoleAsk', { role: roleNamed(model.roles, asking.roleId), says: roleNamed(model.roles, asking.saysRole), units: asking.units })}</p>}
      </Dialog>
    </>
  )
}
