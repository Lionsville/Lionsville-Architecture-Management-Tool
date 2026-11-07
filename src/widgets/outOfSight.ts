// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Work that needs the window drawn, in a window nobody can see.
 *
 * A window that is hidden, minimised or wholly covered draws no frames, and a
 * picture made in it waits for one: the work stands still until the window comes
 * back, and a person who looked away is told nothing. So this says so at once, in
 * every place that can still be seen from outside the window: its title, which a
 * tab strip and a dock show, and a notification where this app already may send
 * one, on the desktop. It never asks for that permission: nobody exporting a
 * picture came to answer a browser's question. Inside the window it is a state, so
 * the first frame they see says what happened.
 *
 * Covered is told by the frames, since a browser may go on saying `visible` of a
 * window it stopped drawing. A long task that holds up the frames and the clock
 * alike is not that, so a frame is only missed by a clock that kept time.
 */
import { useEffect, useState } from 'react'

const STALLED_MS = 1500
const TICK_MS = 500

/** Calls `gone` when the window stops being drawn and `back` when it starts again; answers how to stop watching. */
export function watchOutOfSight(on: { gone(): void; back(): void }, stalledMs = STALLED_MS): () => void {
  let out = false
  const say = (now: boolean) => {
    if (now === out) return
    out = now
    if (now) on.gone()
    else on.back()
  }
  const hidden = () => document.visibilityState === 'hidden'
  const changed = () => say(hidden())
  document.addEventListener('visibilitychange', changed)
  let frame = Date.now()
  let tick = frame
  let waiting: number | undefined
  const drawn = () => {
    frame = Date.now()
    if (!hidden()) say(false)
    waiting = requestAnimationFrame(drawn)
  }
  const frames = typeof requestAnimationFrame === 'function'
  if (frames) waiting = requestAnimationFrame(drawn)
  const clock = setInterval(() => {
    const now = Date.now()
    if (frames && now - frame > stalledMs && now - tick < stalledMs) say(true)
    tick = now
  }, TICK_MS)
  changed()
  return () => {
    document.removeEventListener('visibilitychange', changed)
    clearInterval(clock)
    if (waiting !== undefined) cancelAnimationFrame(waiting)
  }
}

/**
 * Whether the window is out of sight while `working`, saying so outside it too.
 * The title goes back when the window does, unless something else moved it since.
 */
export function useOutOfSight(working: boolean, words: { title: string; body: string }): boolean {
  const [out, setOut] = useState(false)
  const { title, body } = words
  useEffect(() => {
    if (!working) return undefined
    let before: string | undefined
    let shown: Notification | undefined
    const stop = watchOutOfSight({
      gone: () => {
        setOut(true)
        before = document.title
        document.title = title
        shown = notified(title, body)
      },
      back: () => {
        setOut(false)
        if (before !== undefined && document.title === title) document.title = before
        before = undefined
        shown?.close()
        shown = undefined
      },
    })
    return () => {
      stop()
      setOut(false)
      if (before !== undefined && document.title === title) document.title = before
      shown?.close()
    }
  }, [working, title, body])
  return out
}

/** A notification where one may be sent; nowhere else, and never a question about it. */
function notified(title: string, body: string): Notification | undefined {
  try {
    return typeof Notification === 'function' && Notification.permission === 'granted' ? new Notification(title, { body }) : undefined
  } catch {
    return undefined
  }
}
