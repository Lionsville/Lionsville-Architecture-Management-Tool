/**
 * The maturity columns, as a list you can edit: rename, reorder, re-code, drop,
 * add a standard one, add your own.
 *
 * A component and not a section of a dialog, because the same list is edited in
 * two places for two reasons — on a diagram, where it decides what that
 * landscape's cards show, and on a project, where it decides what a *new*
 * landscape starts with. One editor means those two never drift apart in what
 * they let you type.
 *
 * Controlled: the caller owns the columns and the "these are new" set. Keys are
 * what per-element statuses are filed under, so a rename never moves one; the
 * caller re-keys the fresh ones on save via {@link settleFreshAspectKeys}.
 */
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import {
  ASPECT_CODE_MAX,
  ASPECT_SUPERSET,
  DEFAULT_ASPECT_CONFIG,
  aspectKeyForLabel,
  aspectShortCode,
} from '../model/aspects';
import { useStrings } from '../i18n/LanguageContext';
import type { AspectConfigEntry } from '../model/types';

export interface AspectColumnsEditorProps {
  columns: AspectConfigEntry[];
  /** Keys added in this sitting — nothing is filed under them yet. */
  fresh: string[];
  onChange(columns: AspectConfigEntry[], fresh: string[]): void;
  /** Drawn faded while the caller has the row switched off. */
  dimmed?: boolean;
}

export function AspectColumnsEditor({
  columns, fresh, onChange, dimmed = false,
}: AspectColumnsEditorProps) {
  const { t } = useStrings();
  const [addMenu, setAddMenu] = useState<HTMLElement | null>(null);

  const setColumns = (next: AspectConfigEntry[]) => onChange(next, fresh);
  const editColumn = (index: number, patch: Partial<AspectConfigEntry>) =>
    setColumns(columns.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  const move = (index: number, by: number) => {
    const to = index + by;
    if (to < 0 || to >= columns.length) return;
    const next = [...columns];
    [next[index], next[to]] = [next[to], next[index]];
    setColumns(next);
  };

  const unusedStandard = ASPECT_SUPERSET.filter(
    (entry) => !columns.some((c) => c.key === entry.key),
  );

  const addStandard = (entry: AspectConfigEntry) => {
    setAddMenu(null);
    setColumns([...columns, { ...entry }]);
  };
  const addCustom = () => {
    setAddMenu(null);
    const label = t('diagramSettings.newColumn');
    const key = aspectKeyForLabel(label, columns.map((c) => c.key));
    onChange([...columns, { key, label }], [...fresh, key]);
  };

  return (
    <Box>
      <Stack spacing={1} sx={{ mt: 1.25, opacity: dimmed ? 0.55 : 1 }}>
        {columns.length === 0 && (
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            {t('diagramSettings.noColumns')}
          </Typography>
        )}
        {columns.map((column, index) => (
          <Stack key={column.key} direction="row" spacing={0.5} alignItems="center">
            <TextField
              size="small"
              label={index === 0 ? t('diagramSettings.columnLabel') : undefined}
              value={column.label}
              sx={{ flex: 1 }}
              onChange={(e) => editColumn(index, { label: e.target.value })}
            />
            <TextField
              size="small"
              label={index === 0 ? t('diagramSettings.columnCode') : undefined}
              // What the badge would say if this field stayed empty — which for
              // a standard column is its curated code (`dr` reads DR), not
              // something derived from the label. A placeholder that disagreed
              // with the card would be worse than none.
              placeholder={
                aspectShortCode({ ...column, code: undefined })
                || t('diagramSettings.codePlaceholder')
              }
              value={column.code ?? ''}
              sx={{ width: 96 }}
              slotProps={{
                htmlInput: { maxLength: ASPECT_CODE_MAX },
                // Kept shrunk so the derived code shows as the placeholder on
                // the first row too. Otherwise the labelled row alone looks
                // blank while every row under it shows what its badge will say.
                inputLabel: { shrink: true },
              }}
              onChange={(e) => editColumn(index, { code: e.target.value })}
            />
            <Tooltip title={t('diagramSettings.moveUp', { name: column.label })}>
              <span>
                <IconButton
                  size="small"
                  disabled={index === 0}
                  aria-label={t('diagramSettings.moveUp', { name: column.label })}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('diagramSettings.moveDown', { name: column.label })}>
              <span>
                <IconButton
                  size="small"
                  disabled={index === columns.length - 1}
                  aria-label={t('diagramSettings.moveDown', { name: column.label })}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('diagramSettings.remove', { name: column.label })}>
              <IconButton
                size="small"
                aria-label={t('diagramSettings.remove', { name: column.label })}
                onClick={() => setColumns(columns.filter((_, i) => i !== index))}
              >
                ✕
              </IconButton>
            </Tooltip>
          </Stack>
        ))}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        <Button size="small" onClick={(e) => setAddMenu(e.currentTarget)}>
          {t('diagramSettings.addStandard')}
        </Button>
        <Button size="small" onClick={addCustom}>
          {t('diagramSettings.addCustom')}
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          color="inherit"
          onClick={() => setColumns([...DEFAULT_ASPECT_CONFIG])}
        >
          {t('diagramSettings.reset')}
        </Button>
      </Stack>
      <Menu anchorEl={addMenu} open={addMenu !== null} onClose={() => setAddMenu(null)}>
        {unusedStandard.length === 0 && (
          <MenuItem disabled>{t('diagramSettings.allStandardUsed')}</MenuItem>
        )}
        {unusedStandard.map((entry) => (
          <MenuItem key={entry.key} onClick={() => addStandard(entry)}>
            {entry.label}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}

/**
 * Re-key the columns added in this sitting from the labels they ended up with,
 * so a column typed as "Service levels" is filed as `custom-service-levels` and
 * not as whatever the placeholder said when the row appeared.
 *
 * Columns that were already in the model keep their keys whatever happens to
 * their labels — statuses are filed under those.
 */
export function settleFreshAspectKeys(
  columns: readonly AspectConfigEntry[],
  fresh: readonly string[],
): AspectConfigEntry[] {
  if (fresh.length === 0) return [...columns];
  const settled = columns.filter((c) => !fresh.includes(c.key)).map((c) => c.key);
  return columns.map((column) => {
    if (!fresh.includes(column.key)) return column;
    const key = aspectKeyForLabel(column.label, settled);
    settled.push(key);
    return { ...column, key };
  });
}
