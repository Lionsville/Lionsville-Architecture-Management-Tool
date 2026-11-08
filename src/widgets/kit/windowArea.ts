// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The window's own corner: the one seam between what the host draws over the
 * page and what the page draws.
 *
 * A desktop window without a title bar (macOS) draws its traffic lights over
 * the top-left of the page and has nowhere left to be dragged by. A surface
 * that stands at the top of the window — the frame's first row, a full-window
 * editor, the poster in full window, the first-run page — marks its top bar
 * with {@link WINDOW_BAR}, and that is all it does: the bar then keeps clear
 * of the lights and moves the window, and every press, field and menu in it
 * stays a press. Nothing outside `windowArea.css` says a width or an app region.
 *
 * The host says what the window is ({@link showWindowArea}), at start and when
 * it changes: in full screen the lights are gone and so is the room for them.
 * A browser tab, Windows and Linux say nothing, and the page is the web's.
 *
 * Anything that covers the window — a dialog, a menu, a list that pops up —
 * is never a drag region, so a press on it is never taken for a move of the
 * window underneath. That is said here too, once.
 */
import './windowArea.css'

/** The class a surface's top bar wears when it stands at the top of the window. */
export const WINDOW_BAR = 'kit-window-bar'

/**
 * The class a surface of our own wears while it covers the window, as the poster
 * in full window does: no drag region of the frame's is left live under it.
 * MUI's dialogs, menus and poppers need nothing; they are known by their own.
 */
export const WINDOW_COVER = 'kit-window-cover'

/** What the host says of its window. */
export type WindowArea = {
  /** Room to keep at the start of a top bar for controls the window draws over it, in px; 0 for none. */
  controls: number
  /** Whether a top bar is what the window is moved by. */
  drag: boolean
}

export const NO_WINDOW_AREA: WindowArea = { controls: 0, drag: false }

/** Say what the window is, on the root the surfaces are drawn under. */
export function showWindowArea(root: HTMLElement, area: WindowArea): void {
  if (area.controls > 0) {
    root.dataset['windowControls'] = ''
    root.style.setProperty('--window-controls-w', `${area.controls}px`)
  } else {
    delete root.dataset['windowControls']
    root.style.removeProperty('--window-controls-w')
  }
  if (area.drag) root.dataset['windowDrag'] = ''
  else delete root.dataset['windowDrag']
}
