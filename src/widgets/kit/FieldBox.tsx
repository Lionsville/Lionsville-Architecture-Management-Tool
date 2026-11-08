// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * MUI's text field with the kit's label: above the box, in the kit's words size,
 * and not in a notch of the outline. A screen that needs what only MUI's field
 * does — a list under it from an Autocomplete, its own adornments, a select of
 * MUI items — takes this, so a form reads the same whether a field in it is the
 * kit's own `TextField` or this. Every prop is MUI's; `sx` places the whole, the
 * label with it.
 */
import { useId } from 'react'
import Box from '@mui/material/Box'
import MuiTextField from '@mui/material/TextField'
import type { TextFieldProps } from '@mui/material/TextField'
import './FieldBox.css'

export type FieldBoxProps = TextFieldProps

export function FieldBox({ label, id: given, sx, fullWidth, slotProps, ...rest }: FieldBoxProps) {
  const own = useId()
  const id = given ?? own
  if (label === undefined || label === null || label === '') {
    return <MuiTextField {...rest} id={id} sx={sx} fullWidth={fullWidth} slotProps={slotProps} />
  }
  const labelId = `${id}-label`
  const select = rest.select ? { select: { ...(slotProps?.select as object | undefined), labelId } } : {}
  return (
    <Box className="kit-field kit-fieldBox" data-full={fullWidth || undefined} sx={sx}>
      <label className="kit-field__label" id={labelId} htmlFor={id}>{label}</label>
      <MuiTextField {...rest} id={id} fullWidth slotProps={{ ...slotProps, ...select }} />
    </Box>
  )
}
