// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A question that needs an answer before anything else. One family in three
 * widths and one anatomy: the title says the act, the body says the effect and
 * what it holds, the buttons say the outcome. Editing is a panel, and an ordinary
 * step is confirmed by Undo and not by asking.
 *
 * MUI's for the focus trap, for the portal, and for putting the focus back where
 * it was. Escape means no; while the answer is `working` there is nothing left to
 * say no to, so Escape and the scrim do nothing. An `error` is said in place,
 * over the buttons, and the question stays.
 *
 * With `onSubmit` the body and buttons are a form, so Enter in a field answers,
 * by the button that says `type="submit"`.
 *
 * The parts a dialog is made of beside its own words are here too, since each
 * is only ever seen in one: radio rows that name each outcome (`DialogChoices`),
 * what the question is about (`DialogFacts`), and the block that says there is no
 * way back (`DialogDanger`).
 */
import { useId } from 'react'
import type { FormEvent, ReactNode } from 'react'
import MuiDialog from '@mui/material/Dialog'
import './Dialog.css'

export type DialogSize = 's' | 'm' | 'l'

export type DialogProps = {
  open: boolean
  /** 440, 560 or 1040 px. */
  size?: DialogSize
  /** The act: *Open acme-logistics.lvarch*. */
  title: string
  children: ReactNode
  /** The answers, plain first and the outcome last. */
  actions: ReactNode
  /** No, by Escape or the scrim. */
  onClose: () => void
  error?: string
  working?: boolean
  onSubmit?: () => void
  'data-guide'?: string
  'data-testid'?: string
}

export function Dialog({
  open, size = 's', title, children, actions, onClose, error, working = false, onSubmit, 'data-guide': guide, 'data-testid': testId,
}: DialogProps) {
  const titleId = useId()
  const parts = (
    <>
      <h2 className="kit-dialog__title" id={titleId}>{title}</h2>
      <div className="kit-dialog__body">{children}</div>
      {error && <p className="kit-dialog__error" role="alert">{error}</p>}
      <div className="kit-dialog__actions">{actions}</div>
    </>
  )
  return (
    <MuiDialog
      open={open}
      maxWidth={false}
      aria-labelledby={titleId}
      onClose={() => { if (!working) onClose() }}
      slotProps={{
        paper: { className: 'kit-dialog', 'data-size': size, 'data-guide': guide, 'data-testid': testId } as object,
        backdrop: { className: 'kit-dialog__scrim' },
      }}
    >
      {onSubmit
        ? (
          <form
            className="kit-dialog__form"
            onSubmit={(event: FormEvent) => { event.preventDefault(); if (!working) onSubmit() }}
          >
            {parts}
          </form>
        )
        : parts}
    </MuiDialog>
  )
}

export type DialogChoice<V extends string = string> = {
  value: V
  /** The outcome, named. */
  label: string
  /** What it does, under the label. */
  effect?: string
  /** No way back: the effect is said in the danger ink. */
  danger?: boolean
  'data-testid'?: string
}

/** One outcome per row, each named and said. */
export function DialogChoices<V extends string = string>({ label, value, options, onChange }: {
  /** The question the choices answer, for a screen reader; the dialog's title has already said it to the eye. */
  label: string
  value: V
  options: readonly DialogChoice<V>[]
  onChange: (value: V) => void
}) {
  const name = useId()
  return (
    <fieldset className="kit-dialog__choices">
      <legend className="kit-dialog__legend">{label}</legend>
      {options.map((option) => (
        <label key={option.value} className="kit-dialog__choice">
          <input type="radio" name={name} checked={option.value === value} onChange={() => onChange(option.value)} data-testid={option['data-testid']} />
          <span>
            <span className="kit-dialog__choice-label">{option.label}</span>
            {' '}
            {option.effect && <span className="kit-dialog__effect" data-danger={option.danger || undefined}>{option.effect}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

/** What the question is about: a file's contents, the thing being moved. */
export function DialogFacts({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="kit-dialog__facts">
      <div className="kit-dialog__facts-title">{title}</div>
      {children && <div className="kit-dialog__facts-detail">{children}</div>}
    </div>
  )
}

/** There is no way back from this, and what will be gone. */
export function DialogDanger({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="kit-dialog__danger">
      <div className="kit-dialog__danger-title">{title}</div>
      {children && <div className="kit-dialog__danger-detail">{children}</div>}
    </div>
  )
}
