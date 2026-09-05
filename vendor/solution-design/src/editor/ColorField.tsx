import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useStrings } from '../i18n/LanguageContext';

/**
 * Shared colour control (U7a, D4). Extracted from the two verbatim-duplicated
 * pickers in `ElementInspector` (accent) and `ConnectionInspector` (edge colour).
 * The 44×32 `<input type="color">` writes a hex on change; the inline clear
 * affordance writes `undefined` → NULL → inherit (the U4b/U6a NULL-inherit
 * contract). Behaviour is identical to the two originals — the only change is
 * that the separate greyed-out "Default" button becomes a combined
 * swatch-with-inline-clear. `readOnly` disables both the swatch and the clear.
 */
export interface ColorFieldProps {
  /** Caption shown above the swatch, e.g. "Accent colour". */
  label: string;
  /** Accessible name for the colour input (kept stable for tests / round-trip). */
  ariaLabel: string;
  /** Current hex, or `undefined` when inheriting the default. */
  value: string | undefined;
  readOnly: boolean;
  onChange(value: string | undefined): void;
}

export function ColorField({ label, ariaLabel, value, readOnly, onChange }: ColorFieldProps) {
  const { t } = useStrings();
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          component="input"
          type="color"
          aria-label={ariaLabel}
          value={value ?? '#888888'}
          disabled={readOnly}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          sx={{
            width: 44,
            height: 32,
            p: 0,
            border: 'none',
            background: 'none',
            cursor: readOnly ? 'default' : 'pointer',
          }}
        />
        <Tooltip title={t('field.resetDefault')}>
          <span>
            <IconButton
              size="small"
              aria-label={t('field.clear', { name: label.toLowerCase() })}
              disabled={readOnly || !value}
              onClick={() => onChange(undefined)}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}
