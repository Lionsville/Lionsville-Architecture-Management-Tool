// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { DesignElement, ElementId } from '../types'
/**
 * A dense sheet: 188 functions in 17 areas, of every shape an area comes in at
 * that size — a few loose tiles, a long run of them, groupings side by side and
 * more of them than a page is wide. The size a sheet kept by a large
 * organisation reaches, with generated names of up to about 90 characters.
 * Deterministic, and named after nothing.
 */
export const DENSE_SHEET = { areas: 17, elements: 188 } as const

const DENSE_WORDS = ['intake', 'planning', 'settlement', 'records', 'scheduling', 'review', 'support', 'routing', 'quality', 'reporting', 'archive', 'outreach']

export function denseSheet(): DesignElement[] {
  // Each area: loose tiles, or its groupings' sizes. The fourth is wider than a page side by side.
  const shapes: (number | number[])[] = [
    4, [3, 5], 7, [6, 6, 6, 6, 6, 6], [2, 2], 7, [4, 6, 3], 1, [5, 5, 3],
    10, [3], [2, 4, 2, 4], 6, [6, 2], 3, [8, 3],
  ]
  const out: DesignElement[] = []
  const name = (at: number, long: boolean) => {
    const word = DENSE_WORDS[at % DENSE_WORDS.length] as string
    const base = `${word.charAt(0).toUpperCase()}${word.slice(1)} ${at}`
    return long ? `${base} and the ${DENSE_WORDS[(at + 5) % DENSE_WORDS.length]} that keeps it going across every region and every shift` : base
  }
  let at = 0
  const add = (parentId: ElementId | undefined) => {
    const id = `dense-${at}`
    out.push({ id, kind: 'function', name: name(at, at % 11 === 3), lifecycle: 'live', isManaged: false, aspects: {}, order: at, ...(parentId !== undefined ? { parentId } : {}) })
    at += 1
    return id
  }
  for (const shape of shapes) {
    const area = add(undefined)
    if (typeof shape === 'number') for (let i = 0; i < shape; i += 1) add(area)
    else for (const size of shape) {
      const grouping = add(area)
      for (let i = 0; i < size; i += 1) add(grouping)
    }
  }
  // The seventeenth takes what is left of the 188, loose.
  const last = add(undefined)
  while (out.length < DENSE_SHEET.elements) add(last)
  return out
}
