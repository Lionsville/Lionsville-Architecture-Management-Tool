// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * MUI's text field with the kit's label: above the box, in the kit's words size,
 * and not in a notch of the outline. A screen that needs what only MUI's field
 * does — a list under it from an Autocomplete, its own adornments, a select of
 * MUI items — takes this, so a form reads the same whether a field in it is the
 * kit's own `TextField` or this. Every prop is MUI's; `sx` places the whole, the
 * label with it.
 *
 * `AutocompleteBox` is MUI's Autocomplete for such a box: the kit's size and the
 * kit's chevron where MUI draws its filled ▼, so its `renderInput` hands its
 * params to `FieldBox` and the field reads as every other one in the form.
 */
import { useId } from 'react'
import type { ElementType, ReactNode } from 'react'
import Box from '@mui/material/Box'
import MuiTextField from '@mui/material/TextField'
import type { TextFieldProps } from '@mui/material/TextField'
import MuiAutocomplete, { createFilterOptions } from '@mui/material/Autocomplete'
import type { AutocompleteProps } from '@mui/material/Autocomplete'
import type { ChipTypeMap } from '@mui/material/Chip'
import { CaretIcon } from '../icons'
import './FieldBox.css'

export type FieldBoxProps = TextFieldProps & {
  /**
   * A control that belongs to the box, drawn beside it and as tall as it: *From the
   * register…*, *Add*. It lines up with the box, not with the label above or the
   * words under it.
   */
  trailing?: ReactNode
}

/** The kit's chevron on a select, where MUI draws its filled ▼. */
function Chevron({ className }: { className?: string }) {
  return <span className={`kit-fieldBox__caret ${className ?? ''}`}><CaretIcon size={12} /></span>
}

export function FieldBox({ label, id: given, sx, fullWidth, slotProps, trailing, ...rest }: FieldBoxProps) {
  const own = useId()
  const id = given ?? own
  const named = !(label === undefined || label === null || label === '')
  const labelId = `${id}-label`
  const select = rest.select ? { select: { IconComponent: Chevron, ...(slotProps?.select as object | undefined), ...(named ? { labelId } : {}) } } : {}
  // An underlined field in a table's cell is the one that stays MUI's own: it has no box to match.
  if (rest.variant === 'standard' && !named) {
    const bare = <MuiTextField {...rest} id={id} sx={sx} fullWidth={fullWidth} slotProps={{ ...slotProps, ...select }} />
    return trailing ? <div className="kit-fieldBox__row" data-standard="">{bare}<span>{trailing}</span></div> : bare
  }
  const field = <MuiTextField {...rest} id={id} fullWidth slotProps={{ ...slotProps, ...select }} />
  // Every box wears the kit's height and outline, a named one with its label above, so no form mixes two sizes.
  return (
    <Box className="kit-field kit-fieldBox" data-full={fullWidth || undefined} sx={sx}>
      {named && <label className="kit-field__label" id={labelId} htmlFor={id} data-required={rest.required || undefined}>{label}</label>}
      {trailing ? <div className="kit-fieldBox__row">{field}<span className="kit-fieldBox__trailing">{trailing}</span></div> : field}
    </Box>
  )
}

/**
 * MUI's Autocomplete at the kit's size, with the kit's chevron. Every prop is
 * MUI's; `renderInput` gives its params to `FieldBox`.
 */
export function AutocompleteBox<
  Value,
  Multiple extends boolean | undefined = false,
  DisableClearable extends boolean | undefined = false,
  FreeSolo extends boolean | undefined = false,
  ChipComponent extends ElementType = ChipTypeMap['defaultComponent'],
>({ className, ...rest }: AutocompleteProps<Value, Multiple, DisableClearable, FreeSolo, ChipComponent>) {
  return (
    <MuiAutocomplete<Value, Multiple, DisableClearable, FreeSolo, ChipComponent>
      size="small"
      popupIcon={<CaretIcon size={12} />}
      {...rest}
      className={`kit-autocomplete ${className ?? ''}`}
    />
  )
}

export { createFilterOptions }
