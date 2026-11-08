// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The one frame every record of the operating model is read and written in: a unit
 * type, a role, a responsibility, and a role inside a unit type. The large preview
 * over the page, as a list row opens one everywhere else: what it is and its name
 * on top, ‹ › to the next of its kind, ⋯ with the delete last in it as on a
 * board's panel, the facts, and the reader's own foot with the ways onward.
 * A unit type read in a side panel and a role in a full window, with their actions
 * in different places, made the same kind of act sit in four places on one page.
 */
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n'
import type { RoleId, UnitType } from '../../model/operatingModel'
import { PanelName } from '../../widgets/kit/Panel'
import { Preview } from '../../widgets/kit/Preview'
import { editResponsibility, editRole, editUnitType } from '../edit'
import type { OperatingItem } from '../edit'
import { ReaderMore } from './ReaderParts'
import type { ReaderParts } from './ReaderParts'
import { ResponsibilityReader } from './ResponsibilityReader'
import { RoleReader } from './RoleReader'
import { SlotReader } from './SlotReader'
import { UnitTypeReader } from './UnitTypeReader'

export type RecordPreviewProps = {
  picked: OperatingItem | undefined
  /** What ‹ › walk: the records of the picked one's kind, in the order the page draws them. */
  ids?: readonly string[]
  onSelect(id: string | undefined): void
  parts: ReaderParts
  /** The item just made, whose name opens for typing. */
  naming?: { id: string; nonce: number } | undefined
  slotOpen?: RoleId | undefined
  onSlot?(role: RoleId | undefined): void
  slotAside?: ReactNode
  removeSlotOf?(type: UnitType, index: number): void
  /** The RACI's part, where a role is read from the grid. */
  part?: string | undefined
  /** The stable control name: the roles' own preview keeps the one it had. */
  dataGuide?: string
}

export function RecordPreview({ picked, ids, onSelect, parts, naming, slotOpen, onSlot, slotAside, removeSlotOf, part, dataGuide = 'operating.reader' }: RecordPreviewProps) {
  const { t } = useStrings()
  const { readOnly, dispatch, model } = parts
  const kindOf = { unitType: t('operating.unitType'), role: t('operating.role'), responsibility: t('operating.responsibility') }
  const wordOf = { unitType: t('operating.unitTypesWord'), role: t('operating.rolesWord'), responsibility: t('operating.responsibilitiesWord') }
  const walk = ids ?? (picked ? siblings(picked, parts) : [])
  const close = () => { onSlot?.(undefined); onSelect(undefined) }
  const slotAt = picked?.kind === 'unitType' && slotOpen !== undefined ? picked.item.slots.findIndex((slot) => slot.role === slotOpen) : -1
  if (picked?.kind === 'unitType' && slotAt >= 0) {
    return <SlotPreview type={picked.item} at={slotAt} walk={walk} close={close} onSelect={onSelect} parts={parts} onSlot={onSlot} removeSlotOf={removeSlotOf} dataGuide={dataGuide} />
  }
  const rename = picked && { unitType: editUnitType, role: editRole, responsibility: editResponsibility }[picked.kind]
  return (
    <Preview
      ids={walk} currentId={picked ? picked.item.id : null} onSelect={(id) => (id === null ? close() : onSelect(id))}
      kind={picked ? kindOf[picked.kind] : undefined} titleText={picked?.item.name} listWord={picked ? wordOf[picked.kind] : undefined}
      title={picked && (
        <PanelName
          unheaded name={picked.item.name}
          {...(naming?.id === picked.item.id ? { renameRequest: naming.nonce, renameAtOnce: true } : {})}
          {...(readOnly || !rename ? {} : { onRename: (name: string) => { dispatch(rename(picked.item.id, 'name', name)) } })}
        />
      )}
      dataGuide={dataGuide}
      actions={<ReaderMore item={picked} parts={parts} />}
    >
      {picked && (
        <div data-testid="operating-inspector">
          {picked.kind === 'unitType' && <UnitTypeReader type={picked.item} parts={parts} onOpenSlot={(role) => onSlot?.(role)} slotAside={slotAside} />}
          {picked.kind === 'role' && (
            <RoleReader
              role={picked.item} parts={parts} partName={part}
              partDuties={part === undefined ? undefined : model.responsibilities.filter((one) => (one.group?.trim() ?? '') === part).map((one) => one.id)}
            />
          )}
          {picked.kind === 'responsibility' && <ResponsibilityReader responsibility={picked.item} parts={parts} />}
        </div>
      )}
    </Preview>
  )
}

/** The records of one kind, in the model's order, for ‹ › where the page hands no order of its own. */
function siblings(picked: OperatingItem, parts: ReaderParts): string[] {
  const { model } = parts
  const all = picked.kind === 'unitType' ? model.unitTypes : picked.kind === 'role' ? model.roles : model.responsibilities
  return all.map((one) => one.id)
}

/** A role inside a unit type, read in the same frame, with the way back to its type. */
function SlotPreview({ type, at, walk, close, onSelect, parts, onSlot, removeSlotOf, dataGuide }: {
  type: UnitType; at: number; walk: readonly string[]; close(): void; onSelect(id: string | undefined): void; parts: ReaderParts
  onSlot?: ((role: RoleId | undefined) => void) | undefined; removeSlotOf?: ((type: UnitType, index: number) => void) | undefined; dataGuide: string
}) {
  const { t } = useStrings()
  const slot = type.slots[at]
  const name = parts.model.roles.find((role) => role.id === slot.role)?.name ?? slot.role
  return (
    <Preview
      ids={walk} currentId={type.id} onSelect={(id) => (id === null ? close() : onSelect(id))} kind={t('operating.roleIn', { type: type.name })} title={name} titleText={name}
      dataGuide={dataGuide} listWord={t('operating.unitTypesWord')}
      actions={<button type="button" className="kit-preview__link" onClick={() => onSlot?.(undefined)}>{t('operating.backToType', { type: type.name })}</button>}
    >
      <SlotReader type={type} slot={slot} index={at} parts={parts} onTakeOut={() => removeSlotOf?.(type, at)} />
    </Preview>
  )
}
