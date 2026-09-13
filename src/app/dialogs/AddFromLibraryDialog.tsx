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
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import TextField from '@mui/material/TextField'
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
      <Dialog open onClose={onCancel} maxWidth="xs" fullWidth aria-label={s('library.ownTitle', { name: choice.name })}>
        <DialogTitle>{s('library.ownTitle', { name: choice.name })}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 14 }}>{s('library.ownBody', { name: choice.name })}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel}>{s('common.cancel')}</Button>
          {choice.canDrawOnly && <Button onClick={onDrawOnly}>{s('library.drawOnly')}</Button>}
          <Button variant="contained" onClick={onOwn}>{s('library.own')}</Button>
        </DialogActions>
      </Dialog>
    )
  }

  if (choice?.kind === 'placing') {
    return (
      <Dialog open onClose={onCancel} maxWidth="xs" fullWidth aria-label={s('library.placeTitle', { name: choice.name })}>
        <DialogTitle>{s('library.placeTitle', { name: choice.name })}</DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <List dense disablePadding>
            <ListItemButton onClick={() => onPlace('domain')} data-testid="library-place-domain">
              <ListItemText
                primary={s('library.placeDomain')}
                secondary={s('library.placeDomainWhat')}
                slotProps={{ primary: { sx: { fontSize: 13 } }, secondary: { sx: { fontSize: 11 } } }}
              />
            </ListItemButton>
            <ListItemButton onClick={() => onPlace('external')} data-testid="library-place-external">
              <ListItemText
                primary={s('library.placeExternal')}
                secondary={s('library.placeExternalWhat')}
                slotProps={{ primary: { sx: { fontSize: 13 } }, secondary: { sx: { fontSize: 11 } } }}
              />
            </ListItemButton>
          </List>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={onCancel}>{s('common.cancel')}</Button>
        </DialogActions>
      </Dialog>
    )
  }

  const rows = choice?.kind === 'picking' ? choice.rows : []
  const shown = rows.filter((row) => matchesQuery(query, [row.name, row.id]))
  const where = (row: LibraryRow) => {
    if (row.held) return s('library.heldHere')
    if (row.master !== undefined) return s('library.definedIn', { scope: scopeLabel(row.master) })
    return s('library.nobodyDefines')
  }
  return (
    <Dialog open={choice !== undefined} onClose={onCancel} maxWidth="xs" fullWidth aria-label={s('library.title')}>
      <DialogTitle>{s('library.title')}</DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>{s('library.hint')}</Typography>
        {rows.length > 0 && (
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={s('library.searchPlaceholder')}
            slotProps={{ htmlInput: { 'aria-label': s('library.search') } }}
            sx={{ mb: 1 }}
          />
        )}
        {rows.length === 0 && (
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{s('library.none')}</Typography>
        )}
        {rows.length > 0 && shown.length === 0 && (
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{s('library.noMatches', { query })}</Typography>
        )}
        <List dense disablePadding sx={{ maxHeight: 360, overflowY: 'auto' }}>
          {shown.map((row) => (
            <ListItemButton key={row.id} onClick={() => onPick(row.id)} data-testid={`library-row-${row.id}`}>
              <ListItemText
                primary={row.name}
                secondary={where(row)}
                slotProps={{ primary: { sx: { fontSize: 13 } }, secondary: { sx: { fontSize: 11 } } }}
              />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onCancel}>{s('common.cancel')}</Button>
      </DialogActions>
    </Dialog>
  )
}
