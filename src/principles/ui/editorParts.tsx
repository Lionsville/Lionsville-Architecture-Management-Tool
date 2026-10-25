// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The two lists a principle's editor holds (ADR-0041): the groups it sits in,
 * picked from the scope's or made on the spot (*New group "…"*), and its
 * aspects as a plain numbered list, each with its nature and what would show
 * it holds.
 */
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import { CloseIcon } from '../../widgets/icons'
import { ASPECT_NATURES, formatAspectNumber } from '../../model/principle'
import type { Aspect, AspectNature, PrincipleGroup } from '../../model/principle'
import { NATURE_WORD } from './words'

/** A group in the picker: one the scope keeps, or one to make from what was typed. */
type GroupOption = { id?: string; name: string }

const filter = createFilterOptions<GroupOption>()

const keyOf = (one: GroupOption | string) => (typeof one === 'string' ? `make:${one}` : one.id ?? `make:${one.name}`)

/** The groups picked: those the scope keeps by id, and the names of those to make. */
export function GroupPicker({ groups, picked, made, onChange, t }: {
  groups: readonly PrincipleGroup[]
  picked: readonly string[]
  made: readonly string[]
  onChange: (picked: string[], made: string[]) => void
  t: Translate
}) {
  const value: GroupOption[] = [
    ...picked.flatMap((id) => groups.filter((one) => one.id === id).map((one) => ({ id: one.id, name: one.name }))),
    ...made.map((name) => ({ name })),
  ]
  const change = (next: readonly (GroupOption | string)[]) => {
    const options = next.map((one) => (typeof one === 'string' ? { name: one.trim() } : one)).filter((one) => one.name)
    // A name typed that the scope keeps is that group, not a second one of the same name.
    const kept = (name: string) => groups.find((group) => group.name.toLowerCase() === name.toLowerCase())
    const ids = options.flatMap((one) => one.id ?? kept(one.name)?.id ?? [])
    const names = options.filter((one) => one.id === undefined && !kept(one.name)).map((one) => one.name)
    onChange([...new Set(ids)], [...new Set(names)])
  }
  return (
    <Autocomplete<GroupOption, true, false, true>
      multiple freeSolo
      options={groups.map((one) => ({ id: one.id, name: one.name }))}
      value={value}
      onChange={(_event, next) => change(next)}
      filterOptions={(options, state) => {
        const found = filter(options, state)
        const typed = state.inputValue.trim()
        if (typed && !options.some((one) => one.name.toLowerCase() === typed.toLowerCase())) found.push({ name: typed })
        return found
      }}
      getOptionLabel={(one) => (typeof one === 'string' ? one : one.name)}
      isOptionEqualToValue={(a, b) => keyOf(a) === keyOf(b)}
      renderOption={(props, one) => (
        <li {...props} key={keyOf(one)}>{one.id === undefined ? t('principles.newGroupOption', { name: one.name }) : one.name}</li>
      )}
      renderInput={(params) => <TextField {...params} label={t('principles.groupsField')} helperText={t('principles.groupsHelp')} />}
      data-testid="principle-groups"
    />
  )
}

/** The aspects as a numbered list: `PR-0001.2` where the principle has a number, `.2` while it is new. */
export function AspectList({ number, aspects, onAdd, onChange, onRemove, t }: {
  number: number | undefined
  aspects: readonly Aspect[]
  onAdd: () => void
  onChange: (id: string, patch: Partial<Aspect>) => void
  onRemove: (id: string) => void
  t: Translate
}) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{t('principles.aspects')}</Typography>
        <Button size="small" onClick={onAdd} data-testid="principle-add-aspect">{t('principles.addAspect')}</Button>
      </Box>
      {aspects.length === 0 && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('principles.aspectsHelp')}</Typography>}
      {aspects.map((aspect) => (
        <Box key={aspect.id} data-testid="principle-aspect" sx={{ display: 'grid', gridTemplateColumns: 'max-content 1fr 150px 1fr max-content', gap: 1, alignItems: 'center', py: 0.5 }}>
          <Box component="span" sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: 'text.secondary' }}>
            {number !== undefined ? formatAspectNumber(number, aspect.number) : `.${aspect.number}`}
          </Box>
          <TextField size="small" value={aspect.text} onChange={(event) => onChange(aspect.id, { text: event.target.value })} placeholder={t('principles.aspectText')} slotProps={{ htmlInput: { 'aria-label': t('principles.aspectText') } }} />
          <TextField select size="small" value={aspect.nature} onChange={(event) => onChange(aspect.id, { nature: event.target.value as AspectNature })} slotProps={{ htmlInput: { 'aria-label': t('principles.natureField') } }}>
            {ASPECT_NATURES.map((one) => <MenuItem key={one} value={one}>{t(NATURE_WORD[one])}</MenuItem>)}
          </TextField>
          <TextField size="small" value={aspect.signal ?? ''} onChange={(event) => onChange(aspect.id, { signal: event.target.value || undefined })} placeholder={t('principles.signalField')} slotProps={{ htmlInput: { 'aria-label': t('principles.signalField') } }} />
          <IconButton size="small" aria-label={t('principles.removeAspect')} onClick={() => onRemove(aspect.id)}><CloseIcon size={14} /></IconButton>
        </Box>
      ))}
    </Box>
  )
}
