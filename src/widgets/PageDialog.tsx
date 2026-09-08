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
 * closes it.
 */
import Dialog from '@mui/material/Dialog'
import type { DialogProps } from '@mui/material/Dialog'

export type PageDialogProps = Omit<DialogProps, 'fullScreen' | 'hideBackdrop'> & {
  /** How much of the top of the window belongs to the host, in px. */
  topInset?: number
}

export function PageDialog({ topInset = 0, slotProps, sx, ...rest }: PageDialogProps) {
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
      {...rest}
    />
  )
}
