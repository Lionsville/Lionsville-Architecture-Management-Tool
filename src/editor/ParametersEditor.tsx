import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { DesignParameters, ParameterSpec } from '../model/types';

/**
 * Renders the host-supplied parameter specs (slider/number/select/text) for
 * the selected element. The package knows nothing about OM vs T&S semantics —
 * the host decides which specs apply per element kind.
 */
export function ParametersEditor({
  specs,
  parameters,
  disabled,
  onChange,
}: {
  specs: ParameterSpec[];
  parameters: DesignParameters;
  disabled: boolean;
  onChange(parameters: DesignParameters): void;
}) {
  const set = (key: keyof DesignParameters, value: number | string | undefined) => {
    const next = { ...parameters };
    if (value === undefined || value === '') delete next[key];
    else if (typeof value === 'number' && Number.isNaN(value)) delete next[key];
    else (next[key] as number | string) = value;
    onChange(next);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {specs.map((spec) => (
        <ParameterInput
          key={spec.key}
          spec={spec}
          value={parameters[spec.key]}
          disabled={disabled}
          onChange={(value) => set(spec.key, value)}
        />
      ))}
    </Box>
  );
}

function ParameterInput({
  spec,
  value,
  disabled,
  onChange,
}: {
  spec: ParameterSpec;
  value: number | string | undefined;
  disabled: boolean;
  onChange(value: number | string | undefined): void;
}) {
  switch (spec.input) {
    case 'slider': {
      const min = spec.min ?? 0;
      const max = spec.max ?? 1;
      return (
        <Box sx={{ px: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              {spec.label}
            </Typography>
            <Typography variant="caption" color={value === undefined ? 'text.disabled' : 'text.primary'}>
              {value === undefined ? 'not set' : value}
            </Typography>
          </Box>
          <Slider
            size="small"
            aria-label={spec.label}
            min={min}
            max={max}
            step={spec.step ?? 0.1}
            value={typeof value === 'number' ? value : min}
            disabled={disabled}
            onChange={(_e, v) => onChange(v as number)}
            valueLabelDisplay="auto"
          />
        </Box>
      );
    }
    case 'number':
      return (
        <TextField
          size="small"
          type="number"
          label={spec.label}
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          slotProps={{ htmlInput: { min: spec.min, max: spec.max, step: spec.step } }}
        />
      );
    case 'select':
      return (
        <TextField
          size="small"
          select
          label={spec.label}
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value || undefined)}
        >
          <MenuItem value="">
            <em>Not set</em>
          </MenuItem>
          {(spec.options ?? []).map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
      );
    case 'text':
      return (
        <TextField
          size="small"
          label={spec.label}
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      );
  }
}
