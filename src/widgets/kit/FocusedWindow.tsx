// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A record edited with nothing else on screen: the dialog family's largest member,
 * for writing that wants the whole window. Cancel at the start of its bar, the
 * record's number and what is being done, whatever the screen puts in the middle
 * (*Write | Preview*), and Save at the end. The body scrolls under the bar, with
 * an optional column of facts beside it.
 *
 * **It covers the shell's toolbar**, so the bar takes over what that toolbar did
 * for the window: it keeps clear of the traffic lights and is the handle that
 * moves the window. So it takes the host's window chrome, without a page below it
 * to leave room for. The kit knows the two measures it needs and not where they
 * come from.
 *
 * **Cancel asks first if anything changed**, and only then; Escape is Cancel.
 * Escape in a list that is open inside the body closes the list first, since the
 * list stops the key.
 *
 * **What holds the save** is said by the save button (`saveRefused`) and at the
 * field, which is the screen's. Save is one step for Undo, also the screen's.
 */
import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import MuiDialog from '@mui/material/Dialog'
import { useStrings } from '../../i18n/LanguageContext'
import { Button } from './Button'
import { Dialog } from './Dialog'
import './FocusedWindow.css'

/** What the bar must do about the window. The host's `WindowChrome` is one of these. */
export type FocusedWindowChrome = { controlsInset: number; draggable: boolean }

export type FocusedWindowProps = {
  open: boolean
  /** What is being done: *Editing an observation*. */
  title: string
  /** The record's number, in the mono face, before the title. */
  number?: string
  windowChrome: FocusedWindowChrome
  /** The bar's middle: a Segmented *Write | Preview*. */
  middle?: ReactNode
  children: ReactNode
  /** A column of facts beside the writing. */
  aside?: ReactNode
  /** Anything to lose, so that Cancel asks. */
  changed: boolean
  /** The outcome: *Save changes*. */
  saveLabel: string
  onSave: () => void
  /** What holds the save, said in the button's tooltip. */
  saveRefused?: string
  onCancel: () => void
  working?: boolean
  error?: string
  'data-guide'?: string
}

export function FocusedWindow({
  open, title, number, windowChrome, middle, children, aside, changed, saveLabel, onSave, saveRefused, onCancel,
  working = false, error, 'data-guide': guide,
}: FocusedWindowProps) {
  const { t } = useStrings()
  const titleId = useId()
  const [asking, setAsking] = useState(false)

  const cancel = () => {
    if (working) return
    if (changed) setAsking(true)
    else onCancel()
  }

  return (
    <MuiDialog
      open={open}
      fullScreen
      hideBackdrop
      aria-labelledby={titleId}
      onClose={cancel}
      slotProps={{ paper: { className: 'kit-focused', 'data-guide': guide } as object }}
    >
      <div
        className="kit-focused__bar"
        data-draggable={windowChrome.draggable || undefined}
        style={windowChrome.controlsInset > 0 ? { paddingInlineStart: windowChrome.controlsInset } : undefined}
      >
        <div className="kit-focused__start">
          <Button variant="quiet" onClick={cancel} data-guide={guide && `${guide}-cancel`}>{t('kit.focused.cancel')}</Button>
          {number && <span className="kit-focused__number">{number}</span>}
          <h1 className="kit-focused__title" id={titleId}>{title}</h1>
        </div>
        {middle && <div className="kit-focused__middle">{middle}</div>}
        <div className="kit-focused__end">
          {error && <span className="kit-focused__error" role="alert">{error}</span>}
          <Button variant="primary" onClick={onSave} reason={saveRefused} working={working} data-guide={guide && `${guide}-save`}>
            {saveLabel}
          </Button>
        </div>
      </div>
      <div className="kit-focused__body" data-aside={aside ? true : undefined}>
        <div className="kit-focused__main">{children}</div>
        {aside && <div className="kit-focused__aside">{aside}</div>}
      </div>
      <Dialog
        open={asking}
        title={t('kit.focused.askTitle')}
        onClose={() => setAsking(false)}
        actions={(
          <>
            <Button variant="quiet" onClick={() => setAsking(false)}>{t('kit.focused.keepEditing')}</Button>
            <Button variant="danger" onClick={() => { setAsking(false); onCancel() }}>{t('kit.focused.discard')}</Button>
          </>
        )}
      >
        <p>{t('kit.focused.askBody')}</p>
      </Dialog>
    </MuiDialog>
  )
}
