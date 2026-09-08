/**
 * The corner of a container diagram: what this is the container diagram OF.
 *
 * Pinned to the window, not the board — it stays in the bottom-left corner
 * however the board is panned, hovering over the drawing the way Structurizr's
 * does. It lets pointer events through so a card underneath is still a card.
 * The export draws the same four lines into its strip along the bottom
 * (`exportPng`), from the same `C4PanelInfo`, so what the reader sees on
 * paper is what the author saw on screen.
 */
import { Panel } from '@xyflow/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import type { C4PanelInfo } from '../export/c4Panel';

/** Clear of React Flow's zoom controls, which own the corner itself. */
const CONTROLS_CLEARANCE = 56;

export function C4InfoPanel({ info }: { info: C4PanelInfo }) {
  const theme = useTheme();
  return (
    <Panel position="bottom-left" style={{ marginLeft: CONTROLS_CLEARANCE, pointerEvents: 'none' }}>
      <Box
        data-testid="lv-c4-panel"
        sx={{
          maxWidth: 360,
          px: 1.5,
          py: 1,
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.background.paper, 0.92),
          backdropFilter: 'blur(4px)',
          boxShadow: 1,
        }}
      >
        <Typography sx={{ fontSize: 10, fontWeight: 600, color: 'primary.main', lineHeight: 1.4 }}>
          {info.scope}
        </Typography>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary', lineHeight: 1.3 }}>
          {info.title}
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.4 }}>
          {info.description}
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'text.secondary', lineHeight: 1.4 }}>
          {info.date}
        </Typography>
      </Box>
    </Panel>
  );
}
