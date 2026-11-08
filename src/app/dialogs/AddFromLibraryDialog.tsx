// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The register as a library: pick an application the organisation already
 * has, and — for one nobody defines — answer whether this scope should
 * (ADR-0012 §2, §3).
 *
 * Three screens in one dialog, because each only ever follows the first and
 * is about the row just picked: the owner question for an application nobody
 * defines, and the band question every stand-in is asked — outside this
 * landscape, or one of its applications drawn where it is defined. No arithmetic: which rows there are and
 * what picking one means are `useLibrary`'s, which asks `projects/library.ts`.
 */
import { useEffect, useState } from 'react'
import { FieldsDialog } from '../../widgets/CompactForms'
import { DialogFooter } from '../../widgets/kit/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import { FieldBox } from '../../widgets/kit/FieldBox'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import { matchesQuery } from '../../model'
import type { ElementId } from '../../model'
import type { LibraryRow } from '../../projects/library'
import type { ScopePath } from '../../projects/scopePath'
import type { LibraryBand, LibraryChoice } from '../useLibrary'

export type AddFromLibraryDialogProps = {
  choice: LibraryChoice | undefined
  scopeLabel: (path: ScopePath) => string
  onPick: (id: ElementId) => void
  onOwn: () => void
  onDrawOnly: () => void
  onPlace: (band: LibraryBand) => void
  onCancel: () => void
  s: Translate
}

export function AddFromLibraryDialog({
  choice, scopeLabel, onPick, onOwn, onDrawOnly, onPlace, onCancel, s,
}: AddFromLibraryDialogProps) {
  const [query, setQuery] = useState('')
  // A fresh box each time the picker opens: a filter that remembered last
  // week's word would hide most of the register on open.
  useEffect(() => { if (choice?.kind === 'picking') setQuery('') }, [choice?.kind])

  if (choice?.kind === 'asking') {
    return (
      <FieldsDialog open onClose={onCancel} maxWidth="xs" fullWidth aria-label={s('library.ownTitle', { name: choice.name })}>
        <DialogTitle>{s('library.ownTitle', { name: choice.name })}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 'var(--t-body)' }}>{s('library.ownBody', { name: choice.name })}</DialogContentText>
        </DialogContent>
        <DialogFooter
          cancel={{ onClick: onCancel, label: s('common.cancel') }}
          also={[choice.canDrawOnly && { onClick: onDrawOnly, label: s('library.drawOnly') }]}
          outcome={{ onClick: onOwn, label: s('library.own') }}
        />
      </FieldsDialog>
    )
  }

  if (choice?.kind === 'placing') {
    return (
      <FieldsDialog open onClose={onCancel} maxWidth="xs" fullWidth aria-label={s('library.placeTitle', { name: choice.name })}>
        <DialogTitle>{s('library.placeTitle', { name: choice.name })}</DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <List component="div" dense disablePadding>
            <ListItemButton onClick={() => onPlace('domain')} data-testid="library-place-domain">
              <ListItemText
                primary={s('library.placeDomain')}
                secondary={s('library.placeDomainWhat')}
                slotProps={{ primary: { sx: { fontSize: 'var(--t-body)' } }, secondary: { sx: { fontSize: 'var(--t-small)' } } }}
              />
            </ListItemButton>
            <ListItemButton onClick={() => onPlace('external')} data-testid="library-place-external">
              <ListItemText
                primary={s('library.placeExternal')}
                secondary={s('library.placeExternalWhat')}
                slotProps={{ primary: { sx: { fontSize: 'var(--t-body)' } }, secondary: { sx: { fontSize: 'var(--t-small)' } } }}
              />
            </ListItemButton>
          </List>
        </DialogContent>
        <DialogFooter
          cancel={{ onClick: onCancel, label: s('common.cancel') }}
        />
      </FieldsDialog>
    )
  }

  const rows = choice?.kind === 'picking' ? choice.rows : []
  const shown = rows.filter((row) => matchesQuery(query, [row.name, row.id]))
  const where = (row: LibraryRow) => {
    const kind = row.kind === 'application' ? '' : `${s(row.kind === 'platform' ? 'kind.platform' : 'kind.platformService')} · `
    // The solution chosen here as a building block says so first (ADR-0043 §8).
    if (row.chosen !== undefined) return kind + row.chosen
    if (row.held) return kind + s('library.heldHere')
    if (row.master !== undefined) return kind + s('library.definedIn', { scope: scopeLabel(row.master) })
    return s('library.nobodyDefines')
  }
  return (
    <FieldsDialog open={choice !== undefined} onClose={onCancel} maxWidth="xs" fullWidth aria-label={s('library.title')}>
      <DialogTitle>{s('library.title')}</DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Typography sx={{ fontSize: 'var(--t-small)', color: 'text.secondary', mb: 1 }}>{s('library.hint')}</Typography>
        {rows.length > 0 && (
          <FieldBox
            autoFocus
            fullWidth
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={s('library.searchPlaceholder')}
            slotProps={{ htmlInput: { 'aria-label': s('library.search') } }}
            sx={{ mb: 1 }}
          />
        )}
        {rows.length === 0 && (
          <Typography sx={{ fontSize: 'var(--t-small)', color: 'text.secondary' }}>{s('library.none')}</Typography>
        )}
        {rows.length > 0 && shown.length === 0 && (
          <Typography sx={{ fontSize: 'var(--t-small)', color: 'text.secondary' }}>{s('library.noMatches', { query })}</Typography>
        )}
        <List component="div" dense disablePadding sx={{ maxHeight: 360, overflowY: 'auto' }}>
          {shown.map((row) => (
            <ListItemButton key={row.id} onClick={() => onPick(row.id)} data-testid={`library-row-${row.id}`}>
              <ListItemText
                primary={row.name}
                secondary={where(row)}
                slotProps={{ primary: { sx: { fontSize: 'var(--t-body)' } }, secondary: { sx: { fontSize: 'var(--t-small)' } } }}
              />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogFooter
        cancel={{ onClick: onCancel, label: s('common.cancel') }}
      />
    </FieldsDialog>
  )
}
