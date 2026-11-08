// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What floats over the page: a menu, a popover, a list under a field, a tooltip.
 *
 * **A press inside one never reaches what lies beneath it.** React sends an event
 * on along its own tree, and a portal is still a child there: a tooltip over a card
 * selected the card, and one over a tab switched the tab. So the press and the keys
 * stop at the edge of the surface, once, here and not on each item. React's stop
 * stops the native event too, at the portal's container, so a listener on the
 * document going up does not hear it either. One in the capture phase still does,
 * and that is the way to listen for every press: what must hear them all, a guided
 * step for one, takes them there.
 *
 * **A press outside a menu or a popover closes it and does nothing else**, with
 * either button, as a menu of the desktop's own does: what is beneath is not chosen
 * by the press that put the menu away. A list under a field is not that: it goes
 * when the field loses the focus, and the press that took the focus acts, as it does
 * from any field.
 *
 * **The second press of a double press is the first one's.** A surface goes with the
 * first and the second then lands on what was under it, so for as long as two presses
 * count as one, in about the same place, it is dropped.
 *
 * Tooltips, `Select`'s list and `Autocomplete`'s have no wrapper here: the theme
 * gives them `pressStaysHere`. Everything else that floats comes from this file, and
 * `build/surfaces.test.ts` holds new code to it.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent, Ref, SyntheticEvent } from 'react'
import MuiMenu from '@mui/material/Menu'
import type { MenuProps } from '@mui/material/Menu'
import MuiPopover from '@mui/material/Popover'
import type { PopoverActions, PopoverProps } from '@mui/material/Popover'
import MuiPopper from '@mui/material/Popper'
import type { PopperProps } from '@mui/material/Popper'

const stop = (event: SyntheticEvent) => event.stopPropagation()

/** A press and a key, stopped: on a surface's root. A handler on an item runs first. */
export const pressStaysHere = {
  onClick: stop,
  onAuxClick: stop,
  onDoubleClick: stop,
  onContextMenu: stop,
  onMouseDown: stop,
  onMouseUp: stop,
  onPointerDown: stop,
  onPointerUp: stop,
  onTouchStart: stop,
  onTouchEnd: stop,
  onKeyDown: stop,
  onKeyUp: stop,
} as const

/** How long two presses count as one, and how far apart they may be: the common desktop's. */
const SECOND_PRESS_MS = 500
const SECOND_PRESS_PX = 4
const PRESS_PARTS = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'auxclick', 'dblclick'] as const

function dropSecondPress(at: { x: number; y: number }): void {
  const drop = (event: Event) => {
    const { clientX, clientY } = event as globalThis.MouseEvent
    if (Math.abs(clientX - at.x) > SECOND_PRESS_PX || Math.abs(clientY - at.y) > SECOND_PRESS_PX) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  for (const part of PRESS_PARTS) window.addEventListener(part, drop, true)
  setTimeout(() => { for (const part of PRESS_PARTS) window.removeEventListener(part, drop, true) }, SECOND_PRESS_MS)
}

type Close = ((event: object, reason: 'backdropClick' | 'escapeKeyDown') => void) | undefined

/** The rule for a surface that opens and closes over a backdrop. */
function useModalSurface(open: boolean, onClose: Close) {
  const pressed = useRef<{ x: number; y: number } | null>(null)
  const was = useRef(open)
  useEffect(() => {
    // A press closed it, whether on an item or beside the list.
    if (was.current && !open && pressed.current) dropSecondPress(pressed.current)
    if (open) pressed.current = null
    was.current = open
  }, [open])
  return {
    ...pressStaysHere,
    // While it goes it is still under the pointer, and an item must not act twice.
    onClickCapture: (event: MouseEvent) => {
      if (!open) { event.stopPropagation(); return }
      // `detail` is 0 for the click a key makes: that has no second press.
      pressed.current = event.detail > 0 ? { x: event.clientX, y: event.clientY } : null
    },
    onContextMenu: (event: MouseEvent) => {
      event.stopPropagation()
      const target = event.target as Element
      // A field keeps its own menu, for paste.
      if (!target.closest('input, textarea, [contenteditable="true"]')) event.preventDefault()
      if (open && target.classList.contains('MuiBackdrop-root')) onClose?.(event, 'backdropClick')
    },
  }
}

/** MUI's menu with the rule, for a list of its `MenuItem`s. A list of entries is the kit's `Menu`. */
export function SurfaceMenu(props: MenuProps) {
  return <MuiMenu {...useModalSurface(props.open, props.onClose as Close)} {...props} />
}

/** How far from the window's edge a surface stays: MUI's own margin. */
const WINDOW_MARGIN = 16

/**
 * **A popover stays inside the window as it grows.** It is placed once, when it
 * opens, under what opened it; a part that folds out afterwards (a new person's
 * fields, a longer list) grew it past the window's foot, where its buttons could
 * not be reached and nothing scrolled. Grown past the foot it moves up as far as it
 * must, and once it is taller than the window it scrolls inside itself (the
 * paper's own height limit). It does not move back down as it shrinks again, so a
 * list that filters keeps its top where the eye is.
 */
function useStaysInWindow(open: boolean, action: PopoverProps['action']) {
  const actions = useRef<PopoverActions | null>(null)
  const [paper, setPaper] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!open || !paper || typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(() => {
      const { top, bottom } = paper.getBoundingClientRect()
      if (bottom > window.innerHeight - WINDOW_MARGIN || top < 0) actions.current?.updatePosition()
    })
    watch.observe(paper)
    return () => watch.disconnect()
  }, [open, paper])
  const keep = useCallback((held: PopoverActions | null) => {
    actions.current = held
    passOn(action, held)
  }, [action])
  return { keep, paperRef: setPaper }
}

function passOn<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value)
  else if (ref) (ref as { current: T | null }).current = value
}

/** MUI's popover with the rule, and kept inside the window. */
export function SurfacePopover(props: PopoverProps) {
  const { keep, paperRef } = useStaysInWindow(props.open, props.action)
  const paper = props.slotProps?.paper
  const withRef = typeof paper === 'function'
    ? (state: Parameters<typeof paper>[0]) => ({ ...paper(state), ref: paperRef })
    : { ...paper, ref: paperRef }
  return <MuiPopover {...useModalSurface(props.open, props.onClose as Close)} {...props} action={keep} slotProps={{ ...props.slotProps, paper: withRef as never }} />
}

/** MUI's popper with the rule: no backdrop, so nothing to close it but its owner. */
export function SurfacePopper(props: PopperProps) {
  return <MuiPopper {...pressStaysHere} {...props} />
}

/** What a surface carries to say which control opened it: that control's id. */
export const SURFACE_OWNER = 'data-surface-owner'

/**
 * Whether a blur takes the focus out of what is listening. A list or a calendar a
 * control in it opened is in a portal, and so not inside it to the page, but the
 * focus going there has not left: the surface names its control
 * (`SURFACE_OWNER`), and that control is looked for here.
 */
export function focusLeaves(event: { currentTarget: HTMLElement; relatedTarget: EventTarget | null }): boolean {
  const to = event.relatedTarget as Element | null
  if (!to) return true
  if (event.currentTarget.contains(to)) return false
  const owner = to.closest<HTMLElement>(`[${SURFACE_OWNER}]`)?.getAttribute(SURFACE_OWNER)
  return !(owner && [...event.currentTarget.querySelectorAll('[id]')].some((one) => one.id === owner))
}
