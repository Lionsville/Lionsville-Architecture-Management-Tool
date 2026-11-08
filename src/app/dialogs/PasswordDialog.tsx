// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The password a saved copy leaves under, and the one it is opened with
 * (ADR-0023).
 *
 * Two shapes of the same dialog, because the two moments differ in what a
 * mistake costs. *Set* asks twice: a typo in a password nobody can recover
 * is the file lost, and the second field is the only check there is. *Enter*
 * asks once and carries the last answer's verdict as an error under the
 * field, so a wrong password is a second try and not a second toast.
 *
 * Confirm is disabled rather than refused: an empty password is no protection,
 * and the field says so by not offering the button.
 *
 * *Set* also asks who is in the copy, as a choice with its effect said (ADR-0036
 * §8): every person in the register carried as their pseudonym, with no address.
 * The last moment anybody is looking at what leaves is this one.
 */
import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { Translate } from '../../i18n'
import { Dialog, DialogChoices } from '../../widgets/kit/Dialog'
import { TextField } from '../../widgets/kit/Field'

export type PasswordMode = 'set' | 'enter'

/** The password, and — when setting one — whether the copy leaves without names. */
export type PasswordAnswer = { password: string; withoutNames: boolean }

/** What the question is about: the file being opened, or the organisation being copied and what it holds. */
export type PasswordAbout = { file?: string; name?: string; holds?: string }

export type PasswordDialogProps = {
  open: boolean
  mode: PasswordMode
  /** What went wrong with the last answer, under the field. */
  error?: string
  about?: PasswordAbout
  onCancel: () => void
  onConfirm: (answer: PasswordAnswer) => void
  /** The copy goes to the browser's downloads, asking nobody where. */
  downloads?: boolean
  s: Translate
}

export function PasswordDialog({ open, mode, error, about, onCancel, onConfirm, downloads = false, s }: PasswordDialogProps) {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [people, setPeople] = useState<'named' | 'without'>('named')
  useEffect(() => { if (open) { setPassword(''); setRepeat(''); setPeople('named') } }, [open, mode])

  const setting = mode === 'set'
  const mismatch = setting && repeat.length > 0 && repeat !== password
  const ready = password.length > 0 && (!setting || repeat === password)
  const confirm = () => { if (ready) onConfirm({ password, withoutNames: setting && people === 'without' }) }
  /**
   * *Enter* confirms, and its default is prevented: the dialog closes inside
   * this keydown and hands the focus back to whatever opened it — the ⋯
   * button, where the file was opened from the menu — and a browser delivers
   * the same key's keypress there, which a button takes as a press. The menu
   * opened again behind the next dialog and stayed over the page.
   */
  const confirmOnEnter = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    confirm()
  }
  const title = setting
    ? s('seal.setTitle', { name: about?.name || s('common.organisation') })
    : s('seal.enterTitle', { name: about?.file || s('seal.thisFile') })

  return (
    <Dialog
      open={open} size={setting ? 'm' : 's'} title={title} onClose={onCancel}
      actions={{
        cancel: { onClick: onCancel, label: s('common.cancel') },
        outcome: { disabled: !ready, onClick: confirm, 'data-testid': 'password-confirm', label: s(setting ? (downloads ? 'seal.confirmDownload' : 'seal.confirmSet') : 'seal.confirmEnter') },
      }}
    >
      {setting
        ? about?.holds && <p>{s('seal.setBody', { holds: about.holds })}</p>
        : <p>{s('seal.enterBody')}</p>}
      <TextField
        autoFocus
        type="password"
        autoComplete={setting ? 'new-password' : 'current-password'}
        label={s('seal.password')}
        value={password}
        onChange={setPassword}
        onKeyDown={confirmOnEnter}
        data-testid="password"
        {...(!setting && error ? { error } : {})}
      />
      {setting && (
        <>
          <TextField
            type="password"
            autoComplete="new-password"
            label={s('seal.repeat')}
            value={repeat}
            onChange={setRepeat}
            onKeyDown={confirmOnEnter}
            data-testid="password-repeat"
            {...(mismatch ? { error: s('seal.mismatch') } : {})}
          />
          <p>{s('seal.setWarning')}</p>
          <div className="kit-field">
            <span className="kit-field__label">{s('seal.people')}</span>
            <DialogChoices
              label={s('seal.people')}
              value={people}
              onChange={setPeople}
              options={[
                { value: 'named', label: s('seal.peopleNamed') },
                { value: 'without', label: s('seal.peopleWithout'), effect: people === 'without' ? s('seal.withoutNames') : s('seal.peopleWithoutHint'), 'data-testid': 'password-without-names' },
              ]}
            />
          </div>
        </>
      )}
    </Dialog>
  )
}
