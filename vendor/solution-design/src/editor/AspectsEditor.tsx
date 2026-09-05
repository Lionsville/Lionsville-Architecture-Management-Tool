import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import type { AspectConfigEntry, AspectStatus, DesignElement } from '../types';
import { useStrings } from '../i18n/LanguageContext';
import type { StringKey } from '../i18n/strings';

const STATUSES: { value: AspectStatus; labelKey: StringKey }[] = [
  { value: 'managed', labelKey: 'aspect.managed' },
  { value: 'partial', labelKey: 'aspect.partial' },
  { value: 'atRisk', labelKey: 'aspect.atRisk' },
  { value: 'none', labelKey: 'aspect.none' },
];

const UNSET = '';

/**
 * One row per configured aspect (diagram aspectConfig order): status select +
 * per-application note. Clearing the status removes the entry entirely.
 */
export function AspectsEditor({
  aspects,
  config,
  disabled,
  onChange,
}: {
  aspects: DesignElement['aspects'];
  config: readonly AspectConfigEntry[];
  disabled: boolean;
  onChange(aspects: DesignElement['aspects']): void;
}) {
  const { t } = useStrings();
  const setStatus = (key: string, raw: string) => {
    const next = { ...aspects };
    if (raw === UNSET) delete next[key];
    else next[key] = { ...next[key], status: raw as AspectStatus };
    onChange(next);
  };

  const setNote = (key: string, note: string) => {
    const entry = aspects[key];
    if (!entry) return; // note requires a status
    onChange({ ...aspects, [key]: { ...entry, note: note || undefined } });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {config.map((entry) => {
        const aspect = aspects[entry.key];
        return (
          <Box key={entry.key} sx={{ display: 'flex', gap: 1 }}>
            <TextField
              select
              size="small"
              label={entry.label}
              value={aspect?.status ?? UNSET}
              disabled={disabled}
              sx={{ width: 130, flexShrink: 0 }}
              onChange={(e) => setStatus(entry.key, e.target.value)}
            >
              <MenuItem value={UNSET}>
                <em>{t('field.notSet')}</em>
              </MenuItem>
              {STATUSES.map((status) => (
                <MenuItem key={status.value} value={status.value}>
                  {t(status.labelKey)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label={t('field.note')}
              placeholder={t('field.notePlaceholder')}
              value={aspect?.note ?? ''}
              disabled={disabled || !aspect}
              sx={{ flex: 1 }}
              slotProps={{ htmlInput: { 'aria-label': t('field.noteAria', { name: entry.label }) } }}
              onChange={(e) => setNote(entry.key, e.target.value)}
            />
          </Box>
        );
      })}
    </Box>
  );
}
