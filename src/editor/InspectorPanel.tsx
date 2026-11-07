// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { PANEL_LIMITS } from './panels';
import { useStrings } from '../i18n/LanguageContext';
import { CompactForms } from '../widgets/CompactForms';
import { PanelDockProvider } from '../widgets/kit/Panel';
import type { PanelDock } from '../widgets/kit/Panel';

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
 * The column a panel stands in: its width and the seam's, and folding it to a
 * rail, both of which outlive the panel in it. The kit's Panel takes them from
 * here (`PanelDock`) and draws its own identity and chevron. What a view hands in
 * that is not a Panel yet gets the chrome around it from here, in the treatment
 * every form in this column had.
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
  /** Expanded width in px (dragged on the seam, clamped by `model/panels`). */
  width?: number;
}) {
  const { t } = useStrings();
  const [panels, setPanels] = useState(0);
  const dock = useMemo<PanelDock>(() => ({
    width,
    onCollapse: () => onToggleCollapsed?.(),
    dataGuide: 'board.inspector',
    claim: () => {
      setPanels((held) => held + 1);
      return () => setPanels((held) => held - 1);
    },
  }), [width, onToggleCollapsed]);
  const fold = (
    <Tooltip title={collapsed ? t('inspector.expand') : t('inspector.collapse')} placement="left">
      <IconButton
        size="small"
        aria-label={collapsed ? t('inspector.expand') : t('inspector.collapse')}
        aria-pressed={collapsed}
        onClick={onToggleCollapsed}
      >
        <Chevron direction={collapsed ? 'left' : 'right'} />
      </IconButton>
    </Tooltip>
  );
  if (panels > 0 && !collapsed) {
    return (
      <PanelDockProvider value={dock}>
        <Box sx={{ width, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{children}</Box>
      </PanelDockProvider>
    );
  }
  return (
    <Box
      component="aside"
      aria-label={t('inspector.aside')}
      data-guide="board.inspector"
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
      <Box sx={{ display: 'flex', justifyContent: collapsed ? 'center' : 'flex-start', p: 0.5, flexShrink: 0 }}>{fold}</Box>
      {!collapsed && (
        <Box sx={{ overflowY: 'auto', px: 1.5, pb: 1.5, flex: 1, minHeight: 0 }}>
          <PanelDockProvider value={dock}>
            <CompactForms>{children}</CompactForms>
          </PanelDockProvider>
        </Box>
      )}
    </Box>
  );
}
