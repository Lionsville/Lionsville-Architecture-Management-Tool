// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A building block's *Requirements* (ADR-0043 §2): the grid of what each
 * usage context needs of each capability, and the two lists it is made of —
 * a capability added, said a must or taken off; a usage context added, which
 * writes its chapter in the block's document in the same step, or taken off.
 * Every change is one step in the scope that keeps the block.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n/LanguageContext'
import { withChapters, withoutCapability } from '../../model/buildingBlock'
import type { BlockCapability, UsageContext } from '../../model/types'
import { FieldsDialog } from '../../widgets/CompactForms'
import { useBlocks } from './BlocksContext'
import type { BlockRow } from './BlocksContext'
import { RequirementsGrid } from './EvaluationGrid'

const SMALL = { fontSize: 11, minWidth: 0, px: 0.75 } as const

/** The two lists, a line each, with what may be done to each line. */
function Lists({ row }: { row: BlockRow }) {
  const access = useBlocks()
  const { t } = useStrings()
  if (!access) return null
  const { block } = row
  const capabilities = block.capabilities ?? []
  const contexts = block.contexts ?? []
  const setMust = (one: BlockCapability, must: boolean) => access.update(block.id, {
    capabilities: capabilities.map((held) => {
      if (held.id !== one.id) return held
      const { must: _was, ...rest } = held
      void _was
      return must ? { ...rest, must: true as const } : rest
    }),
  })
  const dropCapability = (id: string) => access.update(block.id, {
    capabilities: capabilities.filter((one) => one.id !== id), contexts: withoutCapability(contexts, id),
  })
  const dropContext = (id: string) => access.update(block.id, { contexts: contexts.filter((one) => one.id !== id) })
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { md: '1fr 1fr' }, gap: 3, mt: 3 }}>
      <Box>
        <Typography component="h2" sx={{ fontSize: 12, fontWeight: 600, mb: 0.5 }}>{t('blocks.capabilities')}</Typography>
        {capabilities.map((one) => (
          <Box key={one.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider', py: 0.25 }}>
            <Typography sx={{ fontSize: 13, flex: 1 }}>{one.text}</Typography>
            <FormControlLabel
              control={<Checkbox size="small" checked={one.must === true} onChange={(event) => setMust(one, event.target.checked)} />}
              label={<Typography sx={{ fontSize: 11 }}>{t('blocks.must')}</Typography>}
            />
            <Button size="small" color="error" sx={SMALL} onClick={() => dropCapability(one.id)} aria-label={t('blocks.removeNamed', { name: one.text })}>{t('blocks.remove')}</Button>
          </Box>
        ))}
      </Box>
      <Box>
        <Typography component="h2" sx={{ fontSize: 12, fontWeight: 600, mb: 0.5 }}>{t('blocks.usageContexts')}</Typography>
        {contexts.map((one) => (
          <Box key={one.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider', py: 0.25 }}>
            <Typography sx={{ fontSize: 13, flex: 1 }}>{one.name}</Typography>
            <Button size="small" color="error" sx={SMALL} onClick={() => dropContext(one.id)} aria-label={t('blocks.removeNamed', { name: one.name })}>{t('blocks.remove')}</Button>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

export function BlockRequirements({ row, onChapter }: { row: BlockRow; onChapter: (context: string) => void }) {
  const access = useBlocks()
  const { t } = useStrings()
  const [adding, setAdding] = useState<'capability' | 'context' | undefined>(undefined)
  if (!access) return null
  const may = access.mayWrite(row.scope)
  return (
    <>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2, maxWidth: 760 }}>{t('blocks.requirementsIntro')}</Typography>
      {(row.block.capabilities ?? []).length === 0 && (row.block.contexts ?? []).length === 0
        ? <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('blocks.requirementsEmpty')}</Typography>
        : <RequirementsGrid block={row.block} onChapter={onChapter} {...(may ? { onChange: (next) => access.update(row.block.id, next) } : {})} />}
      {may && (
        <>
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Button size="small" onClick={() => setAdding('capability')} data-testid="block-add-capability">{t('blocks.addCapability')}</Button>
            <Button size="small" onClick={() => setAdding('context')} data-testid="block-add-context">{t('blocks.addContext')}</Button>
          </Box>
          <Lists row={row} />
        </>
      )}
      {adding === 'capability' && <CapabilityDialog row={row} onClose={() => setAdding(undefined)} />}
      {adding === 'context' && <ContextDialog row={row} onClose={() => setAdding(undefined)} />}
    </>
  )
}

function CapabilityDialog({ row, onClose }: { row: BlockRow; onClose: () => void }) {
  const access = useBlocks()
  const { t } = useStrings()
  const [text, setText] = useState('')
  const [must, setMust] = useState(false)
  const [aspect, setAspect] = useState('')
  if (!access) return null
  const aspects = access.aspectChoices(row.scope)
  const add = () => {
    const picked = aspects[Number(aspect)]?.aspect
    const capability: BlockCapability = {
      id: access.makeId('cap'), text: text.trim(), ...(must ? { must: true as const } : {}), ...(aspect !== '' && picked ? { aspect: picked } : {}),
    }
    access.update(row.block.id, { capabilities: [...(row.block.capabilities ?? []), capability] })
    onClose()
  }
  return (
    <FieldsDialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('blocks.addCapabilityTitle')}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        <TextField autoFocus label={t('blocks.capabilityText')} value={text} onChange={(event) => setText(event.target.value)} helperText={t('blocks.capabilityHelp')} slotProps={{ htmlInput: { 'data-testid': 'capability-text' } }} />
        <FormControlLabel control={<Checkbox checked={must} onChange={(event) => setMust(event.target.checked)} />} label={t('blocks.mustLabel')} />
        <TextField select label={t('blocks.aspectField')} value={aspect} onChange={(event) => setAspect(event.target.value)} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
          <MenuItem value="">{t('blocks.noAspect')}</MenuItem>
          {aspects.map((one, index) => <MenuItem key={index} value={String(index)}>{one.label}</MenuItem>)}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={!text.trim()} onClick={add} data-testid="capability-add">{t('blocks.add')}</Button>
      </DialogActions>
    </FieldsDialog>
  )
}

/** A usage context: a situation in words, with a chapter of its own in the block's document, written in the same step. */
function ContextDialog({ row, onClose }: { row: BlockRow; onClose: () => void }) {
  const access = useBlocks()
  const { t } = useStrings()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  if (!access) return null
  const add = () => {
    const context: UsageContext = { id: access.makeId('cx'), name: name.trim(), ...(description.trim() ? { description: description.trim() } : {}), needs: {} }
    const contexts = [...(row.block.contexts ?? []), context]
    // The chapter goes onto the document the scope keeps: the row is the index's, which carries none.
    access.update(row.block.id, (held) => ({ contexts, description: withChapters(held.description ?? '', [context]) }))
    onClose()
  }
  return (
    <FieldsDialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('blocks.addContextTitle')}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('blocks.contextIntro')}</Typography>
        <TextField autoFocus label={t('blocks.contextName')} value={name} onChange={(event) => setName(event.target.value)} helperText={t('blocks.contextNameHelp')} slotProps={{ htmlInput: { 'data-testid': 'context-name' } }} />
        <TextField label={t('blocks.description')} value={description} onChange={(event) => setDescription(event.target.value)} multiline minRows={2} helperText={t('blocks.contextDescriptionHelp')} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={!name.trim()} onClick={add} data-testid="context-add">{t('blocks.add')}</Button>
      </DialogActions>
    </FieldsDialog>
  )
}
