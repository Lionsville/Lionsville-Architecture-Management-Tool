// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The first tab: the unit types drawn as the structure they make (ADR-0036,
 * amended 11 October 2026), the two trays under it, and the rules the model
 * reads.
 *
 * Each type is a card in its lane (`StructureLanes`), with a line from every
 * place it may sit. Picking a card lights where the type may sit, the types
 * that may sit in it and its roles; picking a role lights the types that hold
 * it; everything else dims, and pressing the pick again lets it go. The
 * reporting lines are drawn for a role picked and for nothing else: picked by
 * its chip on a card, the lines from and into that chip; picked in the tray or
 * elsewhere, its lines on every card that holds it. Both open
 * in the inspector beside, where *Sits in* and the order in the lane are
 * edited. A type that sits nowhere waits in a tray of its own, since no unit
 * can be made of it, and so does a role no type holds.
 */
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import type { Command } from '../../model/commands'
import type { MakeId } from '../../model/keys'
import type { Role, RoleId, UnitType, UnitTypeId } from '../../model/operatingModel'
import { unitTypeLanes } from '../../model/unitOrder'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { itemOf, newRole, newUnitType } from '../edit'
import type { CommandOf, OperatingModel } from '../edit'
import type { Library } from '../library'
import { HEADING, Rules } from './Rules'
import { StructureLanes } from './StructureLanes'
import { roleLines } from './roleLines'
import { pickLooks } from './structurePick'
import type { PickLooks, StructurePick } from './structurePick'
import { ringOf, TypeCard } from './TypeCard'

type Props = {
  model: OperatingModel
  readOnly: boolean
  selected: string | undefined
  onSelect(id: string | undefined): void
  dispatch(command: Command): void
  makeId: MakeId
  /** The libraries whose names say where a type came from. */
  libraries: readonly Library[]
  /** How many units of each type there are today, as the host counts them; nothing is said where absent. */
  unitCounts?: ReadonlyMap<UnitTypeId, number>
  /** Nothing in the model yet: a library is offered first. */
  empty: boolean
  /** Open the dialog that brings a library in. */
  onFromLibrary(): void
  /** What a library brought in since the page was opened, by id: marked new. */
  fresh?: ReadonlySet<string>
}

export function UnitsAndRoles(props: Props) {
  const { model, readOnly, selected, onSelect, dispatch, makeId, empty, onFromLibrary, fresh } = props
  const { t } = useStrings()
  const structure = useMemo(() => unitTypeLanes(model.unitTypes), [model.unitTypes])
  // A role picked by its chip says which card it was picked on; picked anywhere else — the tray, the matrix, a link — it says none.
  const [pickedIn, setPickedIn] = useState<{ roleId: RoleId; typeId: UnitTypeId } | undefined>(undefined)
  const inType = pickedIn?.roleId === selected ? pickedIn?.typeId : undefined
  // Every reporting line the structure could draw (ADR-0039 §7, amended); only the pick's are drawn.
  const lines = useMemo(() => roleLines(structure, model.unitTypes, model.roles), [structure, model.unitTypes, model.roles])
  const looks = useMemo(() => pickLooks(model.unitTypes, pickOf(model, selected, inType), model.roles, lines), [model, selected, inType, lines])
  const roles = useMemo(() => new Map(model.roles.map((role) => [role.id, role])), [model.roles])
  const add = (command: CommandOf<'unitType.add'> | CommandOf<'role.add'>) => {
    dispatch(command)
    onSelect(command.type === 'unitType.add' ? command.unitType.id : command.role.id)
  }
  // Pressing the pick again lets it go.
  const pick = (id: string) => {
    setPickedIn(undefined)
    onSelect(selected === id ? undefined : id)
  }
  // A role's chip on a card: the role, on that card; pressed again there, let go; pressed on another card, moved there.
  const pickChip = (roleId: RoleId, typeId: UnitTypeId) => {
    const again = selected === roleId && inType === typeId
    setPickedIn(again ? undefined : { roleId, typeId })
    onSelect(again ? undefined : roleId)
  }
  const card = (type: UnitType) => (
    <TypeCard
      type={type} roles={roles} look={looks.type(type.id)} source={sourceOf(type, props.libraries, t)}
      meta={metaOf(type, props.unitCounts, t)} place={placeOf(type, model.unitTypes, t)} named="operating.typeCard"
      onPick={() => pick(type.id)} onPickRole={(roleId) => pickChip(roleId, type.id)} roleLook={(roleId) => looks.role(roleId, type.id)} fresh={fresh?.has(type.id) === true}
    />
  )
  return (
    <Box>
      {empty && (
        <Box sx={{ mb: 2 }}>
          <Typography color="text.secondary">{t('operating.empty')}</Typography>
          {!readOnly && (
            <Button size="small" variant="contained" data-guide="operating.startFromLibrary" onClick={onFromLibrary} sx={{ textTransform: 'none', mt: 1 }}>
              {t('operating.startFromLibrary')}
            </Button>
          )}
        </Box>
      )}
      {/* The ways to add, side by side, a library's among them once the model holds anything. */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography component="h2" sx={{ ...HEADING, mt: 0, mb: 0, mr: 1 }}>{t('operating.unitTypes')}</Typography>
        {!readOnly && (
          <>
            <Button size="small" variant="outlined" data-guide="operating.newUnitType" sx={{ textTransform: 'none' }}
              onClick={() => add(newUnitType(t('operating.newUnitTypeName'), makeId, model))}>
              {t('operating.newUnitType')}
            </Button>
            <Button size="small" variant="outlined" data-guide="operating.newRole" sx={{ textTransform: 'none' }}
              onClick={() => add(newRole(t('operating.newRoleName'), makeId, model))}>
              {t('operating.newRole')}
            </Button>
            {!empty && (
              <Button size="small" variant="contained" data-guide="operating.fromLibrary" sx={{ textTransform: 'none' }} onClick={onFromLibrary}>
                {t('operating.fromLibrary')}
              </Button>
            )}
          </>
        )}
      </Box>
      <Box sx={{ overflowX: 'auto', mt: 1 }}>
        <StructureLanes
          structure={structure} label={t('operating.structure')} named="operating.structure"
          organisation={{ name: t('operating.theOrganisation'), note: t('operating.organisationNote'), look: looks.organisation }}
          laneLabel={(lane) => (lane === 0 ? t('operating.theOrganisation') : t('operating.lane', { lane }))}
          card={card} lineLook={looks.line} roleLines={looks.roleLines}
        />
      </Box>
      {lines.length > 0 && (
        <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }} data-testid="structure-lines-legend">{t('operating.linesLegend')}</Typography>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start', mt: 1 }}>
        <Tray heading={t('operating.trayNowhere')} testId="tray-nowhere">
          {structure.nowhere.length === 0
            ? <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('operating.trayNowhereNone')}</Typography>
            : (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1 }}>
                  {structure.nowhere.map((type) => <Box key={type.id}>{card(type)}</Box>)}
                </Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>{t('operating.trayNowhereHint')}</Typography>
              </>
            )}
        </Tray>
        <LooseRoles model={model} looks={looks} onPick={pick} fresh={fresh} t={t} />
      </Box>
      <Rules model={model} readOnly={readOnly} dispatch={dispatch} />
    </Box>
  )
}

/** What is picked, as the structure reads it: a unit type or a role, and nothing for a responsibility. */
function pickOf(model: OperatingModel, selected: string | undefined, inType: UnitTypeId | undefined): StructurePick | undefined {
  const picked = itemOf(model, selected)
  if (!picked || picked.kind === 'responsibility') return undefined
  return picked.kind === 'role' && inType !== undefined ? { kind: 'role', id: picked.item.id, inType } : { kind: picked.kind, id: picked.item.id }
}

/** Where a type came from: its library's name, or the organisation's own. */
function sourceOf(type: UnitType, libraries: readonly Library[], t: Translate): string {
  if (!type.basedOn) return t('operating.own')
  const from = type.basedOn.library
  return libraries.find((library) => library.id === from)?.name ?? from
}

/** What a card says under the name: the units it has today, its limit, its last day. */
function metaOf(type: UnitType, counts: ReadonlyMap<UnitTypeId, number> | undefined, t: Translate): string[] {
  const count = counts?.get(type.id) ?? 0
  return [
    ...(counts ? [t(count === 1 ? 'operating.unitsTodayOne' : 'operating.unitsTodayOther', { count })] : []),
    ...(type.limit !== undefined ? [t('operating.limitLine', { count: type.limit })] : []),
    ...(type.until ? [t('operating.untilLine', { day: type.until })] : []),
  ]
}

/** Where a type may sit, in words, for whoever cannot see the lines. */
export function placeOf(type: UnitType, types: readonly UnitType[], t: Translate): string {
  const where = [
    ...(type.top ? [t('operating.atTheTop')] : []),
    ...type.within.map((id) => types.find((one) => one.id === id)?.name ?? id),
  ]
  return t('operating.sitsIn', { where: where.length ? where.join(', ') : t('operating.nowhere') })
}

function Tray({ heading, testId, children }: { heading: string; testId: string; children: ReactNode }) {
  return (
    <Box component="section" aria-label={heading} data-testid={testId}
      sx={{ flex: '1 1 280px', border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 1.5, p: 1.25 }}>
      <Typography component="h2" sx={{ ...HEADING, mt: 0 }}>{heading}</Typography>
      {children}
    </Box>
  )
}

/** The roles no unit type holds, each to pick as a slot's role is. */
function LooseRoles({ model, looks, onPick, fresh, t }: {
  model: OperatingModel; looks: PickLooks; onPick(id: RoleId): void; fresh: ReadonlySet<string> | undefined; t: Translate
}) {
  const held = new Set(model.unitTypes.flatMap((type) => type.slots.map((slot) => slot.role)))
  const loose = model.roles.filter((role) => !held.has(role.id))
  return (
    <Tray heading={t('operating.looseRoles')} testId="tray-loose">
      {loose.length === 0 && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('operating.trayLooseNone')}</Typography>}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {loose.map((role) => <LooseRole key={role.id} role={role} look={looks.role(role.id)} onPick={onPick} fresh={fresh?.has(role.id) === true} t={t} />)}
      </Box>
    </Tray>
  )
}

function LooseRole({ role, look, onPick, fresh, t }: {
  role: Role; look: ReturnType<PickLooks['role']>; onPick(id: RoleId): void; fresh: boolean; t: Translate
}) {
  return (
    <ButtonBase onClick={() => onPick(role.id)} aria-pressed={look === 'picked'} data-testid={`role-${role.id}`} data-look={look} data-fresh={fresh || undefined}
      sx={{ fontSize: 12, lineHeight: '20px', px: 1, borderRadius: 1, border: 1, borderColor: ringOf(look) ?? (fresh ? 'success.main' : 'divider'), bgcolor: 'background.paper' }}>
      {role.name}
      {fresh && <Box component="span" sx={{ ml: 0.5, fontSize: 10, color: 'success.main' }}>{t('operating.newBadge')}</Box>}
      {role.manages && <Box component="span" sx={{ ml: 0.5, fontSize: 10, color: 'primary.main' }}>{t('operating.managesBadge')}</Box>}
      {role.until && <Box component="span" sx={{ ml: 0.5, fontSize: 10, color: 'text.secondary' }}>{t('operating.untilLine', { day: role.until })}</Box>}
    </ButtonBase>
  )
}
