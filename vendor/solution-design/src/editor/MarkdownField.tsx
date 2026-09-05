import { useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { EyeIcon, FullscreenIcon, PencilIcon } from './toolbarIcons';
import { useStrings } from '../i18n/LanguageContext';
import type { MarkdownRenderOptions } from '../types';

/**
 * Markdown description editor with a preview toggle. Rendering is host-
 * pluggable (`renderMarkdown` prop on the editor); without a renderer the
 * preview falls back to a plain <pre> so the package needs no markdown
 * dependency of its own.
 */
export function MarkdownField({
  value,
  disabled,
  onChange,
  renderMarkdown,
  onOpenDocumentation,
}: {
  value: string;
  disabled: boolean;
  onChange(value: string): void;
  renderMarkdown?(md: string, options?: MarkdownRenderOptions): ReactNode;
  /** Opens the documentation page — the same text, with room to read and write it. */
  onOpenDocumentation?(): void;
}) {
  const { t } = useStrings();
  const [preview, setPreview] = useState(false);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {t('field.descriptionMarkdown')}
        </Typography>
        <Box sx={{ display: 'flex' }}>
        {onOpenDocumentation && (
          <Tooltip title={t('field.openDocumentation')}>
            <IconButton size="small" aria-label={t('field.openDocumentation')} onClick={onOpenDocumentation}>
              <FullscreenIcon size={16} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={preview ? t('field.edit') : t('field.preview')}>
          <IconButton
            size="small"
            aria-label={preview ? t('field.editDescription') : t('field.previewDescription')}
            onClick={() => setPreview((p) => !p)}
          >
            {preview ? <PencilIcon /> : <EyeIcon />}
          </IconButton>
        </Tooltip>
        </Box>
      </Box>
      {preview ? (
        <Box
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            px: 1.25,
            py: 0.75,
            minHeight: 96,
            fontSize: 13,
            '& pre': { m: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13 },
          }}
        >
          {renderMarkdown ? renderMarkdown(value) : <pre>{value || '—'}</pre>}
        </Box>
      ) : (
        <TextField
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          multiline
          minRows={4}
          maxRows={12}
          fullWidth
          placeholder={t('field.descriptionPlaceholder')}
          slotProps={{ htmlInput: { 'aria-label': t('field.description') } }}
        />
      )}
    </Box>
  );
}
