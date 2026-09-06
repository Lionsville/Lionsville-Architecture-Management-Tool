import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import { getNodeTokens } from '../theme/tokens';
import { useStrings } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';
import type { Lifecycle } from '../../model/types';

/**
 * Shared lifecycle badge (U5): a compact, colour-coded uppercase pill shown in
 * the top-right of every node kind. Colour comes from `tokens.lifecycle`
 * (theme-derived, light/dark-aware); the uppercase text label is a second,
 * non-colour channel so lifecycle is never colour-only (accessibility, D1).
 *
 * Renders nothing for `live` (the normal state — badging every node is noise,
 * D3) or when the toolbar toggle hides it. It is an absolute overlay anchored
 * to the node's positioned wrapper and sits *outside* each root box's
 * `overflow: hidden`, so it never clips on the rounded/stadium or small chip
 * shapes (plan positioning constraints, non-clipped-wrapper fallback).
 */
export function LifecycleBadge({ lifecycle, show }: { lifecycle: Lifecycle; show: boolean }) {
  const { t } = useStrings();
  const tokens = getNodeTokens(useTheme());
  if (!show || lifecycle === 'live') return null;
  const token = tokens.lifecycle[lifecycle];
  return (
    <Box
      aria-label={t('node.lifecycleAria', { name: t(`lifecycle.${lifecycle}` as StringKey) })}
      sx={{
        position: 'absolute',
        top: 3,
        right: 3,
        zIndex: 2,
        px: 0.5,
        fontSize: 8,
        fontWeight: 700,
        letterSpacing: 0.4,
        lineHeight: '13px',
        borderRadius: '3px',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        color: token.fg,
        backgroundColor: token.bg,
        border: `1px solid ${token.border}`,
      }}
    >
      {lifecycle}
    </Box>
  );
}
