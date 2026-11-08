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
import { useEffect, useId, useRef } from 'react'
import type { FormEvent, ReactNode } from 'react'
import MuiDialog from '@mui/material/Dialog'
import { Button } from './Button'
import type { ButtonProps } from './Button'
import './Dialog.css'

/** One answer: a button's own props, its words as `label`. Its look is the footer's to give. */
export type DialogAct = Omit<ButtonProps, 'variant' | 'size' | 'children'> & {
  label: ReactNode
  /** No way back: drawn in the danger ink, wherever it stands. */
  danger?: boolean
  'data-testid'?: string
  'data-guide'?: string
}

/** An answer, or nothing where a condition left it out (`ready && { … }`). */
type MaybeAct = DialogAct | false | null | undefined | '' | 0

/**
 * A dialog's answers, by what each is rather than how it looks, so every dialog
 * says them in one order with one look (`DialogFooter`).
 */
export type DialogAnswers = {
  /** No: leaves everything as it was. The quiet button, just before the outcome; a dialog that only tells says Close here. */
  cancel?: DialogAct
  /** Another answer to the same question, beside the outcome: *Keep theirs* to *Keep mine*. Plain. */
  also?: readonly MaybeAct[]
  /** The outcome: the one primary, last; a danger where there is no way back. */
  outcome?: MaybeAct
  /** Something else to do with what the dialog is about — *Remove*, *End today*, *Copy as text* — at the row's far start, apart from the answers, the destructive first. */
  aside?: readonly MaybeAct[]
}

const present = (acts: readonly MaybeAct[] | undefined): DialogAct[] =>
  (acts ?? []).filter((act): act is DialogAct => Boolean(act))

function Answer({ act, variant }: { act: DialogAct; variant: 'plain' | 'quiet' | 'primary' }) {
  const { label, danger, ...rest } = act
  return <Button {...rest} variant={danger ? 'danger' : variant}>{label}</Button>
}

/**
 * **Dialog footer**: every dialog's answers in one order and one look. What
 * else can be done with the subject stands at the far start, the destructive
 * first; the answers stand at the end, a quiet Cancel first and the outcome
 * last, the outcome the one primary or a danger, any other answer plain. A dialog drawn by other means than `Dialog` — a palette, a picker with
 * its own frame — puts this at its foot too (`build/dialogFooter.test.ts`).
 */
export function DialogFooter({ cancel, also, outcome, aside }: DialogAnswers) {
  // The destructive first, so it stands furthest from the answer a person reaches for.
  const before = [...present(aside)].sort((a, b) => Number(Boolean(b.danger)) - Number(Boolean(a.danger)))
  return (
    <div className="kit-dialog__actions">
      {before.length > 0 && (
        <div className="kit-dialog__start">
          {before.map((act, at) => <Answer key={at} act={act} variant="plain" />)}
        </div>
      )}
      {cancel && <Answer act={cancel} variant="quiet" />}
      {present(also).map((act, at) => <Answer key={at} act={act} variant="plain" />)}
      {outcome && <Answer act={outcome} variant="primary" />}
    </div>
  )
}

export type DialogSize = 's' | 'm' | 'l'

export type DialogProps = {
  open: boolean
  /** 440, 560 or 1040 px. */
  size?: DialogSize
  /** The act: *Open acme-logistics.lvarch*. */
  title: string
  children: ReactNode
  /** The answers, said by what each is: the footer gives them their order and look. */
  actions?: DialogAnswers | null
  /** No, by Escape or the scrim. */
  onClose: () => void
  error?: string
  working?: boolean
  onSubmit?: () => void
  /**
   * Stands at a fixed place from the top rather than in the middle: for a dialog whose
   * list grows and shrinks while somebody types, so the field they type in stays put.
   */
  steady?: boolean
  /**
   * Where the focus goes once the question closes, when that is not where it was
   * when it opened: the box a person was writing in, which an Escape had left.
   * Asked as it opens and as it closes; nothing at the close puts the focus back
   * where it was.
   */
  returnFocus?: () => HTMLElement | undefined
  /** Covers what is behind it rather than dimming it: for a dialog whose work repaints the page under it. */
  cover?: boolean
  'data-guide'?: string
  'data-testid'?: string
}

export function Dialog({
  open, size = 's', title, children, actions, onClose, error, working = false, onSubmit, steady = false, returnFocus, cover = false, 'data-guide': guide, 'data-testid': testId,
}: DialogProps) {
  const titleId = useId()
  // Asked as the question opens, whether to take the focus back by itself rather than
  // leave it to MUI; and asked again once it has closed, after MUI's trap has let go.
  const returning = useRef<{ was: Element | null } | undefined>(undefined)
  const wasOpen = useRef(open)
  if (open && !wasOpen.current) returning.current = returnFocus?.() ? { was: document.activeElement } : undefined
  useEffect(() => {
    const closed = wasOpen.current && !open
    wasOpen.current = open
    const held = returning.current
    if (!closed || !held) return
    returning.current = undefined
    const to = returnFocus?.() ?? (held.was instanceof HTMLElement ? held.was : undefined)
    if (to?.isConnected) to.focus()
  }, [open, returnFocus])
  const parts = (
    <>
      <h2 className="kit-dialog__title" id={titleId}>{title}</h2>
      <div className="kit-dialog__body">{children}</div>
      {error && <p className="kit-dialog__error" role="alert">{error}</p>}
      {actions && <DialogFooter {...actions} />}
    </>
  )
  return (
    <MuiDialog
      open={open}
      maxWidth={false}
      aria-labelledby={titleId}
      disableRestoreFocus={returning.current !== undefined}
      onClose={() => { if (!working) onClose() }}
      slotProps={{
        paper: { className: 'kit-dialog', 'data-size': size, 'data-steady': steady ? '' : undefined, 'data-guide': guide, 'data-testid': testId } as object,
        backdrop: { className: 'kit-dialog__scrim', 'data-cover': cover ? '' : undefined } as object,
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
