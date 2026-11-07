// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The two lists a principle's editor holds (ADR-0041): the groups it sits in,
 * picked from the scope's or made on the spot (*New group "…"*), and its
 * aspects as a plain numbered list, each with its nature and what would show
 * it holds.
 */
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import type { Translate } from '../../i18n'
import { CloseIcon } from '../../widgets/icons'
import { Button, IconButton } from '../../widgets/kit/Button'
import { Select, TextInput } from '../../widgets/kit/Field'
import { PanelSection } from '../../widgets/kit/Panel'
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
    <PanelSection title={t('principles.aspects')} aside={<Button variant="quiet" size="small" onClick={onAdd} data-testid="principle-add-aspect">{t('principles.addAspect')}</Button>}>
      {aspects.length === 0 && <p className="guidance-read__empty">{t('principles.aspectsHelp')}</p>}
      {aspects.map((aspect) => (
        <div key={aspect.id} data-testid="principle-aspect" className="guidance-form__aspect">
          <span className="guidance-read__code">{number !== undefined ? formatAspectNumber(number, aspect.number) : `.${aspect.number}`}</span>
          <TextInput value={aspect.text} onChange={(event) => onChange(aspect.id, { text: event.target.value })} placeholder={t('principles.aspectText')} aria-label={t('principles.aspectText')} />
          <Select
            value={aspect.nature} onChange={(event) => onChange(aspect.id, { nature: event.target.value as AspectNature })} aria-label={t('principles.natureField')}
            options={ASPECT_NATURES.map((one) => ({ value: one, label: t(NATURE_WORD[one]) }))}
          />
          <TextInput value={aspect.signal ?? ''} onChange={(event) => onChange(aspect.id, { signal: event.target.value || undefined })} placeholder={t('principles.signalField')} aria-label={t('principles.signalField')} />
          <IconButton label={t('principles.removeAspect')} onClick={() => onRemove(aspect.id)}><CloseIcon size={14} /></IconButton>
        </div>
      ))}
    </PanelSection>
  )
}
