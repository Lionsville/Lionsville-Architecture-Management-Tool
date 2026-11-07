// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What kinds of unit are there: the unit types drawn as the structure they make
 * (ADR-0036, amended 11 October 2026), by level, how deep a unit of the type can
 * sit. Picking a card lights where it may sit, what may sit in it and its roles;
 * picking a role lights the types that hold it and draws its reporting lines; the
 * rest dims, and pressing the pick again lets it go. A type that sits nowhere and a
 * role in no type are said under it in a line, and listed once there are any.
 */
import { useMemo, useState } from 'react'
import type { Role, RoleId, UnitType, UnitTypeId } from '../../model/operatingModel'
import { unitTypeLanes } from '../../model/unitOrder'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import type { Command } from '../../model/commands'
import type { MakeId } from '../../model/keys'
import { itemOf, newRole, newUnitType } from '../edit'
import type { CommandOf, OperatingModel } from '../edit'
import { StructureLanes } from './StructureLanes'
import { roleLines } from './roleLines'
import { pickLooks } from './structurePick'
import type { StructurePick } from './structurePick'
import { TypeCard } from './TypeCard'

type Props = {
  model: OperatingModel
  readOnly: boolean
  selected: string | undefined
  onSelect(id: string | undefined): void
  dispatch(command: Command): void
  makeId: MakeId
  unitCounts?: ReadonlyMap<UnitTypeId, number> | undefined
  onFromLibrary(): void
  fresh?: ReadonlySet<string>
}

export function StructureTab({ model, readOnly, selected, onSelect, dispatch, makeId, unitCounts, onFromLibrary, fresh }: Props) {
  const { t } = useStrings()
  const structure = useMemo(() => unitTypeLanes(model.unitTypes), [model.unitTypes])
  // A role picked by its line on a card says which card it was picked on; picked anywhere else, it says none.
  const [pickedIn, setPickedIn] = useState<{ roleId: RoleId; typeId: UnitTypeId } | undefined>(undefined)
  const inType = pickedIn?.roleId === selected ? pickedIn?.typeId : undefined
  const lines = useMemo(() => roleLines(structure, model.unitTypes, model.roles), [structure, model.unitTypes, model.roles])
  const looks = useMemo(() => pickLooks(model.unitTypes, pickOf(model, selected, inType), model.roles, lines), [model, selected, inType, lines])
  const roles = useMemo(() => new Map(model.roles.map((role) => [role.id, role])), [model.roles])
  const add = (command: CommandOf<'unitType.add'> | CommandOf<'role.add'>) => {
    dispatch(command)
    onSelect(command.type === 'unitType.add' ? command.unitType.id : command.role.id)
  }
  const pick = (id: string) => {
    setPickedIn(undefined)
    onSelect(selected === id ? undefined : id)
  }
  const pickChip = (roleId: RoleId, typeId: UnitTypeId) => {
    const again = selected === roleId && inType === typeId
    setPickedIn(again ? undefined : { roleId, typeId })
    onSelect(again ? undefined : roleId)
  }
  const card = (type: UnitType) => {
    const count = unitCounts?.get(type.id)
    return (
      <TypeCard
        type={type} roles={roles} look={looks.type(type.id)} place={placeOf(type, model.unitTypes, t)} named="operating.typeCard"
        {...(count !== undefined ? { count: t(count === 1 ? 'operating.unitsOne' : 'operating.unitsOther', { count }) } : {})}
        meta={[...(type.limit !== undefined ? [t('operating.limitLine', { count: type.limit })] : []), ...(type.until ? [t('operating.untilLine', { day: type.until })] : [])]}
        onPick={() => pick(type.id)} onPickRole={(roleId) => pickChip(roleId, type.id)} roleLook={(roleId) => looks.role(roleId, type.id)} fresh={fresh?.has(type.id) === true}
      />
    )
  }
  const held = new Set(model.unitTypes.flatMap((type) => type.slots.map((slot) => slot.role)))
  const loose = model.roles.filter((role) => !held.has(role.id))
  if (model.unitTypes.length === 0 && model.roles.length === 0 && model.responsibilities.length === 0) {
    return <FirstRun readOnly={readOnly} onFromLibrary={onFromLibrary} onNewType={() => add(newUnitType(t('operating.newUnitTypeName'), makeId, model))} />
  }
  return (
    <>
      <p className="op-concept" data-testid="operating-concept">{t('operating.concept')}</p>
      {!readOnly && (
        <div className="op-actions">
          <Button variant="primary" data-guide="operating.newUnitType" onClick={() => add(newUnitType(t('operating.newUnitTypeName'), makeId, model))}>{t('operating.newUnitType')}</Button>
          <Button variant="plain" data-guide="operating.newRole" onClick={() => add(newRole(t('operating.newRoleName'), makeId, model))}>{t('operating.newRole')}</Button>
          <Button variant="plain" data-guide="operating.fromLibrary" onClick={onFromLibrary}>{t('operating.fromLibrary')}</Button>
        </div>
      )}
      <div style={{ overflowX: 'auto', flex: 'none' }}>
        <StructureLanes
          structure={structure} label={t('operating.structure')} named="operating.structure"
          organisation={{ name: t('operating.theOrganisation'), look: looks.organisation }}
          laneLabel={(lane) => (lane === 0 ? t('operating.theOrganisation') : t('operating.lane', { lane }))}
          card={card} lineLook={looks.line} roleLines={looks.roleLines}
        />
      </div>
      <div className="op-under">
        <div data-testid="tray-nowhere">
          {structure.nowhere.length === 0
            ? <span className="op-quiet">{t('operating.trayNowhereNone')}</span>
            : (
              <>
                <span>{t('operating.trayNowhere', { count: structure.nowhere.length })} </span>
                {structure.nowhere.map((type, at) => <span key={type.id}>{at > 0 && ', '}<button type="button" className="op-link" data-testid={`nowhere-${type.id}`} onClick={() => pick(type.id)}>{type.name}</button></span>)}
              </>
            )}
        </div>
        <LooseRoles loose={loose} onPick={pick} t={t} />
      </div>
      <p className="op-small">{t('operating.pressHint')}</p>
    </>
  )
}

/** What is picked, as the structure reads it: a unit type or a role, and nothing for a responsibility. */
function pickOf(model: OperatingModel, selected: string | undefined, inType: UnitTypeId | undefined): StructurePick | undefined {
  const picked = itemOf(model, selected)
  if (!picked || picked.kind === 'responsibility') return undefined
  return picked.kind === 'role' && inType !== undefined ? { kind: 'role', id: picked.item.id, inType } : { kind: picked.kind, id: picked.item.id }
}

/** Where a type may sit, in words, for whoever cannot see the lines. */
export function placeOf(type: UnitType, types: readonly UnitType[], t: Translate): string {
  const where = [
    ...(type.top ? [t('operating.atTheTop')] : []),
    ...type.within.map((id) => types.find((one) => one.id === id)?.name ?? id),
  ]
  return t('operating.sitsIn', { where: where.length ? where.join(', ') : t('operating.nowhere') })
}

function LooseRoles({ loose, onPick, t }: { loose: readonly Role[]; onPick(id: RoleId): void; t: Translate }) {
  return (
    <div data-testid="tray-loose">
      {loose.length === 0
        ? <span className="op-quiet">{t('operating.trayLooseNone')}</span>
        : (
          <>
            <span>{t(loose.length === 1 ? 'operating.looseOne' : 'operating.looseOther', { count: loose.length })} </span>
            {loose.map((role, at) => <span key={role.id}>{at > 0 && ', '}<button type="button" className="op-link" data-testid={`role-${role.id}`} onClick={() => onPick(role.id)}>{role.name}</button></span>)}
          </>
        )}
    </div>
  )
}

/** First run: the three concepts in the order they are made. */
function FirstRun({ readOnly, onFromLibrary, onNewType }: { readOnly: boolean; onFromLibrary(): void; onNewType(): void }) {
  const { t } = useStrings()
  return (
    <div className="op-steps" data-testid="operating-first-run">
      <h2>{t('operating.firstTitle')}</h2>
      <ol>
        <li><strong>{t('operating.first1')}</strong>{t('operating.first1More')}</li>
        <li><strong>{t('operating.first2')}</strong>{t('operating.first2More')}</li>
        <li><strong>{t('operating.first3')}</strong>{t('operating.first3More')}</li>
      </ol>
      {!readOnly && (
        <div className="op-actions">
          <Button variant="primary" data-guide="operating.startFromLibrary" onClick={onFromLibrary}>{t('operating.startFromLibrary')}</Button>
          <Button variant="plain" data-guide="operating.newUnitType" onClick={onNewType}>{t('operating.newUnitType')}</Button>
        </div>
      )}
      <p className="op-small">{t('operating.firstThen')}</p>
    </div>
  )
}
