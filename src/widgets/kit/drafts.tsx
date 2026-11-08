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
 *
 * **Each draft knows the surface it is written on** (`DraftArea`): a page, a
 * preview, a side panel, a full record. Leaving one surface — a preview's ×, a
 * plan's Escape over the page it stands on — asks only about the drafts on it and
 * what it holds, and *Leave and drop it* drops only those: a form beside the
 * preview, or a comment on the page under the plan, stays written and stays
 * guarded. Leaving the place (the frame, Back, ⌘K) asks about every draft.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { Dialog } from './Dialog'

/** Somewhere a draft can be written and that can be left on its own: a page, a preview, a panel, a record. */
export type DraftSurface = { readonly parent: DraftSurface | undefined }

const SurfaceContext = createContext<DraftSurface | undefined>(undefined)

/**
 * A surface of its own, inside the one it is drawn in — or inside `within`, for a
 * screen that makes the surfaces of a page it draws itself: hand it to
 * `DraftArea` and to `leaveWithDrafts`.
 */
export function useDraftSurface(within?: DraftSurface): DraftSurface {
  const drawnIn = useContext(SurfaceContext)
  const parent = within ?? drawnIn
  return useMemo(() => ({ parent }), [parent])
}

/** What is drawn inside is written on `surface`. */
export function DraftArea({ surface, children }: { readonly surface: DraftSurface; readonly children: ReactNode }) {
  return <SurfaceContext.Provider value={surface}>{children}</SurfaceContext.Provider>
}

/** The surface this is drawn on: for a press that leaves it (`PageClose`, `PageBack`). */
export function useLeaveSurface(): (go: () => void, stay?: () => void) => void {
  const surface = useContext(SurfaceContext)
  return useCallback((go: () => void, stay?: () => void) => leaveWithDrafts(go, stay, surface), [surface])
}

/**
 * How a door out of a surface that asks its own question goes: through that
 * question. A full-window editor holds its text back until Save, so a door in its
 * column of facts asks as Cancel does, and on a yes puts the text back first.
 * Anywhere else a door leaves the place, asking about every draft.
 */
const ThroughContext = createContext<((go: () => void) => void) | undefined>(undefined)
export const LeaveThrough = ThroughContext.Provider
export function useLeaveThrough(): (go: () => void) => void {
  return useContext(ThroughContext) ?? leaveWithDrafts
}

/** Every draft, with the surface it is written on (none: the place itself). */
const held = new Map<symbol, DraftSurface | undefined>()
/** A move held at the question: made on a yes, dropping only `drafts`, and told it stays on Keep writing. */
type Asked = { go: () => void; stay?: (() => void) | undefined; drafts: readonly symbol[] }

function on(surface: DraftSurface | undefined, leaving: DraftSurface): boolean {
  for (let at = surface; at; at = at.parent) if (at === leaving) return true
  return false
}
/** The drafts a leave would drop: every one, or those on the surface left and on what it holds. */
function draftsOn(leaving?: DraftSurface): symbol[] {
  return [...held].filter(([, surface]) => !leaving || on(surface, leaving)).map(([draft]) => draft)
}
let asker: ((asked: Asked) => void) | undefined
const watchers = new Set<(holding: boolean) => void>()

/**
 * The box last written in: the question is often asked after an Escape has left
 * it (the first Escape leaves the box, the second the page), and Keep writing
 * goes back to it rather than to wherever the focus was left.
 */
let writtenIn: HTMLElement | undefined
let listening = false
function listenForWriting() {
  if (listening || typeof document === 'undefined') return
  listening = true
  document.addEventListener('input', (event) => {
    if (event.target instanceof HTMLElement && event.target.closest('textarea, input, [contenteditable="true"], [contenteditable=""]')) writtenIn = event.target
  }, true)
}
/** Where Keep writing puts the focus: the box written in, if it is still on screen and not where the focus already is. */
function boxWrittenIn(): HTMLElement | undefined {
  const box = writtenIn
  if (!box?.isConnected || box === document.activeElement) return undefined
  return box
}
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

/**
 * Says, while `holding`, that something written here would be lost by leaving.
 * Answers a way to let go of it at once, for a surface that asked its own
 * question and is about to go (`FocusedWindow`).
 */
export function useDraft(holding: boolean): () => void {
  const surface = useContext(SurfaceContext)
  const mine = useRef<symbol | undefined>(undefined)
  useEffect(() => {
    if (!holding) return undefined
    const draft = Symbol('draft')
    mine.current = draft
    held.set(draft, surface)
    told()
    return () => { mine.current = undefined; held.delete(draft); told() }
  }, [holding, surface])
  return useCallback(() => {
    if (mine.current && held.delete(mine.current)) told()
  }, [])
}

/** Whether anything on screen holds a draft; with `surface`, on that surface or what it holds. */
export function draftHeld(surface?: DraftSurface): boolean {
  return draftsOn(surface).length > 0
}

/**
 * Leave, asking first where a draft would be lost: `go` runs at once, after a
 * yes, or not at all — and then `stay` runs, for a move that has to be taken
 * back where it was already half made (the window's Back has moved its address).
 * With `surface`, only that surface is being left: a draft anywhere else is not
 * asked about, and not dropped.
 */
export function leaveWithDrafts(go: () => void, stay?: () => void, surface?: DraftSurface): void {
  const drafts = draftsOn(surface)
  if (drafts.length === 0 || !asker) { go(); return }
  asker({ go, stay, drafts })
}

/** The question, drawn once by the shell; with none drawn, leaving does not wait on one. */
export function DraftQuestion() {
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
    // Only what goes is dropped: a draft elsewhere is still on screen, and still asked about.
    for (const draft of asked?.drafts ?? []) held.delete(draft)
    told()
    asked?.go()
  }
  const stay = () => {
    const asked = going
    setGoing(undefined)
    asked?.stay?.()
  }
  return <LeaveQuestion open={going !== undefined} onKeep={stay} onLeave={leave} />
}

/**
 * The one question before something written is dropped, wherever it is asked —
 * leaving a page, Cancel in an editor, closing a new record's form: one title,
 * one sentence, and one order through the kit's footer. *Keep writing* is the
 * quiet Cancel, focused, so Return and Escape keep; *Leave and drop it* is the
 * danger to its right, never the default. Keep writing puts the focus back in
 * the box last written in, which an Escape may have left.
 */
export function LeaveQuestion({ open, onKeep, onLeave }: { readonly open: boolean; readonly onKeep: () => void; readonly onLeave: () => void }) {
  const { t } = useStrings()
  useEffect(listenForWriting, [])
  // Leaving drops the box: the focus goes back where it was, not into what is being dropped.
  const left = useRef(false)
  const shown = useRef(open)
  if (open && !shown.current) left.current = false
  shown.current = open
  const returnFocus = useCallback(() => (left.current ? undefined : boxWrittenIn()), [])
  return (
    <Dialog
      open={open} title={t('kit.draft.title')} onClose={onKeep} onSubmit={onKeep} returnFocus={returnFocus}
      data-testid="draft-question"
      actions={{
        cancel: { type: 'submit', autoFocus: true, label: t('kit.draft.keep'), 'data-testid': 'draft-keep' },
        outcome: { danger: true, onClick: () => { left.current = true; onLeave() }, 'data-testid': 'draft-leave', label: t('kit.draft.leave') },
      }}
    >
      <p>{t('kit.draft.body')}</p>
    </Dialog>
  )
}
