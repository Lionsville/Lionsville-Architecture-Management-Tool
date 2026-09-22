// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { PANEL_LIMITS } from './panels';
import { useStrings } from '../i18n/LanguageContext';

export const INSPECTOR_WIDTH = PANEL_LIMITS.inspector.default;
/** Collapsed rail width (U7b, D5): wide enough for the expand chevron only. */
export const INSPECTOR_RAIL_WIDTH = PANEL_LIMITS.inspector.rail;

/** A small left/right chevron (inline SVG — the package avoids @mui/icons-material). */
function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Right-hand panel chrome; content is the element/connection inspector. It is a
 * `flexShrink: 0` sibling of the `flex: 1` canvas, so collapsing to the rail
 * (U7b, D5) lets the canvas reclaim the width with no manual resize. The chevron
 * toggle sits on the panel's inner-left edge so it stays reachable in both
 * states; collapse works regardless of `readOnly` (a bigger canvas helps viewing
 * too). State is owned by `EditorBody` — this component is presentational.
 */
export function InspectorPanel({
  children,
  collapsed = false,
  onToggleCollapsed,
  width = INSPECTOR_WIDTH,
}: {
  children: ReactNode;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Expanded width in px (4B: dragged on the seam, clamped by `model/panels`). */
  width?: number;
}) {
  const { t } = useStrings();
  return (
    <Box
      component="aside"
      aria-label={t('inspector.aside')}
      sx={{
        width: collapsed ? INSPECTOR_RAIL_WIDTH : width,
        flexShrink: 0,
        borderLeft: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'flex-start',
          p: 0.5,
          flexShrink: 0,
        }}
      >
        <Tooltip
          title={collapsed ? t('inspector.expand') : t('inspector.collapse')}
          placement="left"
        >
          <IconButton
            size="small"
            aria-label={collapsed ? t('inspector.expand') : t('inspector.collapse')}
            aria-pressed={collapsed}
            onClick={onToggleCollapsed}
          >
            <Chevron direction={collapsed ? 'left' : 'right'} />
          </IconButton>
        </Tooltip>
      </Box>
      {!collapsed && (
        <Box sx={{ overflowY: 'auto', px: 1.5, pb: 1.5, flex: 1, minHeight: 0 }}>{children}</Box>
      )}
    </Box>
  );
}

/**
 * The empty state: what to do, and nothing else. The badge legend that used
 * to sit here — a hard-coded PLT and the four colours — vanished on the first
 * click and named no column; it is the toolbar's legend button now, drawn
 * from the board's own columns (`badgeLegend`).
 */
export function InspectorEmptyState() {
  const { t } = useStrings();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
      <Typography variant="body2" color="text.secondary">
        {t('inspector.empty')}
      </Typography>
      {/* Said here so it can be read before the gesture is known, not only
          once a second element is already selected. */}
      <Typography variant="body2" color="text.secondary">
        {t('inspector.emptyHint')}
      </Typography>
    </Box>
  );
}
