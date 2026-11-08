// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The two rules every key handler keeps, said once.
 *
 * **The command key is the platform's.** ⌘ on a Mac and Ctrl elsewhere, never
 * either: on a Mac, Ctrl+K kills to the end of a line and Ctrl+F moves forward
 * a character in every text field, and a shortcut that also took Ctrl would
 * open search or find from inside one. `build/platformModifier.test.ts` fails
 * on a check that reads both modifiers anywhere but here.
 *
 * **One Escape does one thing, innermost first**: a field reverts or cancels,
 * then a menu or popover closes, then the panel, then the page, and only then a
 * board lets go of what is selected. One rule makes that order:
 *
 * - a handler that acts on a key {@link claimKey claims} it: it prevents the
 *   default and stops it going further;
 * - a handler further out asks {@link keyClaimed} first and leaves a claimed
 *   key alone;
 * - and the outer ones listen in the bubble phase, so the inner ones have had
 *   it first. React's handlers sit on the root, inside the document: the
 *   frame's panel listens on the document, a page on the window, and a board's
 *   selection on the window last of all. A gesture under way (a drag, a line
 *   being drawn) is the innermost thing there is and may listen in capture.
 */

/** Is this a Mac (or an iPad with a keyboard), where the command key is ⌘? */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const raw = nav.userAgentData?.platform || navigator.platform || ''
  return /mac|iphone|ipad/i.test(raw)
}

/** The modifiers a key event carries, as much as these rules read. */
export type Modifiers = { readonly metaKey: boolean; readonly ctrlKey: boolean }

/** Is the platform's command key held, and not the other one: ⌘K on a Mac, Ctrl+K elsewhere. */
export function commandKey(event: Modifiers, mac: boolean = isMac()): boolean {
  return mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey
}

/**
 * Is ⌘ or Ctrl held at all? For a handler of a plain key that stands aside for
 * any chord, and for a wheel, where a Mac's pinch arrives as Ctrl.
 */
export function chordHeld(event: Modifiers): boolean {
  return event.metaKey || event.ctrlKey
}

/** What claiming a key needs of an event: a native one or React's. */
export type Claimable = { preventDefault(): void; stopPropagation(): void; readonly defaultPrevented: boolean }

/** This handler acted on the key: nothing further out acts on it too. */
export function claimKey(event: Claimable): void {
  event.preventDefault()
  event.stopPropagation()
}

/** Did a handler further in already act on this key? Then one further out leaves it. */
export function keyClaimed(event: Pick<Claimable, 'defaultPrevented'>): boolean {
  return event.defaultPrevented
}
