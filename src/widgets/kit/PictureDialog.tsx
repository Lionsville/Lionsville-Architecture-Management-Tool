// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The one export dialog: a view to a file, whatever the view. The board, the
 * sheet and its Coverage, the poster, the chart and the technology landscape
 * each had their own, or none, with a different name, unnamed choices and a
 * title block whose fields stayed open while it was off. Every one is now this:
 * *Export <name>*, each choice under its name, the title block's words open
 * only while it is drawn, a warning where the print comes out too small, and
 * one button that says what it does.
 *
 * It decides nothing about what is drawn: each view hands in what it offers
 * (`children` in `PictureGroup`s, a title block, a preview) and does the work in
 * `onSave`. A failure is said in place and the dialog stays up.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { Button } from './Button'
import { Dialog } from './Dialog'
import './PictureDialog.css'

export type PictureDialogProps = {
  /** The view's name: the dialog is *Export <name>* everywhere. */
  readonly name: string
  /** What the one button says: *Save PNG*, *Save PDF*; the kit's *Save picture* where absent. */
  readonly saveWord?: string
  /** Do it; a rejection is said in place and the dialog stays. Resolves before the dialog closes. */
  readonly onSave: () => Promise<void> | void
  readonly onClose: () => void
  /** Said over the choices: what the export is. */
  readonly about?: ReactNode
  /** The choices, each a `PictureGroup`. */
  readonly children?: ReactNode
  /** The strip with client, author and date, where the view draws one. */
  readonly titleBlock?: PictureTitleBlock
  /** A warning, where what comes out is hard to read: under 7 pt, or a very large picture. */
  readonly warning?: string
  /** Facts under the choices: a size, what is cut. */
  readonly facts?: ReactNode
  /** A preview beside the choices. */
  readonly preview?: ReactNode
  /** The dialog is held while something outside it runs (a board's own export). */
  readonly working?: boolean
  /** How the failure reads, given its message. */
  readonly failed?: (message: string) => string
  readonly 'data-testid'?: string
  /** On the one button. */
  readonly saveTestId?: string
  readonly open?: boolean
  /** The view closes it itself once its own work is done (a board's export runs on after the press). */
  readonly closesItself?: boolean
}

export type PictureTitleBlock = {
  readonly on: boolean
  readonly onChange: (on: boolean) => void
  /** Its fields, told whether they may be written: only while it is drawn. */
  readonly fields: (disabled: boolean) => ReactNode
  /** What the tick says, where it is not the kit's *Draw the title block*. */
  readonly label?: string
  readonly hint?: string
}

/** A choice of the export, with its name shown above it as a field's is. */
export function PictureGroup({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="kit-field kit-picture__group" role="group" aria-label={label}>
      <span className="kit-field__label" aria-hidden="true">{label}</span>
      {children}
    </div>
  )
}

export function PictureDialog(props: PictureDialogProps) {
  const { t } = useStrings()
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const held = busy || props.working === true
  const save = async () => {
    // A view that closes it itself holds it with `working` while its own work runs; there is nothing to wait on here.
    if (props.closesItself) { await props.onSave(); return }
    setBusy(true)
    setFailure(undefined)
    try {
      await props.onSave()
      props.onClose()
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }
  const block = props.titleBlock
  const options = (
    <div className="kit-picture__options">
      {props.about !== undefined && <div className="kit-picture__about">{props.about}</div>}
      {props.children}
      {block && (
        <div className="kit-picture__block">
          <label className="kit-picture__tick">
            <input type="checkbox" checked={block.on} disabled={held} onChange={(event) => block.onChange(event.target.checked)} data-testid="picture-title-block" />
            <span>{block.label ?? t('kit.picture.titleBlock')}</span>
          </label>
          {block.hint && <span className="kit-picture__hint">{block.hint}</span>}
          <div className="kit-picture__fields">{block.fields(!block.on || held)}</div>
        </div>
      )}
      {props.warning && <p className="kit-picture__warn" role="note" data-testid="picture-warning">{props.warning}</p>}
      {props.facts !== undefined && <div className="kit-picture__facts">{props.facts}</div>}
    </div>
  )
  return (
    <Dialog
      open={props.open ?? true} size={props.preview !== undefined ? 'l' : 'm'} title={t('kit.picture.title', { name: props.name })} onClose={props.onClose} working={held}
      data-testid={props['data-testid']}
      {...(failure !== undefined ? { error: props.failed ? props.failed(failure) : t('kit.picture.failed', { message: failure }) } : {})}
      actions={(
        <>
          <Button onClick={props.onClose} disabled={held}>{t('kit.focused.cancel')}</Button>
          <Button variant="primary" working={held} data-testid={props.saveTestId} onClick={() => { void save() }}>
            {busy ? t('kit.picture.busy') : props.saveWord ?? t('kit.picture.save')}
          </Button>
        </>
      )}
    >
      {props.preview !== undefined
        ? <div className="kit-picture">{options}<div className="kit-picture__preview">{props.preview}</div></div>
        : options}
    </Dialog>
  )
}
