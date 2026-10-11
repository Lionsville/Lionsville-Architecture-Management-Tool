// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One thing picked out of a long list, to be added: a *+* that opens a field
 * to search in, its list grouped, each row saying where the thing is.
 *
 * Written once for every place a link is made from either end (ADR-0036,
 * amended 11 October 2026): a unit picked for a scope's *Served by* or a
 * capability's *Assigned to*, a scope for a unit's *Serves*, a capability
 * for its *Responsible for*. Nothing here knows what any of those is — the
 * caller hands the options in, already in their order and grouped, and the
 * words, since a widget has no strings of its own.
 *
 * **Found, not browsed**: an organisation's units run to hundreds, so the
 * field takes the cursor the moment it opens and the list narrows as a
 * person types — the name, the group and the note all match. The list is a
 * combobox, reached and worked by the keyboard: arrows, Enter to pick,
 * Escape to put it away, focus back on the *+* that opened it.
 */
import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

/** One thing on offer. */
export type PickOption = {
  id: string
  label: string
  /** The heading it is listed under; options come grouped, in the order the caller wants the groups. */
  group?: string
  /** Said after the label, quieter: where it is kept, what it sits in. */
  note?: string
  /** Shown and not to be picked; `note` says why. */
  disabled?: boolean
}

export type PickToAddProps = {
  options: readonly PickOption[]
  /** The *+*'s own words: *+ Unit*. */
  label: string
  /** What the field asks, as its label: *Find a unit*. */
  field: string
  /** What the list says when nothing matches. */
  nothing: string
  onPick: (id: string) => void
  /** Its stable name (`platform/controlNames.ts`), on the *+*. */
  guide?: string
  testId?: string
  disabled?: boolean
  /** What stands beside the *+* while the field is closed. */
  children?: ReactNode
}

const matches = createFilterOptions<PickOption>({ stringify: (option) => [option.label, option.group, option.note].filter(Boolean).join(' ') })

const GROUP_HEADING = {
  px: 1.5, pt: 1, pb: 0.25, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary',
} as const

/** The *+*, and the field it opens in its place. */
export function PickToAdd({ options, label, field, nothing, onPick, guide, testId, disabled, children }: PickToAddProps) {
  const [open, setOpen] = useState(false)
  const plus = useRef<HTMLButtonElement | null>(null)
  const wasOpen = useRef(false)
  // Back to the *+* once the field goes, so the keyboard is where it was.
  useEffect(() => {
    if (wasOpen.current && !open) plus.current?.focus()
    wasOpen.current = open
  }, [open])
  if (!open) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
        <Button
          ref={plus} size="small" disabled={disabled} onClick={() => setOpen(true)}
          sx={{ fontSize: 11.5, minWidth: 0, px: 0.75, textTransform: 'none' }}
          {...(guide ? { 'data-guide': guide } : {})} {...(testId ? { 'data-testid': testId } : {})}
        >
          {label}
        </Button>
        {children}
      </Box>
    )
  }
  return (
    <GroupedPicker
      options={options} field={field} nothing={nothing} {...(testId ? { testId: `${testId}-field` } : {})}
      onPick={(id) => { setOpen(false); onPick(id) }} onClose={() => setOpen(false)}
    />
  )
}

/** The field: a combobox over the options, grouped where they say a group, that takes the cursor when it opens. */
export function GroupedPicker({ options, field, nothing, onPick, onClose, testId }: {
  options: readonly PickOption[]
  field: string
  nothing: string
  onPick: (id: string) => void
  onClose?: () => void
  testId?: string
}) {
  const grouped = options.some((option) => option.group !== undefined)
  const id = useId()
  return (
    <Autocomplete
      size="small" openOnFocus autoHighlight fullWidth
      options={options}
      value={null}
      {...(grouped ? { groupBy: (option: PickOption) => option.group ?? '' } : {})}
      // A group the listbox's own way (ARIA's `group`, named by its heading),
      // rather than a list inside the list, which a reader cannot follow.
      renderGroup={(params) => (
        <li key={params.key} role="group" aria-labelledby={`${id}-${params.key}`}>
          <Box id={`${id}-${params.key}`} sx={GROUP_HEADING}>{params.group}</Box>
          <Box component="ul" role="presentation" sx={{ p: 0, m: 0 }}>{params.children}</Box>
        </li>
      )}
      getOptionLabel={(option) => option.label}
      getOptionDisabled={(option) => option.disabled === true}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      filterOptions={matches}
      noOptionsText={nothing}
      onChange={(_event, option) => { if (option) onPick(option.id) }}
      // A pick closes the list too, and is answered by `onChange`; going away
      // from it — Escape, or elsewhere — puts the field away.
      onClose={(_event, reason) => { if (reason === 'escape' || reason === 'blur') onClose?.() }}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <Typography component="span" sx={{ fontSize: 12.5, flex: 1, minWidth: 0 }}>{option.label}</Typography>
          {option.note && (
            <Typography component="span" sx={{ fontSize: 10.5, color: 'text.secondary', pl: 1, whiteSpace: 'nowrap' }}>
              {option.note}
            </Typography>
          )}
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params} autoFocus label={field}
          slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, ...(testId ? { 'data-testid': testId } : {}) } }}
        />
      )}
    />
  )
}
