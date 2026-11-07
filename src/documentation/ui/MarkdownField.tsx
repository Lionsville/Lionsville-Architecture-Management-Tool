// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An element's description among its other fields: the editor, in its small
 * size, and the way to the page that has more room.
 *
 * Editing in place stays, for a line or two; the way to write more is the
 * button under the field, *Open as a page*, which opens the element's
 * documentation page (ADR-0033) — the same text, with the width of the
 * window and the template's sections around it. A button with words rather
 * than the icon it was until 3.7.0: the icon was read as "make this box
 * bigger" when it was found at all.
 */
import type { ComponentProps, ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import { FullscreenIcon } from '../../widgets/icons';
import { useStrings } from '../../i18n/LanguageContext';
import type { MarkdownRenderOptions } from '../documentation';
import { lazyPart } from '../../widgets/lazyPart';
import type { MarkdownEditor as MarkdownEditorShape } from './MarkdownEditor';

/**
 * The editor in a script of its own, as the renderer is (`renderMarkdown`): this
 * field stands in the inspector, which is in the first download, and the first
 * download has no room for a toolbar, a list of blocks and a dialog.
 */
const MarkdownEditor = lazyPart<ComponentProps<typeof MarkdownEditorShape>>(
  () => import('./MarkdownEditor').then((held) => held.MarkdownEditor),
);

export function MarkdownField({
  value,
  disabled,
  onChange,
  renderMarkdown,
  onOpenDocumentation,
  autoFocus,
  placeholder,
}: {
  value: string;
  /** What an empty field asks for, where it is not an element's description. */
  placeholder?: string;
  disabled: boolean;
  onChange(value: string): void;
  renderMarkdown?(md: string, options?: MarkdownRenderOptions): ReactNode;
  /** Opens the documentation page — the same text, with room to read and write it. */
  onOpenDocumentation?(): void;
  /** It opened on a press, so the caret goes straight into it. */
  autoFocus?: boolean;
}) {
  const { t } = useStrings();
  return (
    <Box>
      <MarkdownEditor
        value={value}
        onChange={onChange}
        disabled={disabled}
        label={t('field.description')}
        placeholder={placeholder ?? t('field.descriptionPlaceholder')}
        maxRows={10}
        {...(autoFocus ? { autoFocus } : {})}
        {...(renderMarkdown ? { renderPreview: (text: string) => renderMarkdown(text) } : {})}
      />
      {onOpenDocumentation && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.25 }}>
          <Tooltip title={t('field.openDocumentationTip')}>
            <Button
              size="small"
              data-testid="open-documentation"
              startIcon={<FullscreenIcon size={14} />}
              onClick={onOpenDocumentation}
              sx={{ fontSize: 'var(--t-small)', textTransform: 'none', minWidth: 0, px: 0.75, py: 0.25, '& .MuiButton-startIcon': { mr: 0.5 } }}
            >
              {t('field.openDocumentation')} ›
            </Button>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}
