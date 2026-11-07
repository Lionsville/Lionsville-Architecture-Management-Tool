// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What this sheet draws (ADR-0012 §6).
 *
 * A sheet has no geometry; what it is *of* is four fields — which journey runs
 * across the top, which function roots are the areas and in which order, the
 * order of the lanes, and whether the stakeholder rail is drawn — and until
 * this dialog existed three of them could only be set by an agent or by
 * editing the file. A scope with two journeys seeds none on purpose
 * (`business/sheetDiagram.seedSheet`), so on such a project the band stayed
 * empty with no way to say which one was meant.
 *
 * Each change is its own command, applied as it is made: there is no *save*,
 * because a dialog that batches four toggles into one undo step would make
 * ⌘Z take back three decisions a person did not revisit. The page behind it
 * redraws under the dialog, which is the point — this is a view onto the
 * sheet, not a form about it.
 */
import { useState } from 'react'
import type { DesignDiagram, DesignModel, ElementId } from '../../model'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { CaretIcon } from '../../widgets/icons'
import { Button, IconButton } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { SelectField } from '../../widgets/kit/Field'
import { journeyOf } from '../lanes'
import { rootsOfKind } from '../sheetDiagram'
import type { SheetActions } from './FunctionInspector'

export type SheetSettingsDialogProps = {
  model: DesignModel
  sheet: DesignDiagram
  actions: SheetActions
  onClose(): void
}

export function SheetSettingsDialog({ model, sheet, actions, onClose }: SheetSettingsDialogProps) {
  const { t } = useStrings()
  const journeys = rootsOfKind(model.elements, 'step')
  const roots = rootsOfKind(model.elements, 'function')
  // An absent list draws every root, so that is the list this dialog shows,
  // and the moment somebody touches it, it is written down.
  const drawn = sheet.areas ?? roots.map((root) => root.id)
  const named = (id: ElementId) => model.elements.find((held) => held.id === id)?.name ?? id

  // The rows currently under the phases, in the order they are drawn: the
  // sheet's own order first, then the lanes only a step knows about.
  const lanes = sheet.journeyId === undefined
    ? []
    : journeyOf(model.elements, sheet.journeyId, sheet.lanes ?? [])
      .lanes.slice(1)
      .map((lane) => lane.actorId)
      .filter((id): id is ElementId => id !== undefined)

  return (
    <Dialog open size="m" title={t('sheet.settings')} onClose={onClose} actions={<Button onClick={onClose}>{t('common.close')}</Button>}>
      <SelectField
        label={t('sheet.settingsJourney')} value={sheet.journeyId ?? ''}
        options={[{ value: '', label: t('common.none') }, ...journeys.map((journey) => ({ value: journey.id, label: journey.name }))]}
        onChange={(value) => actions.updateSheet({ journeyId: value === '' ? undefined : value })}
      />

      <OrderList
        heading={t('sheet.settingsAreas')} order={drawn} named={named}
        extra={roots.map((root) => root.id).filter((id) => !drawn.includes(id))}
        onOrder={(areas) => actions.updateSheet({ areas })} drawWord={(name) => t('sheet.settingsDraw', { name })} t={t}
      />

      <OrderList
        heading={t('sheet.settingsLanes')} order={lanes} named={named} none={t('sheet.settingsNoLanes')}
        onOrder={(next) => actions.updateSheet({ lanes: next })} t={t}
      />

      <label className="sheet-held">
        <input
          type="checkbox" checked={sheet.showActors !== false} aria-label={t('sheet.settingsRail')}
          onChange={(event) => actions.updateSheet({ showActors: event.target.checked })}
        />
        {t('sheet.settingsRail')}
      </label>
      <SelectField
        label={t('sheet.poster.tileSize')} value={sheet.poster?.tile ?? 'm'}
        options={[{ value: 's', label: t('sheet.poster.tileS') }, { value: 'm', label: t('sheet.poster.tileM') }, { value: 'l', label: t('sheet.poster.tileL') }]}
        onChange={(value) => actions.updateSheet({ poster: { ...sheet.poster, tile: value as 's' | 'm' | 'l' } })}
      />
      <SelectField
        label={t('sheet.poster.bandRows')} value={sheet.poster?.bandRows === undefined ? '' : String(sheet.poster.bandRows)}
        options={[{ value: '', label: t('sheet.poster.bandRowsAuto') }, { value: '1', label: '1' }, { value: '2', label: '2' }]}
        onChange={(value) => {
          const { bandRows: _was, ...rest } = sheet.poster ?? {}
          actions.updateSheet({ poster: value === '' ? rest : { ...rest, bandRows: Number(value) as 1 | 2 } })
        }}
      />
    </Dialog>
  )
}

/** A list in its order, dragged or moved by the arrows, with a tick on each where it can be left out. */
export function OrderList({ heading, order, extra = [], named, none, onOrder, drawWord, t }: {
  heading: string
  order: readonly ElementId[]
  /** What could be drawn and is not. */
  extra?: readonly ElementId[]
  named(id: ElementId): string
  none?: string
  onOrder(next: ElementId[]): void
  drawWord?: (name: string) => string
  t: Translate
}) {
  const [dragged, setDragged] = useState<number | undefined>(undefined)
  return (
    <div>
      <h3 className="sheet-areas__heading">{heading}</h3>
      {order.length === 0 && extra.length === 0 && none && <div className="sheet-held__say">{none}</div>}
      {order.map((id, at) => (
        <div
          className="sheet-held" key={id} draggable onDragStart={() => setDragged(at)} onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            if (dragged === undefined || dragged === at) return
            const next = [...order]
            next.splice(at, 0, ...next.splice(dragged, 1))
            setDragged(undefined)
            onOrder(next)
          }}
        >
          {drawWord && <input type="checkbox" checked aria-label={drawWord(named(id))} onChange={() => onOrder(order.filter((held) => held !== id))} />}
          <span className="sheet-held__name">{named(id)}</span>
          <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
            <IconButton size="small" label={`${named(id)}: ${t('sheet.moveUp')}`} disabled={at === 0} onClick={() => onOrder(swapped(order, at, -1))}><CaretIcon size={12} /></IconButton>
          </span>
          <IconButton size="small" label={`${named(id)}: ${t('sheet.moveDown')}`} disabled={at === order.length - 1} onClick={() => onOrder(swapped(order, at, 1))}><CaretIcon size={12} /></IconButton>
        </div>
      ))}
      {extra.map((id) => (
        <label className="sheet-held" key={id}>
          <input type="checkbox" checked={false} aria-label={drawWord?.(named(id))} onChange={() => onOrder([...order, id])} />
          <span className="sheet-held__name">{named(id)}</span>
        </label>
      ))}
    </div>
  )
}

/** One row past its neighbour, as a whole new list. */
function swapped(order: readonly ElementId[], at: number, by: -1 | 1): ElementId[] {
  const next = [...order]
  next.splice(at + by, 0, ...next.splice(at, 1))
  return next
}
