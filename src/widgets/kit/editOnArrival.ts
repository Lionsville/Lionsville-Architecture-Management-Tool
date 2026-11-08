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

/** Start writing when this page shows this record and was asked to, as it opens or while it is up. */
export function useEditAsked(page: string, id: string | undefined, start: () => void): void {
  const latest = useRef(start)
  latest.current = start
  useEffect(() => {
    if (id === undefined) return undefined
    const look = () => { if (takeEditAsked(page, id)) latest.current() }
    look()
    listeners.add(look)
    return () => { listeners.delete(look) }
  }, [page, id])
}
