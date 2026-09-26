// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What an application or a container uses, as written (ADR-0020): the rows
 * from it as pills, and a picker over this scope's offerings and service
 * platforms first, then what the rest of the organisation offers. The ticks
 * are the picker's until it closes (`useUsesPicker`).
 */
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import ListSubheader from '@mui/material/ListSubheader';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useStrings } from '../i18n/LanguageContext';
import { runsSomewhere, type InspectorField, type usesChoices } from './elementInspectorFacts';
import type { useUsesPicker } from './useInspectorState';

type Uses = ReturnType<typeof usesChoices>;
type Picker = ReturnType<typeof useUsesPicker>;

export function UsesField({ field, uses, picker }: { field: InspectorField; uses: Uses; picker: Picker }) {
  const { t } = useStrings();
  const { element, readOnly, actions } = field;
  const { usesIds, usable } = uses;
  if (!runsSomewhere(element.kind) || (usesIds.length === 0 && (readOnly || usable.length === 0))) return null;
  const locked = readOnly || field.owned('uses');
  return (
    <Box data-testid="element-uses">
      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('field.uses')}</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
        {usesIds.length === 0 && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('field.usesNothing')}</Typography>}
        {usesIds.map((id) => (
          <Chip
            key={id}
            size="small"
            data-testid={`uses-pill-${id}`}
            label={uses.pillLabel(id)}
            onDelete={locked ? undefined : () => actions.setUses(element.id, usesIds.filter((held) => held !== id))}
          />
        ))}
      </Box>
      {!locked && usable.length > 0 && <UsesPicker uses={uses} picker={picker} />}
    </Box>
  );
}

function UsesPicker({ uses, picker }: { uses: Uses; picker: Picker }) {
  const { t } = useStrings();
  const { usable } = uses;
  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      size="small"
      options={usable}
      groupBy={(option) => option.group}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      value={usable.filter((option) => picker.pending.includes(option.id))}
      onChange={(_e, value) => picker.setPending(value.map((option) => option.id))}
      onClose={picker.commit}
      renderValue={() => null}
      // A group the listbox can name, and options that hold nothing a
      // keyboard could land on: the box is a picture of `aria-selected`, which
      // the option already says.
      renderGroup={(params) => (
        <li key={params.key} role="group" aria-labelledby={`${params.key}-uses-group`}>
          <ListSubheader id={`${params.key}-uses-group`} component="div" sx={{ lineHeight: '28px' }}>
            {params.group === 'here' ? t('field.usesHere') : t('field.hostedOnElsewhere')}
          </ListSubheader>
          <ul role="presentation" style={{ padding: 0 }}>{params.children}</ul>
        </li>
      )}
      renderOption={(optionProps, option, { selected }) => (
        <li {...optionProps} key={option.id} data-testid={`uses-option-${option.id}`}>
          <Checkbox
            size="small"
            checked={selected}
            aria-hidden
            slotProps={{ input: { disabled: true, tabIndex: -1 } }}
            sx={{ p: 0.25, mr: 0.5 }}
          />
          {option.name}
          {(option.where !== undefined || option.platform) && (
            <Typography component="span" sx={{ fontSize: 11, color: 'text.secondary', ml: 1 }}>
              {[option.platform ? t('field.usesPlatform') : undefined, option.where].filter(Boolean).join(' · ')}
            </Typography>
          )}
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={t('field.usesPick')}
          placeholder={t('field.usesSearch')}
          helperText={t('field.usesHelp')}
          slotProps={{
            ...params.slotProps,
            htmlInput: { ...params.slotProps.htmlInput, 'data-testid': 'uses-pick' },
          }}
        />
      )}
      sx={{ mt: 1 }}
      data-testid="element-uses-picker"
    />
  );
}
