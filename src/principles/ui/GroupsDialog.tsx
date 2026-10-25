// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Manage groups…* (ADR-0041 §3): the scope's own ordered list, named,
 * described and ordered in advance. A group removed is taken off its
 * principles, and none of them goes. A group is also made on the spot from
 * the editor's picker.
 */
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n/LanguageContext'
import { FieldsDialog } from '../../widgets/CompactForms'
import { CloseIcon } from '../../widgets/icons'
import type { PrincipleGroup } from '../principle'
import { usePrinciples } from './PrinciplesContext'

let made = 0

export function GroupsDialog({ open, scope, onClose }: { open: boolean; scope: string; onClose: () => void }) {
  const access = usePrinciples()
  const { t } = useStrings()
  const [list, setList] = useState<PrincipleGroup[]>([])
  useEffect(() => { if (open && access) setList([...access.own(scope).groups]) }, [open, access, scope])
  if (!access) return null
  const used = (id: string) => access.own(scope).principles.filter((one) => one.groups.includes(id) && !one.mergedInto).length
  const move = (index: number, by: number) => setList((held) => {
    const next = [...held]
    const [one] = next.splice(index, 1)
    next.splice(index + by, 0, one!)
    return next
  })
  const set = (id: string, patch: Partial<PrincipleGroup>) => setList((held) => held.map((one) => (one.id === id ? { ...one, ...patch } : one)))
  return (
    <FieldsDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('principles.groupsTitle')}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 1 }}>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('principles.groupsIntro')}</Typography>
        {list.map((group, index) => (
          <Box key={group.id} sx={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr max-content max-content max-content max-content', gap: 1, alignItems: 'center' }} data-testid={`group-${group.id}`}>
            <TextField size="small" value={group.name} onChange={(event) => set(group.id, { name: event.target.value })} slotProps={{ htmlInput: { 'aria-label': t('principles.groupName') } }} />
            <TextField size="small" value={group.description ?? ''} onChange={(event) => set(group.id, { description: event.target.value || undefined })} placeholder={t('principles.groupDescription')} slotProps={{ htmlInput: { 'aria-label': t('principles.groupDescription') } }} />
            <Typography sx={{ fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}>{t('principles.groupCount', { count: used(group.id) })}</Typography>
            <IconButton size="small" aria-label={t('principles.moveUp')} disabled={index === 0} onClick={() => move(index, -1)}>↑</IconButton>
            <IconButton size="small" aria-label={t('principles.moveDown')} disabled={index === list.length - 1} onClick={() => move(index, 1)}>↓</IconButton>
            <IconButton size="small" aria-label={t('principles.groupRemove')} onClick={() => setList((held) => held.filter((one) => one.id !== group.id))}><CloseIcon size={14} /></IconButton>
          </Box>
        ))}
        <Box>
          <Button size="small" onClick={() => { made += 1; setList((held) => [...held, { id: `grp-new-${Date.now()}-${made}`, name: '' }]) }} data-testid="group-add">{t('principles.groupAdd')}</Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={() => { access.setGroups(scope, list.filter((one) => one.name.trim())); onClose() }} data-testid="groups-save">{t('principles.save')}</Button>
      </DialogActions>
    </FieldsDialog>
  )
}
