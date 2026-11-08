// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A record edited with nothing else on screen: the dialog family's largest member,
 * for writing that wants the whole window. Cancel at the start of its bar, the
 * record's number and what is being done, whatever the screen puts in the middle
 * (*Write | Preview*), and Save at the end.
 *
 * **It uses the window.** The writing takes all the width the column of facts
 * leaves, and all the height under the bar, with small margins: a person who asked
 * for the whole window is not handed a column in the middle of it. The writing and
 * the facts scroll each on their own and the window never does, so that no scroll
 * sits inside another: a pane that fills the height keeps its text's scroll, and a
 * form scrolls as a form, its fields as tall as what they hold (`useInFocusedWindow`).
 * On a narrow window the facts stand under the writing, with a press in the bar to
 * fold them out of its way.
 *
 * **It covers the shell's toolbar**, so the bar takes over what that toolbar did
 * for the window: it keeps clear of the traffic lights and is the handle that
 * moves the window. It says so by wearing the window's bar (`windowArea`), which
 * knows what the window asks today, full screen included.
 *
 * **Cancel asks first if anything changed**, and only then; Escape is Cancel.
 * Escape in a list that is open inside the body closes the list first, since the
 * list stops the key.
 *
 * **What holds the save** is said by the save button (`saveRefused`) and at the
 * field, which is the screen's. Save is one step for Undo, also the screen's.
 */
import { createContext, useContext, useId, useState } from 'react'
import type { ReactNode } from 'react'
import MuiDialog from '@mui/material/Dialog'
import { useStrings } from '../../i18n/LanguageContext'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { WINDOW_BAR } from './windowArea'
import './FocusedWindow.css'

export type FocusedWindowProps = {
  open: boolean
  /** What is being done: *Editing an observation*. */
  title: string
  /** The record's number, in the mono face, before the title. */
  number?: string
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

const InFocusedWindow = createContext(false)

/** Whether this stands in a full window: there a field grows with its text, for the window scrolls and has the room. */
export function useInFocusedWindow(): boolean {
  return useContext(InFocusedWindow)
}

export function FocusedWindow({
  open, title, number, middle, children, aside, changed, saveLabel, onSave, saveRefused, onCancel,
  working = false, error, 'data-guide': guide,
}: FocusedWindowProps) {
  const { t } = useStrings()
  const titleId = useId()
  const [asking, setAsking] = useState(false)
  const [asideFolded, setAsideFolded] = useState(false)

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
      <div className={`kit-focused__bar ${WINDOW_BAR}`}>
        <div className="kit-focused__start">
          <Button variant="quiet" onClick={cancel} data-guide={guide && `${guide}-cancel`}>{t('kit.focused.cancel')}</Button>
          {number && <span className="kit-focused__number">{number}</span>}
          <h1 className="kit-focused__title" id={titleId}>{title}</h1>
        </div>
        {middle && <div className="kit-focused__middle">{middle}</div>}
        <div className="kit-focused__end">
          {error && <span className="kit-focused__error" role="alert">{error}</span>}
          {aside && (
            <span className="kit-focused__fold">
              <Button variant="quiet" aria-expanded={!asideFolded} onClick={() => setAsideFolded((was) => !was)}>{t('kit.focused.aside')}</Button>
            </span>
          )}
          <Button variant="primary" onClick={onSave} reason={saveRefused} working={working} data-guide={guide && `${guide}-save`}>
            {saveLabel}
          </Button>
        </div>
      </div>
      <InFocusedWindow.Provider value>
        <div className="kit-focused__body">
          <div className="kit-focused__main">{children}</div>
          {aside && <div className="kit-focused__aside" data-folded={asideFolded || undefined}>{aside}</div>}
        </div>
      </InFocusedWindow.Provider>
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
