// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Back and Forward on the desktop (ADR-0033): the window's own history,
 * pressed from inside the page.
 *
 * A browser tab has a Back of its own, its keys and its gestures, and they
 * move the same history the shell writes places into (`placeHistory.ts`), so
 * nothing is drawn there. A desktop window has none of those, and the host
 * says so in `WindowChrome.backForward`: then the bar draws the two buttons,
 * at its start after the space the window controls take, and the other ways
 * in every desktop app has — the Go menu with its keys, the mouse's back and
 * forward buttons, the trackpad's swipe — arrive as host commands or as the
 * mouse's own buttons, and all of them end in `history.back()` or
 * `history.forward()`. One history, whichever was pressed.
 *
 * **Greyed out at either end**, as the window's Navigation API says
 * (`navigation.canGoBack`, `canGoForward`), read again whenever its current
 * entry changes. Where there is no Navigation API both stay pressable, and
 * pressing one at an end does nothing, which is what the window's own does.
 *
 * **Behind a dialog.** The buttons are covered by it like everything else on
 * the bar, and what does not come through the bar — a key, a menu item, a
 * mouse button, a swipe — is not taken while one is open: a dialog belongs to
 * the page it was opened on, and a key that moved the page under a person
 * typing into it would be the one way to lose what they typed without having
 * pressed anything on the page.
 */
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import type { Translate } from '../i18n'
import type { WindowChrome } from '../platform/windowChrome'
import { BackIcon, ForwardIcon } from '../widgets/icons'

/** As much of the Navigation API as the bar reads: absent in a window that has none. */
type NavigationLike = Pick<EventTarget, 'addEventListener' | 'removeEventListener'> & {
  readonly canGoBack: boolean
  readonly canGoForward: boolean
}

type Ends = { canGoBack: boolean; canGoForward: boolean }

/** Both pressable: what a window with no Navigation API is told. */
const UNKNOWN: Ends = { canGoBack: true, canGoForward: true }

function navigationOf(): NavigationLike | undefined {
  return (window as { navigation?: NavigationLike }).navigation
}

/** Where the window's history stands, kept as it moves. */
export function useHistoryEnds(): Ends {
  const [ends, setEnds] = useState<Ends>(() => readEnds(navigationOf()))
  useEffect(() => {
    const navigation = navigationOf()
    if (!navigation) return
    const update = () => setEnds((was) => {
      const now = readEnds(navigation)
      return now.canGoBack === was.canGoBack && now.canGoForward === was.canGoForward ? was : now
    })
    navigation.addEventListener('currententrychange', update)
    navigation.addEventListener('navigatesuccess', update)
    update()
    return () => {
      navigation.removeEventListener('currententrychange', update)
      navigation.removeEventListener('navigatesuccess', update)
    }
  }, [])
  return ends
}

function readEnds(navigation: NavigationLike | undefined): Ends {
  return navigation ? { canGoBack: navigation.canGoBack, canGoForward: navigation.canGoForward } : UNKNOWN
}

/**
 * Is a dialog open over the page? Asked of what is on screen, because a
 * dialog is opened by whichever screen owns it and the shell holds no list of
 * them: one with the `dialog` role that nothing has hidden — a modal hides
 * whatever is behind it, a second dialog under a first included.
 */
export function dialogIsOpen(): boolean {
  return Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]'))
    .some((found) => found.closest('[aria-hidden="true"]') === null)
}

/**
 * Back or Forward from something that is not on the bar — a menu item, its
 * key, a mouse button, a swipe — unless a dialog is open.
 */
export function goInHistory(which: 'back' | 'forward'): void {
  if (dialogIsOpen()) return
  if (which === 'back') window.history.back()
  else window.history.forward()
}

/**
 * The mouse's back and forward buttons, on a host that asks for Back and
 * Forward: buttons 3 and 4 as the page sees them, on every platform. Not in a
 * browser tab, whose own Back already answers them.
 */
export function useMouseHistoryButtons(chrome: WindowChrome): void {
  const on = chrome.backForward === true
  useEffect(() => {
    if (!on) return
    const onMouseUp = (event: MouseEvent) => {
      if (event.button !== 3 && event.button !== 4) return
      event.preventDefault()
      goInHistory(event.button === 3 ? 'back' : 'forward')
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [on])
}

/** The two buttons, where the host asks for them; nothing anywhere else. */
export function BackForward({ chrome, s }: { chrome: WindowChrome; s: Translate }) {
  if (!chrome.backForward) return null
  return <BackForwardButtons s={s} />
}

function BackForwardButtons({ s }: { s: Translate }) {
  const { canGoBack, canGoForward } = useHistoryEnds()
  const button = { width: 28, height: 28, color: 'text.secondary' } as const
  return (
    <Box data-testid="back-forward" sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      {/* A disabled button fires nothing, so the tooltip hangs off a span. */}
      <Tooltip title={s('shell.back')}>
        <span>
          <IconButton size="small" aria-label={s('shell.back')} disabled={!canGoBack} onClick={() => window.history.back()} sx={button}>
            <BackIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={s('shell.forward')}>
        <span>
          <IconButton size="small" aria-label={s('shell.forward')} disabled={!canGoForward} onClick={() => window.history.forward()} sx={button}>
            <ForwardIcon />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  )
}
