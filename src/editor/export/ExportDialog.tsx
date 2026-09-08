/**
 * The export, as a dialog: which theme the picture is made in, whether every
 * line carries its label, whether the strip along the bottom is drawn — and a
 * preview of exactly what will leave, drawn by the same code that draws the
 * export.
 *
 * The preview is the point. A title block is composed onto the bitmap and
 * never appears on the canvas, a dark board can be exported light for a
 * document, and labels that are a hover away on screen are simply absent on
 * paper; none of that could be seen before pressing the button. Now the
 * button is pressed once the picture already looks right.
 *
 * The dialog owns none of the drawing. The editor renders the board under the
 * chosen options while this is open and hands over the preview and the size;
 * this decides nothing but what the person chose.
 */
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useStrings } from '../../i18n/LanguageContext';
import { LARGE_EXPORT_MEGAPIXELS } from './exportPng';

/** What a person chooses about a picture. */
export interface ExportOptions {
  theme: 'light' | 'dark';
  /** Every line's label, not only the ones the pointer would find. */
  showLabels: boolean;
  /** The strip along the bottom: client, author, date. */
  titleBlock: boolean;
  /** The key under the strip: the aspect columns, the badge and lifecycle colours. */
  legend: boolean;
}

export interface ExportDialogProps {
  open: boolean;
  options: ExportOptions;
  onChange(next: ExportOptions): void;
  /** An object URL of the preview, or nothing while the first one is drawn. */
  preview?: string;
  previewBusy: boolean;
  /** The bitmap the export would produce, before it is produced. */
  size: { width: number; height: number; megapixels: number };
  /** The real export is running; the button spins and the options hold still. */
  exporting: boolean;
  onExport(): void;
  onClose(): void;
}

export function ExportDialog(props: ExportDialogProps) {
  const { t } = useStrings();
  const { options, onChange } = props;
  const large = props.size.megapixels > LARGE_EXPORT_MEGAPIXELS;

  return (
    <Dialog open={props.open} onClose={props.exporting ? undefined : props.onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('export.dialogTitle')}</DialogTitle>
      <DialogContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
          <Stack spacing={2} sx={{ minWidth: 220 }}>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: 'text.secondary', mb: 0.5 }}>
                {t('export.theme')}
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={options.theme}
                disabled={props.exporting}
                aria-label={t('export.theme')}
                onChange={(_event, theme: ExportOptions['theme'] | null) => {
                  if (theme) onChange({ ...options, theme });
                }}
              >
                <ToggleButton value="light">{t('export.themeLight')}</ToggleButton>
                <ToggleButton value="dark">{t('export.themeDark')}</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Box>
              <FormControlLabel
                control={(
                  <Switch
                    size="small"
                    checked={options.showLabels}
                    disabled={props.exporting}
                    onChange={(event) => onChange({ ...options, showLabels: event.target.checked })}
                  />
                )}
                label={t('export.labels')}
              />
              <Typography sx={{ fontSize: 11, color: 'text.secondary', ml: 1 }}>
                {t('export.labelsHelp')}
              </Typography>
            </Box>
            <Box>
              <FormControlLabel
                control={(
                  <Switch
                    size="small"
                    checked={options.titleBlock}
                    disabled={props.exporting}
                    onChange={(event) => onChange({ ...options, titleBlock: event.target.checked })}
                  />
                )}
                label={t('export.titleBlock')}
              />
              <Typography sx={{ fontSize: 11, color: 'text.secondary', ml: 1 }}>
                {t('export.titleBlockHelp')}
              </Typography>
            </Box>
            <Box>
              <FormControlLabel
                control={(
                  <Switch
                    size="small"
                    checked={options.legend && options.titleBlock}
                    // The key lives on the strip: without one there is nowhere to draw it.
                    disabled={props.exporting || !options.titleBlock}
                    onChange={(event) => onChange({ ...options, legend: event.target.checked })}
                  />
                )}
                label={t('export.legend')}
              />
              <Typography sx={{ fontSize: 11, color: 'text.secondary', ml: 1 }}>
                {t('export.legendHelp')}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              {t('export.size', props.size)}
            </Typography>
            {large && <Alert severity="warning" sx={{ fontSize: 12 }}>{t('export.largeBody')}</Alert>}
          </Stack>

          {/* The preview sits on the export's own background, so a light
              picture previewed in a dark window is seen as it will be seen. */}
          <Box
            sx={{
              flex: 1,
              minHeight: 240,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: options.theme === 'dark' ? '#121212' : '#ffffff',
              overflow: 'hidden',
            }}
          >
            {props.preview ? (
              <Box
                component="img"
                src={props.preview}
                alt={t('export.preview')}
                sx={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }} role="status">
                {t('export.previewBusy')}
              </Typography>
            )}
            {props.previewBusy && props.preview && (
              <CircularProgress size={20} sx={{ position: 'absolute', top: 8, right: 8 }} />
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose} disabled={props.exporting}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          onClick={props.onExport}
          disabled={props.exporting}
          startIcon={props.exporting ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {large ? t('export.largeConfirm') : t('export.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
