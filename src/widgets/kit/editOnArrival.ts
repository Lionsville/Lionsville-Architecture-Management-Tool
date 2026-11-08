// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * **Open it already editing.** ✎ Edit on a preview whose record is written on
 * its own page — a register's row, a building block — goes to that page with its
 * editor open, and so do an address that says `?edit` and an agent's `app.open`
 * with `edit`. The page is often several screens away from whoever asked, so the
 * ask is a one-shot note here, by page and id, that the page takes up as it shows
 * that record (`useEditAsked`), and that is gone once taken.
 */
import { useEffect, useRef } from 'react'

let asked: string | undefined
const listeners = new Set<() => void>()

function keyOf(page: string, id: string): string {
  return `${page}\u0000${id}`
}

/** Ask the page `page` to open record `id` in its editor as it shows it. */
export function askToEdit(page: string, id: string): void {
  asked = keyOf(page, id)
  listeners.forEach((listener) => listener())
}

/** Take the ask for this record, where it is the one waiting: true once. */
export function takeEditAsked(page: string, id: string): boolean {
  if (asked !== keyOf(page, id)) return false
  asked = undefined
  return true
}

/** How long a page that took the ask while it was up may go and hand it back: the move that asked may draw the page again. */
const HAND_BACK_MS = 1000

/**
 * Start writing when this page shows this record and was asked to, as it opens or
 * while it is up. The same record asked for again while it is up — a link with
 * `?edit` to the block on screen — may draw its page afresh on the way (the home
 * under it read again): a page that took the ask and goes at once hands it back,
 * for the page drawn in its place to take up.
 */
export function useEditAsked(page: string, id: string | undefined, start: () => void): void {
  const latest = useRef(start)
  latest.current = start
  useEffect(() => {
    if (id === undefined) return undefined
    let takenAt: number | undefined
    const take = () => takeEditAsked(page, id)
    if (take()) latest.current()
    const look = () => { if (take()) { takenAt = Date.now(); latest.current() } }
    listeners.add(look)
    return () => {
      listeners.delete(look)
      if (takenAt !== undefined && Date.now() - takenAt < HAND_BACK_MS && asked === undefined) asked = keyOf(page, id)
    }
  }, [page, id])
}
