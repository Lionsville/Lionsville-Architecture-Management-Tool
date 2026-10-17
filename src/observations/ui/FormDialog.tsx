// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The one shell every dialog on the observations page is drawn in: the forms
 * that make records and the short questions alike.
 *
 * A title that names what it is about, an intro line in one size, the content
 * with one padding, and a footer: what is missing at the left once the submit
 * has been pressed, Cancel, and the submit, contained, on the right — every
 * word in sentence case.
 *
 * **Nothing half-written is lost by accident.** A click beside the dialog
 * never closes it, and Escape does not either once something has been
 * written (`dirty`): Cancel is the way out of a form with something in it.
 *
 * **Enter answers it** from any single-line field, as the submit does; a
 * field that means something else by Enter — adding a row to a list, a
 * search that only filters — says so by handling the key itself.
 *
 * **The focus lands on the first field.** The page is a dialog too, and its
 * focus trap takes back a focus a field claims while this one is still
 * opening: the field that had it gets it again once the dialog has opened.
 */
import { useId, useRef, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import { FieldsDialog } from '../../widgets/CompactForms'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'

export type FormDialogProps = {
  open: boolean
  title: string
  /** One line under the title saying what the dialog is for. */
  intro?: ReactNode
  /** `sm` for a question, `lg` for a form that makes records. */
  size?: 'sm' | 'lg'
  /** Something has been written: Escape no longer closes it. */
  dirty?: boolean
  onCancel: () => void
  onSubmit: () => void
  submitLabel: ReactNode
  /** Only where there is nothing to answer with at all; otherwise the submit is pressed and says what is missing. */
  submitDisabled?: boolean
  submitTestId?: string
  submitGuide?: string
  /** What stops the submit, at the footer's left; absent where nothing does. */
  problem?: string
  problemTestId?: string
  s: Translate
  children: ReactNode
}

/** The single-line fields Enter answers the dialog from. */
const SINGLE_LINE = new Set(['text', 'search', 'date', 'number', 'email', 'url', 'tel'])

/** Enter in a single-line field the field did not take for itself. */
export function submitsOnEnter(event: KeyboardEvent): boolean {
  const target = event.target
  return event.key === 'Enter' && !event.defaultPrevented && !event.shiftKey && !event.nativeEvent.isComposing
    && target instanceof HTMLInputElement && SINGLE_LINE.has(target.type)
}

export function FormDialog(props: FormDialogProps) {
  const { open, title, intro, size = 'sm', dirty = false, onCancel, onSubmit, problem, s } = props
  const titleId = useId()
  const field = useRef<HTMLElement | null>(null)
  const remember = (event: FocusEvent<HTMLElement>) => {
    if (event.target.matches('input, textarea, [role="combobox"]')) field.current = event.target
  }
  const refocus = () => {
    const held = field.current
    if (held?.isConnected && document.activeElement !== held) held.focus()
  }
  return (
    <FieldsDialog
      open={open} maxWidth={size} fullWidth aria-labelledby={titleId}
      onClose={(_event, reason) => { if (reason === 'escapeKeyDown' && !dirty) onCancel() }}
      onKeyDown={(event) => { if (submitsOnEnter(event)) { event.preventDefault(); onSubmit() } }}
      slotProps={{ paper: { onFocus: remember }, transition: { onEntered: refocus, onExited: () => { field.current = null } } }}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {intro && <Typography color="text.secondary" sx={{ fontSize: 14 }}>{intro}</Typography>}
          {props.children}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5, ...(size === 'lg' ? { borderTop: 1, borderColor: 'divider' } : {}) }}>
        <Box sx={{ flex: 1 }}>
          {problem && <Typography role="alert" color="error" sx={{ fontSize: 13 }} data-testid={props.problemTestId}>{problem}</Typography>}
        </Box>
        <Button onClick={onCancel} sx={{ textTransform: 'none' }}>{s('common.cancel')}</Button>
        <Button
          variant="contained" onClick={onSubmit} disabled={props.submitDisabled} sx={{ textTransform: 'none' }}
          data-testid={props.submitTestId} data-guide={props.submitGuide}
        >
          {props.submitLabel}
        </Button>
      </DialogActions>
    </FieldsDialog>
  )
}

/** The footer's line for refused fields: *1 field needs filling in*, or how many. */
export function problemsLine(count: number, s: Translate): string | undefined {
  if (count === 0) return undefined
  return count === 1 ? s('observation.formProblemsOne') : s('observation.formProblemsMany', { count })
}
