/**
 * What the renderer draws, on one card: a `?` beside every markdown field
 * that opens a table of the marks and what each becomes.
 *
 * The syntax column is not translated, because it is not words — it is what
 * a person types, and it is the same in every language. Only the sentence
 * beside each row is. The rows are the renderer's actual vocabulary
 * (`MarkdownView` and the block registry), which is why the picture row is
 * withdrawn on a host that cannot take a picture in: help that describes a
 * thing the page cannot do is not help.
 */
import { useState, type MouseEvent } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { HelpIcon } from '../../widgets/icons';
import { useStrings } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n';

type Row = { syntax: string; label: StringKey; images?: true };

/** In the order a writer meets them: structure first, then the things only this app draws. */
const ROWS: readonly Row[] = [
  { syntax: '# Title\n## Section\n### Heading', label: 'docHelp.heading' },
  { syntax: '**bold**  _italic_', label: 'docHelp.emphasis' },
  { syntax: '- item\n1. step', label: 'docHelp.lists' },
  { syntax: '- [ ] to do\n- [x] done', label: 'docHelp.tasks' },
  { syntax: '[[Order Management]]', label: 'docHelp.elementLink' },
  { syntax: '[text](https://example.org)', label: 'docHelp.link' },
  { syntax: '![caption](../images/file.png)', label: 'docHelp.image', images: true },
  { syntax: '| a | b |\n|---|---|\n| 1 | 2 |', label: 'docHelp.table' },
  { syntax: '> quoted', label: 'docHelp.quote' },
  { syntax: '`code`\n```\nblock\n```', label: 'docHelp.code' },
  { syntax: '```mermaid\nflowchart LR\n  A --> B\n```', label: 'docHelp.mermaid' },
  { syntax: '```business-case\n…\n```', label: 'docHelp.businessCase' },
  { syntax: '---', label: 'docHelp.rule' },
];

const CODE_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export function MarkdownHelp({ images = false }: {
  /** Whether this host can take a picture in — the picture row is offered only then. */
  images?: boolean;
}) {
  const { t } = useStrings();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const rows = ROWS.filter((row) => images || !row.images);

  return (
    <>
      <Tooltip title={t('docHelp.markdown')}>
        <IconButton
          size="small"
          aria-label={t('docHelp.markdown')}
          aria-haspopup="dialog"
          onClick={(event: MouseEvent<HTMLElement>) => setAnchor(event.currentTarget)}
        >
          <HelpIcon size={16} />
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { p: 2, maxWidth: 520 }, role: 'dialog', 'aria-label': t('docHelp.title') } }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{t('docHelp.title')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{t('docHelp.intro')}</Typography>
        <Box
          component="table"
          data-testid="markdown-help"
          sx={{ borderCollapse: 'collapse', width: '100%', '& td': { verticalAlign: 'top', py: 0.5, borderTop: 1, borderColor: 'divider' } }}
        >
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <Box component="td" sx={{ pr: 2, whiteSpace: 'pre', fontFamily: CODE_FONT, fontSize: 12, color: 'text.primary' }}>
                  {row.syntax}
                </Box>
                <Box component="td" sx={{ fontSize: 13 }}>{t(row.label)}</Box>
              </tr>
            ))}
          </tbody>
        </Box>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
          {images && `${t('docHelp.imagesNote')} `}{t('docHelp.htmlNote')}
        </Typography>
      </Popover>
    </>
  );
}
