// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Documents the OS handed us, until something in a window is listening.
 *
 * Double-clicking a `.lvarch` in Finder starts the app and fires `open-file`
 * before there is a window, never mind a React tree with a subscription in it;
 * on macOS it may also arrive when the app runs with every window closed.
 * Sending the command then is sending it into the dark, so it waits here for
 * the renderer to say it is listening (`app:listening`, from the preload) —
 * the same answer the menu's commands wait on (`appMenu.ts`), sent after them.
 * Where the app is up and has no window, one is made for it.
 */
export type OpenedDocuments = {
  /** A path the OS handed us: sent now, or held until a window listens. */
  arrived(path: string): void
  /** A window listens now: what waited is sent, in the order it came. */
  heard(): void
}

export function openedDocuments(deps: {
  listening: () => boolean
  /** Whether the app is ready to make a window, and whether it has one. */
  ready: () => boolean
  windowOpen: () => boolean
  makeWindow: () => void
  send: (path: string) => void
}): OpenedDocuments {
  const waiting: string[] = []
  return {
    arrived(path) {
      if (deps.listening()) { deps.send(path); return }
      waiting.push(path)
      if (deps.ready() && !deps.windowOpen()) deps.makeWindow()
    },
    heard() {
      for (const path of waiting.splice(0)) deps.send(path)
    },
  }
}
