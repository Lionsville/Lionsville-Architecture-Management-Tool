import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import { getNodeTokens } from '../theme/tokens';
import { aspectShortCode } from '../../model/aspects';
import type { AspectConfigEntry, DesignElement } from '../../model/types';
import { useStrings } from '../../i18n/LanguageContext';
import { ASPECT_STATUS_LABEL } from '../aspectLegend';

/**
 * Compact aspect strip rendered from the diagram's configured aspect columns
 * (order + labels). Unset aspects render muted; the tooltip carries the long
 * name and the status in one line, in the reader's language, with the
 * per-application note after it — the card's own 8px code stays as it is.
 */
export function AspectBadgeRow({
  aspects,
  config,
}: {
  aspects: DesignElement['aspects'];
  config: readonly AspectConfigEntry[];
}) {
  const { t } = useStrings();
  const tokens = getNodeTokens(useTheme());
  return (
    <Box sx={{ display: 'flex', gap: '2px', px: 0.5, pb: 0.5 }}>
      {config.map((entry) => {
        const aspect = aspects[entry.key];
        const token = tokens.aspects[aspect?.status ?? 'unset'];
        const tooltip = aspect
          ? `${entry.label}: ${t(ASPECT_STATUS_LABEL[aspect.status])}${aspect.note ? ` — ${aspect.note}` : ''}${aspect.derived ? ` (${t('aspect.derivedTip')})` : ''}`
          : `${entry.label}: ${t('aspect.notSet')}`;
        return (
          <Tooltip key={entry.key} title={tooltip}>
            <Box
              sx={{
                flex: 1,
                textAlign: 'center',
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: 0.3,
                lineHeight: '14px',
                borderRadius: '3px',
                color: token.fg,
                backgroundColor: token.bg,
                border: `1px solid ${token.border}`,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {aspectShortCode(entry)}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}
