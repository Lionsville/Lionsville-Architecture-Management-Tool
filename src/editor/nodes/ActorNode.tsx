// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { memo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { useStrings } from '../../i18n/LanguageContext';
import { resolveAccent } from '../theme/elementStyle';
import { getNodeTokens } from '../theme/tokens';
import { BoardTile } from './BoardTile';
import { StickmanGlyph } from './glyphs';
import { NodeShell } from './NodeShell';
import type { ElementNodeProps } from './nodeData';

/** The figure (D11), in the accent somebody chose, with its announcement. */
function Stickman({ color }: { color: string }) {
  const { t } = useStrings();
  return (
    <Box sx={{ color, display: 'flex' }} role="img" aria-label={t('node.actorFigure')}>
      <StickmanGlyph size={34} />
    </Box>
  );
}

/**
 * An actor (top zone of the board). The figure variant is a figure and no card, and
 * exists to be one; every other actor is a tile like the rest.
 */
export const ActorNode = memo(function ActorNode({ data, selected }: ElementNodeProps) {
  const tokens = getNodeTokens(useTheme());
  const { element } = data;
  if (element.shapeVariant === 'figure') {
    return (
      <NodeShell
        element={element}
        selected={selected}
        readOnly={data.readOnly}
        showLifecycle={data.showLifecycle}
        phase={data.phase}
        resizeLimits={data.resizeLimits}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.25,
          borderRadius: 2,
          color: tokens.actor.fg,
        }}
      >
        <Stickman color={resolveAccent(element, tokens.actor.fg)} />
        <Typography
          sx={{
            fontSize: 'calc(11.5px / var(--canvas-zoom, 1))',
            fontWeight: 600,
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {element.name}
        </Typography>
      </NodeShell>
    );
  }
  return <BoardTile data={data} selected={selected} shape="actor" />;
});
