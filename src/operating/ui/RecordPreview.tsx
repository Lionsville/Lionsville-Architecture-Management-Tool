// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The two frames a record of the operating model is read in, around one reader
 * each (`ReaderFrame`): a unit type, a role, a responsibility, and a role inside a
 * unit type.
 *
 * Where the record is opened from a list (Roles), it reads in the large preview
 * over the page, as a list row opens one everywhere: what it is and its name on
 * top, ‹ › to the next of its kind, ⋯ with the delete last in it, the text with
 * the facts in their column beside it, and the foot in its bar.
 *
 * Where the page itself is the work (the structure's lanes, the RACI's grid), it
 * reads in the panel beside it: the lanes light what was pressed, and a letter is
 * set in the grid with the record still open. The preview's scrim hid both, and
 * every new responsibility had to be put away before its A could be set.
 */
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import type { RoleId, UnitType } from '../../model/operatingModel'
import { Panel, PanelName } from '../../widgets/kit/Panel'
import { Preview } from '../../widgets/kit/Preview'
import { editResponsibility, editRole, editUnitType } from '../edit'
import type { OperatingItem } from '../edit'
import { ReaderMore, stackedFrame } from './ReaderParts'
import type { ReaderFrame, ReaderParts } from './ReaderParts'
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
  /** Told when a name is kept: the grid takes the focus back for the new row's letters. */
  onNamed?(id: string): void
  slotOpen?: RoleId | undefined
  onSlot?(role: RoleId | undefined): void
  slotAside?: ReactNode
  removeSlotOf?(type: UnitType, index: number): void
  /** The RACI's part, where a role is read from the grid. */
  part?: string | undefined
  /** The stable control name: the roles' own preview keeps the one it had. */
  dataGuide?: string
}

const kindWord = (kind: OperatingItem['kind'], t: Translate) =>
  ({ unitType: t('operating.unitType'), role: t('operating.role'), responsibility: t('operating.responsibility') })[kind]

/** The large preview, over a list. */
export function RecordPreview({ picked, ids, onSelect, parts, naming, slotOpen, onSlot, slotAside, removeSlotOf, part, dataGuide = 'operating.reader' }: RecordPreviewProps) {
  const { t } = useStrings()
  if (!picked) return null
  const wordOf = { unitType: t('operating.unitTypesWord'), role: t('operating.rolesWord'), responsibility: t('operating.responsibilitiesWord') }
  const walk = ids ?? siblings(picked, parts)
  const close = () => { onSlot?.(undefined); onSelect(undefined) }
  const slot = slotOf(picked, slotOpen, parts)
  if (slot) {
    const { type, at, name } = slot
    // A role inside a type is not one of a list: no pager, and the way back to its type in the head.
    return (
      <SlotReader type={type} slot={type.slots[at]} index={at} parts={parts} onTakeOut={() => removeSlotOf?.(type, at)} frame={({ body, facts, foot }) => (
        <Preview
          ids={[]} currentId={type.id} onSelect={(id) => (id === null ? close() : onSelect(id))} kind={t('operating.roleIn', { type: type.name })} title={name} titleText={name}
          dataGuide={dataGuide} facts={facts} foot={foot}
          actions={<button type="button" className="kit-preview__link" onClick={() => onSlot?.(undefined)}>{t('operating.backToType', { type: type.name })}</button>}
        >
          {body}
        </Preview>
      )} />
    )
  }
  const frame: ReaderFrame = ({ body, facts, foot }) => (
    <Preview
      ids={walk} currentId={picked.item.id} onSelect={(id) => (id === null ? close() : onSelect(id))}
      kind={kindWord(picked.kind, t)} titleText={picked.item.name} listWord={wordOf[picked.kind]}
      title={<RecordName picked={picked} parts={parts} naming={naming} />}
      dataGuide={dataGuide} actions={<ReaderMore item={picked} parts={parts} />} facts={facts} foot={foot}
    >
      <div data-testid="operating-inspector">{body}</div>
    </Preview>
  )
  return <ReaderOf picked={picked} parts={parts} part={part} onSlot={onSlot} slotAside={slotAside} frame={frame} />
}

/** The panel, beside the structure or the grid. */
export function RecordPanel({ picked, onSelect, parts, naming, onNamed, slotOpen, onSlot, slotAside, removeSlotOf, part, width, dataGuide = 'operating.reader' }: RecordPreviewProps & { width: number }) {
  const { t } = useStrings()
  if (!picked) return null
  const slot = slotOf(picked, slotOpen, parts)
  if (slot) {
    const { type, at, name } = slot
    return (
      <SlotReader type={type} slot={type.slots[at]} index={at} parts={parts} onTakeOut={() => removeSlotOf?.(type, at)} frame={(layout) => (
        <Panel
          kind={t('operating.roleIn', { type: type.name })} name={name} onClose={() => onSlot?.(undefined)} width={width} dataGuide={dataGuide}
          actions={<button type="button" className="op-link op-small" data-testid="operating-back-to-type" onClick={() => onSlot?.(undefined)}>{t('operating.backToType', { type: type.name })}</button>}
        >
          {stackedFrame(layout)}
        </Panel>
      )} />
    )
  }
  const rename = renameOf(picked, parts)
  const frame: ReaderFrame = (layout) => (
    <Panel
      kind={kindWord(picked.kind, t)} name={picked.item.name} onClose={() => onSelect(undefined)} width={width} dataGuide={dataGuide}
      actions={<ReaderMore item={picked} parts={parts} />}
      {...(naming?.id === picked.item.id ? { renameRequest: naming.nonce, renameAtOnce: true } : {})}
      {...(rename ? { onRename: (name: string) => { rename(name); onNamed?.(picked.item.id) } } : {})}
    >
      <div data-testid="operating-inspector">{stackedFrame(layout)}</div>
    </Panel>
  )
  return <ReaderOf picked={picked} parts={parts} part={part} onSlot={onSlot} slotAside={slotAside} frame={frame} />
}

/** The reader the picked record's kind is read with, in the frame it is handed. */
function ReaderOf({ picked, parts, part, onSlot, slotAside, frame }: {
  picked: OperatingItem; parts: ReaderParts; part: string | undefined
  onSlot: ((role: RoleId | undefined) => void) | undefined; slotAside: ReactNode; frame: ReaderFrame
}) {
  if (picked.kind === 'unitType') return <UnitTypeReader type={picked.item} parts={parts} onOpenSlot={(role) => onSlot?.(role)} slotAside={slotAside} frame={frame} />
  if (picked.kind === 'role') {
    return (
      <RoleReader
        role={picked.item} parts={parts} partName={part} frame={frame}
        partDuties={part === undefined ? undefined : parts.model.responsibilities.filter((one) => (one.group?.trim() ?? '') === part).map((one) => one.id)}
      />
    )
  }
  return <ResponsibilityReader responsibility={picked.item} parts={parts} frame={frame} />
}

/** The name in the preview's title: pressed to rename where it may be, open for typing where it was just made. */
function RecordName({ picked, parts, naming }: { picked: OperatingItem; parts: ReaderParts; naming: RecordPreviewProps['naming'] }) {
  const rename = renameOf(picked, parts)
  return (
    <PanelName
      unheaded name={picked.item.name}
      {...(naming?.id === picked.item.id ? { renameRequest: naming.nonce, renameAtOnce: true } : {})}
      {...(rename ? { onRename: (name: string) => { rename(name) } } : {})}
    />
  )
}

function renameOf(picked: OperatingItem, parts: ReaderParts): ((name: string) => void) | undefined {
  if (parts.readOnly) return undefined
  const edit = { unitType: editUnitType, role: editRole, responsibility: editResponsibility }[picked.kind]
  return (name) => parts.dispatch(edit(picked.item.id, 'name', name))
}

/** The role inside a unit type that is open, where one is. */
function slotOf(picked: OperatingItem, slotOpen: RoleId | undefined, parts: ReaderParts) {
  if (picked.kind !== 'unitType' || slotOpen === undefined) return undefined
  const at = picked.item.slots.findIndex((slot) => slot.role === slotOpen)
  if (at < 0) return undefined
  return { type: picked.item, at, name: parts.model.roles.find((role) => role.id === slotOpen)?.name ?? slotOpen }
}

/** The records of one kind, in the model's order, for ‹ › where the page hands no order of its own. */
function siblings(picked: OperatingItem, parts: ReaderParts): string[] {
  const { model } = parts
  const all = picked.kind === 'unitType' ? model.unitTypes : picked.kind === 'role' ? model.roles : model.responsibilities
  return all.map((one) => one.id)
}
