// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One dialog where there were two.
 *
 * "New group" asked for a group and its first project; "New project" asked for
 * a project and which group to file it under. They were two dialogs because a
 * group and a project were two records — a group could not exist on its own,
 * and a project could not hold another one. Every scope is the same document
 * now (ADR-0012 §1), so there is one question: what is it called, and where
 * does it go.
 *
 * A name that is one of the six folders a scope writes into is refused here,
 * where a person can see it and type another, rather than quietly suffixed by
 * the addressing (`scopePath.ts`).
 *
 * **Served by, from the start** (ADR-0036, amended 13 October 2026). Where the
 * organisation has units, one may be picked to serve the new scope — the
 * same choices a scope's *Served by* offers, a unit of a type that serves one
 * domain and serves one already shown and said why not. It is written once
 * the scope is made, as the step of the scope that keeps the unit; the
 * dialog only holds the pick.
 */
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import { FieldLabel, FieldsDialog, SectionHeading } from '../../widgets/CompactForms'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import type { Translate } from '../../i18n'
import { PickToAdd } from '../../widgets/PickToAdd'
import type { PickOption } from '../../widgets/PickToAdd'
import type { ScopeSummary } from '../../projects/scope'
import { isReservedScopeName } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { slug } from '../../model/keys'
import { ScopeField } from './ScopeField'

export type NewScopeDialogProps = {
  open: boolean
  tree: ScopeSummary
  parent: ScopePath
  name: string
  /**
   * Start it with a landscape. On by default, because a scope made by hand is
   * usually somewhere to draw; off makes a domain on purpose — a folder for
   * other scopes, which until now only came about as a missing ancestor.
   */
  withBoard: boolean
  onParentChange: (next: ScopePath) => void
  onNameChange: (name: string) => void
  onWithBoardChange: (withBoard: boolean) => void
  /**
   * The unit picked to serve it, and what may be picked. Absent, or with
   * nothing to offer — an organisation with no units — the field is not drawn.
   */
  servedBy?: { options: readonly PickOption[]; value: string | undefined; onChange: (unitId: string | undefined) => void }
  onCancel: () => void
  onCreate: () => void
  s: Translate
}

export function NewScopeDialog({
  open, tree, parent, name, withBoard, onParentChange, onNameChange, onWithBoardChange, servedBy, onCancel, onCreate, s,
}: NewScopeDialogProps) {
  const typed = name.trim()
  // Slugged, because that is what becomes the folder: "Docs" and "docs" are the
  // same name as far as the tree is concerned.
  const reserved = typed.length > 0 && isReservedScopeName(slug(typed))
  const ready = typed.length > 0 && !reserved

  return (
    <FieldsDialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{s('picker.newScopeTitle')}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.25} sx={{ pt: 0.5 }}>
          <ScopeField
            tree={tree}
            value={parent}
            onChange={onParentChange}
            label={s('picker.under')}
            s={s}
          />
          <TextField
            autoFocus
            fullWidth
            label={s('picker.scopeName')}
            value={name}
            error={reserved}
            helperText={reserved ? s('picker.reservedName') : undefined}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && ready) { e.preventDefault(); onCreate() } }}
          />
          <FormControlLabel
            control={(
              <Checkbox
                checked={withBoard}
                onChange={(e) => onWithBoardChange(e.target.checked)}
                slotProps={{ input: { 'aria-label': s('picker.withBoard') } }}
              />
            )}
            label={s('picker.withBoard')}
            slotProps={{ typography: { sx: { fontSize: 13 } } }}
          />
          {servedBy && servedBy.options.length > 0 && <ServedByField {...servedBy} s={s} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button variant="contained" disabled={!ready} onClick={onCreate}>
          {s('picker.create')}
        </Button>
      </DialogActions>
    </FieldsDialog>
  )
}

/** The one unit picked to serve the new scope: a chip once picked, *+ Unit* until then. */
function ServedByField({ options, value, onChange, s }: NonNullable<NewScopeDialogProps['servedBy']> & { s: Translate }) {
  const picked = options.find((one) => one.id === value)
  return (
    <Box data-testid="new-scope-served-by">
      <SectionHeading component="h3">{s('org.newScopeServedBy')}</SectionHeading>
      <FieldLabel sx={{ mb: 0.25 }}>{s('org.newScopeServedByHint')}</FieldLabel>
      {picked
        ? (
            <Chip
              label={picked.label} data-testid="new-scope-served-by-unit"
              // Backspace or Delete on the chip takes the pick back, as the cross does.
              onDelete={() => onChange(undefined)}
            />
          )
        : (
            <PickToAdd
              options={options} label={s('org.servedByAdd')} field={s('pick.findUnit')} nothing={s('pick.noUnit')}
              onPick={onChange} testId="new-scope-served-by-add" disabled={options.every((one) => one.disabled === true)}
            />
          )}
    </Box>
  )
}
