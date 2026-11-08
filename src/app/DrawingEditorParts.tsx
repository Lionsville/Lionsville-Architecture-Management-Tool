// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The editor's edges beside its bar: the question on leaving, the strip under a
 * selected shape in words instead of an address, and the picker that points a
 * shape at an element. The address underneath stays for the agent and for files.
 */
import { useState } from 'react'
import type { Translate } from '../i18n'
import { Button } from '../widgets/kit/Button'
import { Dialog } from '../widgets/kit/Dialog'
import { Picker } from '../widgets/kit/Picker'
import type { PickerOption } from '../widgets/kit/Picker'
import type { PaletteElement } from './drawingProtocol'

export function DrawingLeaveDialog({ open, to, failed, saving, onLeave, onStay, onSave, s }: {
  open: boolean
  /** Where the move is going, where it can be said. */
  to: string | undefined
  /** The save asked for here did not land. */
  failed: boolean
  saving: boolean
  onLeave: () => void
  onStay: () => void
  onSave: () => void
  s: Translate
}) {
  return (
    <Dialog
      open={open} size="s" title={s('drawing.leaveTitle')} onClose={onStay} working={saving}
      error={failed ? s('drawing.saveFailed') : undefined}
      actions={{
        cancel: { onClick: onStay, 'data-testid': 'drawing-leave-stay', label: s('drawing.leaveStay') },
        also: [{ onClick: onLeave, 'data-testid': 'drawing-leave-unsaved', label: s('drawing.leaveUnsaved'), danger: true }],
        outcome: { working: saving, onClick: onSave, 'data-testid': 'drawing-leave-save', label: s('drawing.leaveSave') },
      }}
    >
      <p data-testid="drawing-leave-body">{to ? `${s('drawing.leaveGoing', { name: to })} ` : ''}{s('drawing.leaveBody')}</p>
    </Dialog>
  )
}

/** Under a selected shape: what it points at, and the ways to change that. */
export function ShapeStrip({ element, elementId, elements, onOpen, onPoint, kindWord, s }: {
  element: PaletteElement | undefined
  /** What the shape points at, whether or not it is still here. */
  elementId: string | undefined
  elements: readonly PaletteElement[]
  onOpen: ((elementId: string) => void) | undefined
  onPoint: (element: PaletteElement | undefined) => void
  kindWord: ((kind: string | undefined) => string) | undefined
  s: Translate
}) {
  const [picking, setPicking] = useState(false)
  return (
    <div className="drawing-editor__strip" role="group" aria-label={s('drawing.stripLabel')} data-testid="drawing-shape-strip" data-guide="drawing.shapeStrip">
      {elementId === undefined ? (
        <span>{s('drawing.stripNothing')}</span>
      ) : element ? (
        <span>{s('drawing.stripPoints')} <strong>{element.name}</strong>{kindWord ? ` · ${kindWord(element.kind)}` : ''}</span>
      ) : (
        <span>{s('drawing.stripGone')}</span>
      )}
      {element && onOpen && <Button variant="quiet" size="small" onClick={() => onOpen(element.id)} data-testid="drawing-strip-open">{s('drawing.openPage')}</Button>}
      <Button variant="quiet" size="small" onClick={() => setPicking(true)} data-testid="drawing-strip-point">
        {s(elementId === undefined ? 'drawing.pointAt' : 'drawing.pointAnother')}
      </Button>
      {elementId !== undefined && <Button variant="quiet" size="small" onClick={() => onPoint(undefined)} data-testid="drawing-strip-unlink">{s('drawing.unlink')}</Button>}
      {element && <span className="drawing-editor__stripNote">{s('drawing.stripName')}</span>}
      {picking && <PointDialog elements={elements} onCancel={() => setPicking(false)} onPoint={(picked) => { setPicking(false); onPoint(picked) }} kindWord={kindWord} s={s} />}
    </div>
  )
}

function PointDialog({ elements, onCancel, onPoint, kindWord, s }: {
  elements: readonly PaletteElement[]
  onCancel: () => void
  onPoint: (element: PaletteElement) => void
  kindWord: ((kind: string | undefined) => string) | undefined
  s: Translate
}) {
  const [chosen, setChosen] = useState<PaletteElement | undefined>(undefined)
  const options: PickerOption[] = elements.map((element) => ({ id: element.id, label: element.name, ...(kindWord ? { detail: kindWord(element.kind) } : {}) }))
  return (
    <Dialog
      open size="m" title={s('drawing.pointTitle')} onClose={onCancel}
      actions={{
        cancel: { onClick: onCancel, label: s('common.cancel') },
        outcome: { disabled: !chosen, onClick: () => { if (chosen) onPoint(chosen) }, 'data-testid': 'drawing-point-confirm', label: chosen ? s('drawing.pointConfirm', { name: chosen.name }) : s('drawing.pointAt') },
      }}
    >
      <Picker
        label={s('drawing.pointTitle')} options={options} autoFocus recent={options.slice(0, 8)} placeholder={s('drawing.pointFind')}
        onPick={(option) => setChosen(elements.find((element) => element.id === option.id))} onEscape={onCancel}
      />
      {chosen && <p data-testid="drawing-point-chosen"><strong>{chosen.name}</strong></p>}
      <p>{s('drawing.pointNote')}</p>
    </Dialog>
  )
}
