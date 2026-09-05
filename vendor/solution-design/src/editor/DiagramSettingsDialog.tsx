/**
 * Everything about one diagram that is not the picture: what it is called, what
 * the exported drawing says about it, and which maturity columns its
 * applications carry.
 *
 * The columns are the reason this dialog exists. `aspectConfig` was per-diagram
 * data from the start — ordered, renameable, and round-tripping through
 * interchange — but the only way to set it was to hand-edit a file, so every
 * landscape in the world got Platform / CI/CD / DR / Security / Monitoring
 * whether or not those were the five things that organisation actually tracks.
 *
 * The draft is held here and applied on Save, so a half-typed column is never a
 * column, and an accidental "remove everything" is one Cancel away. What leaves
 * is a whole {@link DiagramSettings} — the host applies it, this dialog does not
 * know what a model is.
 */
import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  ASPECT_CODE_MAX,
  ASPECT_SUPERSET,
  DEFAULT_ASPECT_CONFIG,
  aspectKeyForLabel,
  derivedShortCode,
  normaliseAspectConfig,
} from '../model/aspects';
import { useStrings } from '../i18n/LanguageContext';
import type { AspectConfigEntry, DesignDiagram, DiagramSettings } from '../types';

export interface DiagramSettingsDialogProps {
  /** The diagram being configured; the dialog is closed while undefined. */
  target?: DesignDiagram;
  /**
   * The client the export would name if this diagram says nothing — the group
   * the project is filed under. Shown as the placeholder, so "leave it empty"
   * is a visible choice rather than a guess.
   */
  defaultClient: string;
  onSave(diagramId: string, settings: DiagramSettings): void;
  onClose(): void;
}

type Draft = {
  name: string;
  author: string;
  client: string;
  documentDate: string;
  showTitleBlock: boolean;
  columns: AspectConfigEntry[];
  showAspects: boolean;
  /**
   * Columns added in this sitting. Their keys are still up for grabs — nothing
   * has been filed under them — so they are re-derived from the final label on
   * save. A column that was already in the model keeps its key whatever happens
   * to its label, because per-element statuses are filed under it.
   */
  fresh: string[];
};

function draftOf(diagram: DesignDiagram): Draft {
  return {
    name: diagram.name,
    author: diagram.author ?? '',
    client: diagram.client ?? '',
    documentDate: diagram.documentDate ?? '',
    showTitleBlock: diagram.showTitleBlock !== false,
    // Deliberately not `aspectConfigFor`: that answers "what renders", and a
    // hidden diagram renders nothing. This dialog edits what is configured,
    // which outlives the hiding.
    columns: [...(diagram.aspectConfig ?? DEFAULT_ASPECT_CONFIG)],
    showAspects: diagram.showAspects !== false,
    fresh: [],
  };
}

export function DiagramSettingsDialog({
  target, defaultClient, onSave, onClose,
}: DiagramSettingsDialogProps) {
  const { t } = useStrings();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [addMenu, setAddMenu] = useState<HTMLElement | null>(null);
  // A fresh target resets the draft; the same target keeps what was typed, so a
  // stray click on the backdrop is recoverable by reopening.
  const [seenId, setSeenId] = useState<string | undefined>(undefined);
  if (target && seenId !== target.id) {
    setSeenId(target.id);
    setDraft(draftOf(target));
  }

  const isLayer7 = target?.kind === 'layer7';
  const edit = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const editColumn = (index: number, patch: Partial<AspectConfigEntry>) =>
    setDraft((d) => (d
      ? { ...d, columns: d.columns.map((c, i) => (i === index ? { ...c, ...patch } : c)) }
      : d));
  const move = (index: number, by: number) =>
    setDraft((d) => {
      if (!d) return d;
      const to = index + by;
      if (to < 0 || to >= d.columns.length) return d;
      const columns = [...d.columns];
      [columns[index], columns[to]] = [columns[to], columns[index]];
      return { ...d, columns };
    });

  const unusedStandard = draft
    ? ASPECT_SUPERSET.filter((entry) => !draft.columns.some((c) => c.key === entry.key))
    : [];

  const addStandard = (entry: AspectConfigEntry) => {
    setAddMenu(null);
    setDraft((d) => (d ? { ...d, columns: [...d.columns, { ...entry }] } : d));
  };
  const addCustom = () => {
    setAddMenu(null);
    setDraft((d) => {
      if (!d) return d;
      const label = t('diagramSettings.newColumn');
      const key = aspectKeyForLabel(label, d.columns.map((c) => c.key));
      return { ...d, columns: [...d.columns, { key, label }], fresh: [...d.fresh, key] };
    });
  };

  const trimmedName = draft?.name.trim() ?? '';
  const canSave = Boolean(target) && trimmedName.length > 0;
  const commit = () => {
    if (!target || !draft || !canSave) return;
    const columns = normaliseAspectConfig(withFreshKeys(draft));
    onSave(target.id, {
      name: trimmedName,
      author: draft.author.trim() || undefined,
      client: draft.client.trim() || undefined,
      documentDate: draft.documentDate.trim() || undefined,
      // Absent is the default in the model, so only the deviation is stored —
      // a diagram nobody configured stays a diagram nobody configured.
      showTitleBlock: draft.showTitleBlock ? undefined : false,
      // Container diagrams have no aspect row; saying nothing keeps whatever a
      // future version might put there rather than blanking it.
      aspectConfig: isLayer7 ? columns : undefined,
      showAspects: isLayer7 && !draft.showAspects ? false : undefined,
    });
    onClose();
  };

  return (
    <Dialog open={target !== undefined && draft !== null} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('diagramSettings.title')}</DialogTitle>
      <DialogContent>
        {draft && (
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              autoFocus
              fullWidth
              size="small"
              label={t('field.name')}
              value={draft.name}
              onChange={(e) => edit({ name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                commit();
              }}
            />

            <Box>
              <SectionHeading text={t('diagramSettings.presentation')} />
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 1.25 }}>
                {t('diagramSettings.presentationHelp')}
              </Typography>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    fullWidth
                    label={t('diagramSettings.author')}
                    placeholder={t('diagramSettings.authorPlaceholder')}
                    value={draft.author}
                    disabled={!draft.showTitleBlock}
                    onChange={(e) => edit({ author: e.target.value })}
                  />
                  <TextField
                    size="small"
                    fullWidth
                    label={t('diagramSettings.client')}
                    placeholder={defaultClient}
                    helperText={t('diagramSettings.clientHelp', { name: defaultClient })}
                    value={draft.client}
                    disabled={!draft.showTitleBlock}
                    onChange={(e) => edit({ client: e.target.value })}
                  />
                </Stack>
                <TextField
                  size="small"
                  type="date"
                  label={t('diagramSettings.date')}
                  helperText={t('diagramSettings.dateHelp')}
                  value={draft.documentDate}
                  disabled={!draft.showTitleBlock}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ width: 220 }}
                  onChange={(e) => edit({ documentDate: e.target.value })}
                />
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={draft.showTitleBlock}
                      onChange={(e) => edit({ showTitleBlock: e.target.checked })}
                    />
                  }
                  label={
                    <Typography sx={{ fontSize: 13 }}>
                      {t('diagramSettings.showTitleBlock')}
                    </Typography>
                  }
                />
              </Stack>
            </Box>

            {isLayer7 && (
              <>
                <Divider />
                <Box>
                  <SectionHeading text={t('diagramSettings.aspects')} />
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 1.25 }}>
                    {t('diagramSettings.aspectsHelp')}
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={draft.showAspects}
                        onChange={(e) => edit({ showAspects: e.target.checked })}
                      />
                    }
                    label={
                      <Typography sx={{ fontSize: 13 }}>
                        {t('diagramSettings.showAspects')}
                      </Typography>
                    }
                  />
                  {!draft.showAspects && (
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 1 }}>
                      {t('diagramSettings.hiddenNote')}
                    </Typography>
                  )}

                  <Stack spacing={1} sx={{ mt: 1.25, opacity: draft.showAspects ? 1 : 0.55 }}>
                    {draft.columns.length === 0 && (
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                        {t('diagramSettings.noColumns')}
                      </Typography>
                    )}
                    {draft.columns.map((column, index) => (
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
                          placeholder={derivedShortCode(column.label) || t('diagramSettings.codePlaceholder')}
                          value={column.code ?? ''}
                          sx={{ width: 96 }}
                          slotProps={{ htmlInput: { maxLength: ASPECT_CODE_MAX } }}
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
                              disabled={index === draft.columns.length - 1}
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
                            onClick={() => edit({
                              columns: draft.columns.filter((_, i) => i !== index),
                            })}
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
                      onClick={() => edit({ columns: [...DEFAULT_ASPECT_CONFIG] })}
                    >
                      {t('diagramSettings.reset')}
                    </Button>
                  </Stack>
                  <Menu
                    anchorEl={addMenu}
                    open={addMenu !== null}
                    onClose={() => setAddMenu(null)}
                  >
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
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={commit} disabled={!canSave}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Re-key the columns added in this sitting from the labels they ended up with,
 * so a column typed as "Service levels" is filed as `custom-service-levels` and
 * not as whatever the placeholder said when the row appeared.
 */
function withFreshKeys(draft: Draft): AspectConfigEntry[] {
  if (draft.fresh.length === 0) return draft.columns;
  const settled = draft.columns.filter((c) => !draft.fresh.includes(c.key)).map((c) => c.key);
  return draft.columns.map((column) => {
    if (!draft.fresh.includes(column.key)) return column;
    const key = aspectKeyForLabel(column.label, settled);
    settled.push(key);
    return { ...column, key };
  });
}

function SectionHeading({ text }: { text: string }) {
  return (
    <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: 'text.secondary' }}>
      {text}
    </Typography>
  );
}
