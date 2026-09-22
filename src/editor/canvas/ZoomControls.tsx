// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { Panel, useReactFlow } from '@xyflow/react';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import { FitIcon } from '../../widgets/icons';
import { useStrings } from '../../i18n/LanguageContext';
import { FIT_ALL } from './fitAll';

/**
 * Zoom in, zoom out, fit — ours, in the corner React Flow's `<Controls>`
 * took. Its three carried English titles no Dutch reader chose and could
 * not be given the table's words; these go through `t()` like the grid and
 * snap buttons beside them, and are drawn for a reader too.
 */
export function ZoomControls() {
  const { t } = useStrings();
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const button = (label: string, onClick: () => void, glyph: React.ReactNode, testId: string) => (
    <Tooltip title={label} placement="right">
      <IconButton size="small" aria-label={label} onClick={onClick} data-testid={testId}>
        {glyph}
      </IconButton>
    </Tooltip>
  );
  return (
    <Panel position="bottom-left">
      <Paper elevation={2} sx={{ display: 'flex', flexDirection: 'column', p: 0.25, borderRadius: 2 }} data-testid="zoom-controls">
        {button(t('canvas.zoomIn'), () => void zoomIn({ duration: 150 }), <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>+</span>, 'zoom-in')}
        {button(t('canvas.zoomOut'), () => void zoomOut({ duration: 150 }), <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>−</span>, 'zoom-out')}
        {button(t('canvas.zoomFit'), () => void fitView({ ...FIT_ALL, duration: 300 }), <FitIcon size={16} />, 'zoom-fit')}
      </Paper>
    </Panel>
  );
}
