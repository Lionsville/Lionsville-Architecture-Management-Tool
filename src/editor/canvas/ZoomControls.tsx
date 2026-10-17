// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { Panel, useReactFlow } from '@xyflow/react';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import { FitIcon } from '../../widgets/icons';
import { useStrings } from '../../i18n/LanguageContext';
import { FIT_ALL } from './fitAll';
import { PlacementToolbar } from './PlacementToolbar';
import type { PlacementToolbarProps } from './PlacementToolbar';

/**
 * The one cluster floating on the canvas, bottom left: zoom in, zoom out and
 * fit — ours, in the corner React Flow's `<Controls>` took, so the words are
 * the table's — and, on a canvas that may be edited, the grid, the snap and
 * the align and distribute buttons beside them. One cluster, not one at the
 * top centre and another at the bottom left: a person looks in one place for
 * what the canvas offers.
 */
export function ZoomControls({ placement }: { placement?: PlacementToolbarProps }) {
  const { t } = useStrings();
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const button = (label: string, onClick: () => void, glyph: React.ReactNode, testId: string) => (
    <Tooltip title={label} placement="top">
      <IconButton size="small" aria-label={label} onClick={onClick} data-testid={testId}>
        {glyph}
      </IconButton>
    </Tooltip>
  );
  return (
    <Panel position="bottom-left">
      <Paper elevation={2} sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.25, borderRadius: 2 }} data-testid="zoom-controls">
        {button(t('canvas.zoomIn'), () => void zoomIn({ duration: 150 }), <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>+</span>, 'zoom-in')}
        {button(t('canvas.zoomOut'), () => void zoomOut({ duration: 150 }), <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>−</span>, 'zoom-out')}
        {button(t('canvas.zoomFit'), () => void fitView({ ...FIT_ALL, duration: 300 }), <FitIcon size={16} />, 'zoom-fit')}
        {placement && (
          <>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
            <PlacementToolbar {...placement} />
          </>
        )}
      </Paper>
    </Panel>
  );
}
