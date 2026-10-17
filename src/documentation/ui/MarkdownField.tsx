// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import { EyeIcon, FullscreenIcon, PencilIcon } from '../../widgets/icons';
import { FieldLabel } from '../../widgets/CompactForms';
import { useStrings } from '../../i18n/LanguageContext';
import type { MarkdownRenderOptions } from '../documentation';
import { MarkdownHelp } from './MarkdownHelp';

/**
 * Markdown description editor with a preview toggle. Rendering is host-
 * pluggable (`renderMarkdown` prop on the editor); without a renderer the
 * preview falls back to a plain <pre> so the package needs no markdown
 * dependency of its own.
 *
 * Editing in place stays, for a line or two; the way to write more is the
 * button under the field, *Open as a page*, which opens the element's
 * documentation page (ADR-0033) — the same text, with the width of the
 * window and the template's sections around it. A button with words rather
 * than the icon it was until 3.7.0: the icon was read as "make this box
 * bigger" when it was found at all.
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
    <Box data-testid="description-field">
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
        <FieldLabel sx={{ fontWeight: 600 }}>{t('field.descriptionMarkdown')}</FieldLabel>
        <Box sx={{ display: 'flex' }}>
        <MarkdownHelp />
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
          minRows={3}
          maxRows={10}
          fullWidth
          placeholder={t('field.descriptionPlaceholder')}
          slotProps={{ htmlInput: { 'aria-label': t('field.description') } }}
        />
      )}
      {onOpenDocumentation && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.25 }}>
          <Tooltip title={t('field.openDocumentationTip')}>
            <Button
              size="small"
              data-testid="open-documentation"
              startIcon={<FullscreenIcon size={14} />}
              onClick={onOpenDocumentation}
              sx={{ fontSize: 11.5, textTransform: 'none', minWidth: 0, px: 0.75, py: 0.25, '& .MuiButton-startIcon': { mr: 0.5 } }}
            >
              {t('field.openDocumentation')} ›
            </Button>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}
