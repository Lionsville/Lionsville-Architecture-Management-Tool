// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What kind of view to make, split by the question that matters: who draws it. A
 * board follows the model and a drawing does not, and somebody who draws what a
 * board would keep up to date gets a picture that goes out of date.
 *
 * A view the model draws is made on the press, as it always was. A drawing is
 * asked for its name first, and may say what it is about, since a scope full of
 * tabs called *Drawing* cannot be told apart. Where no editor is at hand the limit
 * is said before anybody commits, and Drawing stays on offer: an agent can write
 * to it, and the desktop app can draw it.
 */
import { useEffect, useMemo, useState } from 'react'
import type { Translate } from '../i18n'
import { Button } from '../widgets/kit/Button'
import { Dialog } from '../widgets/kit/Dialog'
import { TextField } from '../widgets/kit/Field'
import { Picker } from '../widgets/kit/Picker'
import type { PickerOption } from '../widgets/kit/Picker'
import type { StringKey } from '../i18n'
import type { PaletteElement } from './drawingProtocol'
import './NewViewDialog.css'

export type ModelViewKind = 'landscape' | 'sheet' | 'map' | 'technology' | 'chart' | 'conway'

/** The views the model draws, in the order they are offered, with a line each. */
const MODEL_VIEWS: readonly { kind: ModelViewKind; name: StringKey; line: StringKey }[] = [
  { kind: 'landscape', name: 'newView.landscape', line: 'newView.landscapeLine' },
  { kind: 'sheet', name: 'shell.newSheet', line: 'newView.sheetLine' },
  { kind: 'map', name: 'shell.newMap', line: 'newView.mapLine' },
  { kind: 'technology', name: 'shell.newTechnology', line: 'newView.technologyLine' },
  { kind: 'chart', name: 'shell.newChart', line: 'newView.chartLine' },
  { kind: 'conway', name: 'shell.newConway', line: 'newView.conwayLine' },
]

export type NewViewDialogProps = {
  open: boolean
  /** Straight to a drawing's name: what *Create drawing* on an element opens. */
  naming?: boolean
  /** What the drawing is about, already known. */
  about?: string
  /** The elements it may be about. Absent where they are not read yet, as on a home. */
  elements?: readonly PaletteElement[]
  /** Is there an editor where this person is? */
  canDraw: boolean
  /** The kinds on offer here. */
  make: Partial<Record<ModelViewKind, () => void>>
  onMakeDrawing: (name: string, about?: string) => void
  onClose: () => void
  s: Translate
}

export function NewViewDialog({ open, naming, about, elements, canDraw, make, onMakeDrawing, onClose, s }: NewViewDialogProps) {
  const [drawing, setDrawing] = useState(false)
  const [name, setName] = useState('')
  const [element, setElement] = useState<string | undefined>(undefined)
  const held = useMemo(() => elements?.find((one) => one.id === element), [elements, element])
  useEffect(() => {
    if (!open) return
    setDrawing(naming === true)
    setElement(about)
    setName(about ? s('shell.drawingOf', { name: elements?.find((one) => one.id === about)?.name ?? '' }) : '')
    // On opening only: what is typed afterwards is the person's.
  }, [open, naming, about]) // eslint-disable-line react-hooks/exhaustive-deps
  const options: PickerOption[] = useMemo(() => (elements ?? []).map((one) => ({ id: one.id, label: one.name })), [elements])
  const submit = () => { if (name.trim()) onMakeDrawing(name.trim(), element) }
  return (
    <Dialog
      open={open} size="m" title={s('frame.newView')} onClose={onClose} data-guide="drawing.chooser"
      {...(drawing ? { onSubmit: submit } : {})}
      actions={(
        <>
          <Button variant="plain" onClick={onClose} data-testid="new-view-cancel">{s('common.cancel')}</Button>
          {drawing && <Button variant="primary" type="submit" disabled={!name.trim()} data-testid="new-drawing-make">{s('newView.makeDrawing')}</Button>}
        </>
      )}
    >
      <div className="new-view" data-testid="new-view">
        <h3 className="new-view__group">{s('newView.modelDraws')}</h3>
        {MODEL_VIEWS.filter((view) => make[view.kind]).map((view) => (
          <button key={view.kind} type="button" className="new-view__row" data-testid={`new-view-${view.kind}`} onClick={() => { onClose(); make[view.kind]?.() }}>
            <strong>{s(view.name)}</strong><span>{s(view.line)}</span>
          </button>
        ))}
        <h3 className="new-view__group">{s('newView.youDraw')}</h3>
        <button type="button" className="new-view__row" aria-pressed={drawing} data-testid="new-view-drawing" onClick={() => setDrawing(true)}>
          <strong>{s('shell.newDrawing')}</strong><span>{s(canDraw ? 'newView.drawingLine' : 'newView.drawingLineNoEditor')}</span>
        </button>
        {drawing && (
          <div className="new-view__naming">
            <TextField label={s('newView.name')} value={name} onChange={setName} autoFocus data-testid="new-drawing-name" />
            {elements && (
              <div>
                <div className="new-view__label">{s('newView.about')}</div>
                {held ? (
                  <p className="new-view__about" data-testid="new-drawing-about">
                    {held.name} <Button variant="quiet" size="small" onClick={() => setElement(undefined)}>{s('newView.aboutOther')}</Button>
                  </p>
                ) : (
                  <Picker label={s('newView.about')} posture="popup" options={options} placeholder={s('newView.aboutHint')} onPick={(option) => setElement(option.id)} />
                )}
              </div>
            )}
            <p className="new-view__note">{s(canDraw ? 'newView.drawingFits' : 'newView.drawingLimit')}</p>
          </div>
        )}
      </div>
    </Dialog>
  )
}
