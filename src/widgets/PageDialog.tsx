// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A page: a dialog that fills the window, or the window below the shell's
 * toolbar.
 *
 * Every full-window view — documentation, decisions, the roadmap, a plan,
 * history — is a MUI dialog because a dialog portals out of the canvas's DOM,
 * so the board's shortcuts cannot reach a reader. When the host says how much
 * of the top it keeps for itself (`topInset`), the dialog starts below that:
 * no backdrop, so the toolbar above stays visible and clickable, and no focus
 * trap, so its buttons can be pressed while the page is up. Escape still
 * closes it — but not from a field that picks from a list (an autocomplete):
 * there Escape closes the list, and then leaves the field, and only the next
 * press closes the page, so a person putting a list away does not lose the
 * page with it (ADR-0044 §2).
 *
 * Inside the frame it is no dialog at all but a place in the main column
 * (`PlacePage`); the dialog is what is left for a page drawn with no frame
 * above it, which is a test of that page alone.
 */
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import type { DialogProps } from '@mui/material/Dialog'
import { usePlaceHost } from './kit/placeHost'
import { claimKey, keyClaimed } from './kit/keys'
import { DraftArea, leaveWithDrafts, useDraftSurface } from './kit/drafts'
import type { DraftSurface } from './kit/drafts'

export type PageDialogProps = Omit<DialogProps, 'fullScreen' | 'hideBackdrop'> & {
  /** How much of the top of the window belongs to the host, in px. */
  topInset?: number
  /** The page's surface for drafts, where the screen makes it to hold surfaces of its own inside (`kit/drafts`). */
  surface?: DraftSurface
}

/** Where a person types: Escape there means leave the field, never the page. */
const TYPED_IN = 'textarea, [contenteditable="true"], input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"]):not([type="color"]):not([type="file"])'

/**
 * Escape from a field that picks from a list, or from one that is typed in,
 * leaves the field for the page itself, and goes no further: the page keeps
 * the focus and the field keeps what was typed, so the next Escape reaches the
 * page and closes it. The reflex that puts away a completion or leaves a field
 * never loses the page and a draft with it.
 */
function leavesFieldFirst(event: object): boolean {
  const target = (event as { target?: unknown }).target
  if (!(target instanceof HTMLElement) || !(target.closest('.MuiAutocomplete-root') || target.matches(TYPED_IN))) return false
  const page = target.closest<HTMLElement>('[role="dialog"], [data-place-page]')
  if (page) page.focus()
  else target.blur()
  return true
}

/** Is a modal up over the page? Then Escape is its own. */
function modalUp(): boolean {
  return Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'))
    .some((found) => found.closest('[aria-hidden="true"]') === null)
}

/**
 * A page inside the frame: a place in the main column, not a layer over the
 * window (decision 1). It takes the focus as it opens and hands it back as it
 * closes, as the dialog did, and Escape closes the page on top, from wherever
 * the focus is, since the rows stay pressable beside it.
 */
function PlacePage({ host, open, onClose, children, slotProps, sx, surface: given, ...rest }: Omit<PageDialogProps, 'topInset'> & { host: HTMLElement }) {
  const page = useRef<HTMLDivElement>(null)
  // A page over another — a plan over the roadmap or a record — is left on its own: a draft on the page under it is not asked about.
  const made = useDraftSurface()
  const surface = given ?? made
  const latestClose = useRef(onClose)
  latestClose.current = onClose
  useEffect(() => {
    if (!open) return
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const here = page.current
    if (here && !here.contains(document.activeElement)) here.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || keyClaimed(event) || modalUp()) return
      // Only the page on top: a plan is up over the roadmap, and each closes by itself.
      if (host.lastElementChild !== page.current) return
      // Claimed either way, so the board under the page does not let go of its selection with the same key.
      claimKey(event)
      if (leavesFieldFirst(event)) return
      // A draft in a box on the page is asked about first (`kit/drafts`).
      leaveWithDrafts(() => latestClose.current?.(event, 'escapeKeyDown'), undefined, surface)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (before?.isConnected && document.activeElement === document.body) before.focus({ preventScroll: true })
    }
  }, [open, host, surface])
  if (!open) return null
  const { paper } = (slotProps ?? {}) as { paper?: Record<string, unknown> }
  const { sx: paperSx, ...paperRest } = (paper ?? {}) as { sx?: object | object[] }
  const { keepMounted: _keepMounted, maxWidth: _maxWidth, fullWidth: _fullWidth, transitionDuration: _transition, disableEscapeKeyDown: _escape, ...own } = rest as Record<string, unknown>
  return createPortal(
    <Box
      ref={page}
      className="kit-place"
      role="region"
      tabIndex={-1}
      data-place-page=""
      sx={[...([] as object[]).concat(sx as object ?? []), ...([] as object[]).concat(paperSx ?? [])]}
      {...paperRest}
      {...own}
    >
      <DraftArea surface={surface}>{children}</DraftArea>
    </Box>,
    host,
  )
}

export function PageDialog(props: PageDialogProps) {
  const host = usePlaceHost()
  if (host?.page) {
    const { topInset: _topInset, ...rest } = props
    return <PlacePage host={host.page} {...rest} />
  }
  return <WindowPage {...props} />
}

/** A page drawn with no frame above it: the dialog, a surface of its own as a place is. */
function WindowPage({ topInset = 0, slotProps, sx, onClose, children, surface: given, ...rest }: PageDialogProps) {
  const own = useDraftSurface()
  const surface = given ?? own
  const under = topInset > 0
  return (
    <Dialog
      fullScreen
      hideBackdrop={under}
      disableEnforceFocus={under}
      disableScrollLock={under}
      sx={[{ top: topInset }, ...(Array.isArray(sx) ? sx : [sx])]}
      slotProps={{
        ...slotProps,
        paper: {
          ...(slotProps?.paper as object),
          sx: [
            { bgcolor: 'background.default', display: 'flex', flexDirection: 'column' },
            ...([] as object[]).concat((slotProps?.paper as { sx?: object | object[] } | undefined)?.sx ?? []),
          ],
        },
      }}
      onClose={(event, reason) => {
        if (reason === 'escapeKeyDown' && leavesFieldFirst(event)) return
        leaveWithDrafts(() => onClose?.(event, reason), undefined, surface)
      }}
      {...rest}
    >
      <DraftArea surface={surface}>{children}</DraftArea>
    </Dialog>
  )
}
