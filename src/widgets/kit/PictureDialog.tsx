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
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { Dialog } from './Dialog'
import { TextField } from './Field'
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
  /** The page under it is repainted for the picture: covered rather than dimmed, so it does not look changed. */
  readonly cover?: boolean
}

export type PictureTitleBlock = {
  readonly on: boolean
  readonly onChange: (on: boolean) => void
  /** Its fields, told whether they may be written: only while it is drawn. */
  readonly fields: (disabled: boolean) => ReactNode
  /** What the tick says, where it is not the kit's *Title block*. */
  readonly label?: string
  /** Said beside the tick; the kit's *Client, author and date along the bottom* where absent. */
  readonly hint?: string
}

/** A title block's words as a view keeps them: each may be empty, and then the picture draws what its hint says. */
export type PictureTitleValues = { readonly client: string; readonly author: string; readonly date: string }

/**
 * The title block's words, one part for every view that draws one: Client,
 * Author and Date in that order, each saying under it what an empty one draws,
 * each written as the field is left. The board's and Coverage's had their own,
 * in another order and one without its hints.
 */
export function PictureTitleFields({ values, clientFrom, disabled, onChange }: {
  readonly values: PictureTitleValues
  /** What an empty client draws: the scope's name. */
  readonly clientFrom: string
  readonly disabled: boolean
  readonly onChange: (patch: Partial<PictureTitleValues>) => void
}) {
  const { t } = useStrings()
  return (
    <>
      <TitleField label={t('kit.picture.client')} hint={t('kit.picture.clientEmpty', { name: clientFrom })} held={values.client} disabled={disabled} onCommit={(client) => onChange({ client })} />
      <TitleField label={t('kit.picture.author')} hint={t('kit.picture.authorEmpty')} held={values.author} disabled={disabled} onCommit={(author) => onChange({ author })} />
      <TitleField label={t('kit.picture.date')} hint={t('kit.picture.dateEmpty')} held={values.date} disabled={disabled} onCommit={(date) => onChange({ date })} />
    </>
  )
}

/** One value of the title block: it lands as the person leaves the field. */
function TitleField({ label, hint, held, disabled, onCommit }: { label: string; hint: string; held: string; disabled: boolean; onCommit(next: string): void }) {
  const [typed, setTyped] = useState(held)
  useEffect(() => setTyped(held), [held])
  return (
    <TextField
      label={label} hint={hint} value={typed} disabled={disabled} onChange={setTyped}
      onBlur={() => { if (typed.trim() !== held.trim()) onCommit(typed.trim()) }}
    />
  )
}

/**
 * The strip a laid-out page draws along its foot while it is being made into a
 * picture: client, title, author and date, as a board's export draws them onto
 * its bitmap. It is never on the page otherwise.
 */
export function PictureTitleStrip({ client, title, author, date }: { readonly client: string; readonly title: string; readonly author?: string; readonly date: string }) {
  const { t } = useStrings()
  const cells = [
    { label: t('kit.picture.client'), value: client },
    { label: t('kit.picture.titleWord'), value: title, wide: true },
    ...(author ? [{ label: t('kit.picture.author'), value: author }] : []),
    { label: t('kit.picture.date'), value: date },
  ]
  return (
    <div className="kit-picture-strip" data-testid="picture-title-strip">
      {cells.map((cell) => (
        <div key={cell.label} className="kit-picture-strip__cell" data-wide={cell.wide ? '' : undefined}>
          <span className="kit-picture-strip__label">{cell.label}</span>
          <span className="kit-picture-strip__value">{cell.value}</span>
        </div>
      ))}
    </div>
  )
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
          <span className="kit-picture__hint">{block.hint ?? t('kit.picture.titleBlockHint')}</span>
          <div className="kit-picture__fields">{block.fields(!block.on || held)}</div>
        </div>
      )}
      {props.warning && <p className="kit-picture__warn" role="note" data-testid="picture-warning">{props.warning}</p>}
      {props.facts !== undefined && <div className="kit-picture__facts">{props.facts}</div>}
    </div>
  )
  return (
    <Dialog
      open={props.open ?? true} cover={props.cover === true} size={props.preview !== undefined ? 'l' : 'm'} title={t('kit.picture.title', { name: props.name })} onClose={props.onClose} working={held}
      data-testid={props['data-testid']}
      {...(failure !== undefined ? { error: props.failed ? props.failed(failure) : t('kit.picture.failed', { message: failure }) } : {})}
      actions={{
        cancel: { onClick: props.onClose, disabled: held, label: t('kit.focused.cancel') },
        outcome: { working: held, 'data-testid': props.saveTestId, onClick: () => { void save() }, label: busy ? t('kit.picture.busy') : props.saveWord ?? t('kit.picture.save') },
      }}
    >
      {props.preview !== undefined
        ? <div className="kit-picture">{options}<div className="kit-picture__preview">{props.preview}</div></div>
        : options}
    </Dialog>
  )
}
