// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** The name of the error a page the browser would not draw as an image is said with. */
export const PICTURE_REFUSED = 'PictureRefused'

/**
 * The library draws the page as an SVG image, and an image the browser will not
 * load rejects with its error event: "[object Event]", which says nothing. That
 * is the browser refusing the page as an image — most often a character XML
 * cannot carry somewhere in it — and it is said so, by a name the picture
 * dialog knows.
 */
export function refused(cause: unknown): unknown {
  if (cause instanceof Error || typeof Event === 'undefined' || !(cause instanceof Event)) return cause
  return Object.assign(new Error(`the browser could not draw the page as an image (an ${cause.type} event)`), { name: PICTURE_REFUSED })
}
