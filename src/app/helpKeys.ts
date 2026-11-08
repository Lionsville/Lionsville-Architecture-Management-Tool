// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The two keys of the help, on every screen: `?` shows the keyboard shortcuts
 * and F1 — or ⌘? (Ctrl+?) where the platform leaves that chord to the page —
 * opens the help at the place that answers for the screen that is up.
 *
 * Heard once, on the window, in the capture phase, before any part of a screen.
 * `?` used to be the frame's only where no board was up and no dialog anywhere
 * in the page, and a board's own only while the focus was inside the board: so
 * it did nothing on a board with the focus in row one, the tree or the panel,
 * nothing while a list's preview or the on-screen guidance (both dialogs) was
 * up, and nothing on the first page, which has no frame. Now the one listener
 * takes it, stops it there so a board's keymap does not answer it a second
 * time, and lets the frame say which sheet: a board's own where one is up.
 *
 * Typing keeps both keys: a field, a text area, a list's type-ahead.
 */
import { useEffect, useRef } from 'react'
import type { Screen } from '../agent/screen'
import { viewPage } from '../agent/screen'
import type { DesignDiagram } from '../model/types'
import type { HostCommand } from '../platform/hostCommands'
import type { ShellParts } from './shellParts'
import { FIRST_RUN_HELP, PANEL_HELP, helpForScreen } from '../platform/helpPlaces'

const TEXT_INPUTS = /^(text|search|email|url|tel|password|number|date|datetime-local|month|week|time)$/

/** Is this key going into something being written? Then it is a character, not a command. */
export function takesText(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  if (target instanceof HTMLInputElement) return TEXT_INPUTS.test(target.type || 'text')
  // A menu or a list reads printable keys as type-ahead.
  return target.closest('[role="menu"], [role="listbox"], [role="combobox"]') !== null
}

export type HelpKey = 'shortcuts' | 'help' | undefined

/** Which of the help's keys this is, if any. */
export function helpKeyOf(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'altKey'>): HelpKey {
  if (event.altKey) return undefined
  if (event.key === 'F1') return 'help'
  const modified = event.metaKey || event.ctrlKey
  // With ⌘ or Ctrl held, some keyboards report the key under ? as / with Shift.
  if (modified && (event.key === '?' || (event.key === '/' && event.shiftKey))) return 'help'
  return event.key === '?' && !modified ? 'shortcuts' : undefined
}

/** The help's place for what is on screen: the page, its tab, or the view that is up. */
export function helpPlaceOf(screen: Screen | undefined, tab?: string): string {
  if (!screen) return FIRST_RUN_HELP
  const page = screen.page?.page ?? (screen.open?.view ? viewPage(screen.open.view.kind as DesignDiagram['kind']) : undefined)
  const pageTab = (screen.page as { tab?: string } | undefined)?.tab ?? tab
  // A frame's panel stands over whatever is beside it, and is what a press of F1 is about.
  if (screen.panel) return helpForScreen(screen.panel)
  return helpForScreen(page ?? 'home', pageTab)
}

/** Where the help answers for the screen up now, with the tab the frame keeps for its page. */
export function helpHere(parts: Pick<ShellParts, 'agent' | 'frame'>): string {
  const screen = parts.agent.screenNow()
  const { tab, tabOf } = parts.frame.get()
  const page = screen.page?.page ?? (screen.open?.view ? viewPage(screen.open.view.kind as DesignDiagram['kind']) : undefined)
  return helpPlaceOf(screen, tabOf !== undefined && tabOf === page ? tab : undefined)
}

export function useHelpKeys(deps: {
  send: (command: HostCommand) => void
  /** Where the help answers for what is up; undefined on the first page. */
  place: () => string
  /** The frame is up and shows the sheet of keys; without it, `?` opens the help's own list of them. */
  framed: boolean
}) {
  const latest = useRef(deps)
  latest.current = deps
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const said = helpKeyOf(event)
      if (!said || event.defaultPrevented || takesText(event.target)) return
      event.preventDefault()
      event.stopPropagation()
      const { send, place, framed } = latest.current
      if (said === 'help') send({ type: 'manual', section: place() })
      else if (framed) send({ type: 'shortcuts' })
      else send({ type: 'manual', section: PANEL_HELP.shortcuts })
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
}
