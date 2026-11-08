// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * **Leave with a draft?** — one rule for every place a person writes something not
 * yet sent or saved: a comment box, a new record's form, an editor. Whatever holds
 * a draft says so (`useDraft`), and whatever leaves a page asks first
 * (`leaveWithDrafts`), with one question the shell draws once (`DraftQuestion`).
 * Leaving drops the draft; *Keep writing* is the default and stays.
 *
 * The drafts are a module's set and not a context: a page is left from places
 * that share no tree with the box being written in — a key on the window, a press
 * in the frame, the window's own close — and each must hear the same answer.
 */
import { useEffect, useState } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { Dialog } from './Dialog'

const held = new Set<symbol>()
/** A move held at the question: made on a yes, and told it stays on Keep writing. */
type Asked = { go: () => void; stay?: (() => void) | undefined }
let asker: ((asked: Asked) => void) | undefined
const watchers = new Set<(holding: boolean) => void>()
const told = () => { for (const watcher of [...watchers]) watcher(held.size > 0) }

/**
 * Whether anything holds a draft, now and whenever that changes: for a host
 * that decides a window's close outside the page (the desktop's main process).
 */
export function watchDrafts(watcher: (holding: boolean) => void): () => void {
  watchers.add(watcher)
  watcher(held.size > 0)
  return () => { watchers.delete(watcher) }
}

/** Says, while `holding`, that something written here would be lost by leaving. */
export function useDraft(holding: boolean): void {
  useEffect(() => {
    if (!holding) return undefined
    const draft = Symbol('draft')
    held.add(draft)
    told()
    return () => { held.delete(draft); told() }
  }, [holding])
}

/** Whether anything on screen holds a draft. */
export function draftHeld(): boolean {
  return held.size > 0
}

/**
 * Leave, asking first where a draft would be lost: `go` runs at once, after a
 * yes, or not at all — and then `stay` runs, for a move that has to be taken
 * back where it was already half made (the window's Back has moved its address).
 */
export function leaveWithDrafts(go: () => void, stay?: () => void): void {
  if (!draftHeld() || !asker) { go(); return }
  asker({ go, stay })
}

/** The question, drawn once by the shell; with none drawn, leaving does not wait on one. */
export function DraftQuestion() {
  const { t } = useStrings()
  const [going, setGoing] = useState<Asked | undefined>(undefined)
  useEffect(() => {
    // A second move asked while the first waits: the first stays where it is.
    asker = (asked) => setGoing((was) => { was?.stay?.(); return asked })
    // The window itself closing: the browser's own question, the only one it allows there.
    const onUnload = (event: BeforeUnloadEvent) => { if (draftHeld()) event.preventDefault() }
    window.addEventListener('beforeunload', onUnload)
    return () => { asker = undefined; window.removeEventListener('beforeunload', onUnload) }
  }, [])
  const leave = () => {
    const asked = going
    setGoing(undefined)
    held.clear()
    told()
    asked?.go()
  }
  const stay = () => {
    const asked = going
    setGoing(undefined)
    asked?.stay?.()
  }
  return (
    <Dialog
      open={going !== undefined} title={t('kit.draft.title')} onClose={stay} onSubmit={stay}
      data-testid="draft-question"
      actions={{
        // Leaving is something else done with the draft, set apart; keeping on writing is the answer.
        aside: [{ danger: true, onClick: leave, 'data-testid': 'draft-leave', label: t('kit.draft.leave') }],
        outcome: { type: 'submit', autoFocus: true, label: t('kit.draft.keep') },
      }}
    >
      <p>{t('kit.draft.body')}</p>
    </Dialog>
  )
}
