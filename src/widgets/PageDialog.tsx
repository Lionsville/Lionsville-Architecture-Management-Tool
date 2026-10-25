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
 */
import Dialog from '@mui/material/Dialog'
import type { DialogProps } from '@mui/material/Dialog'

export type PageDialogProps = Omit<DialogProps, 'fullScreen' | 'hideBackdrop'> & {
  /** How much of the top of the window belongs to the host, in px. */
  topInset?: number
}

/**
 * Escape from a field that picks from a list leaves the field for the page
 * itself, and goes no further: the page keeps the focus, so the next Escape
 * reaches it and closes it.
 */
function leavesFieldFirst(event: object): boolean {
  const target = (event as { target?: unknown }).target
  if (!(target instanceof HTMLElement) || !target.closest('.MuiAutocomplete-root')) return false
  const page = target.closest<HTMLElement>('[role="dialog"]')
  if (page) page.focus()
  else target.blur()
  return true
}

export function PageDialog({ topInset = 0, slotProps, sx, onClose, ...rest }: PageDialogProps) {
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
        onClose?.(event, reason)
      }}
      {...rest}
    />
  )
}
