import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import { getNodeTokens } from '../theme/tokens';
import { aspectShortCode } from '../model/aspects';
import type { AspectConfigEntry, AspectStatus, DesignElement } from '../types';

/**
 * Compact aspect strip rendered from the diagram's configured aspect columns
 * (order + labels). Unset aspects render muted; the tooltip carries the
 * status and the per-application note.
 */
const STATUS_LABEL: Record<AspectStatus, string> = {
  managed: 'managed',
  partial: 'partial',
  atRisk: 'at risk',
  none: 'none',
};

export function AspectBadgeRow({
  aspects,
  config,
}: {
  aspects: DesignElement['aspects'];
  config: readonly AspectConfigEntry[];
}) {
  const tokens = getNodeTokens(useTheme());
  return (
    <Box sx={{ display: 'flex', gap: '2px', px: 0.5, pb: 0.5 }}>
      {config.map((entry) => {
        const aspect = aspects[entry.key];
        const token = tokens.aspects[aspect?.status ?? 'unset'];
        const tooltip = aspect
          ? `${entry.label}: ${STATUS_LABEL[aspect.status]}${aspect.note ? ` — ${aspect.note}` : ''}`
          : `${entry.label}: not set`;
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
