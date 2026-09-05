import { memo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { resolveAccent, shapeRadiusFor } from '../theme/elementStyle';
import { getNodeTokens } from '../theme/tokens';
import { ChannelGlyph } from './glyphs';
import { iconSlotSize, NodeDescription, NodeIcon, NodeShell } from './NodeShell';
import type { ElementNodeProps } from './nodeData';
import { shortDescription } from '../model/documentation';

/**
 * Input channel: how work and data enter the landscape (left band).
 *
 * Phase 3 lit its icon slot. An input channel is precisely the kind of box that
 * wants a mark — a portal, a chat channel, an API, a travel card gate all enter
 * the landscape the same way and look identical without one.
 */
export const InputChannelNode = memo(function InputChannelNode({
  data,
  selected,
  height,
}: ElementNodeProps) {
  const tokens = getNodeTokens(useTheme());
  const { element } = data;
  const description = shortDescription(element.description);
  const hasDescription = Boolean(description);
  return (
    <NodeShell
      element={element}
      selected={selected}
      readOnly={data.readOnly}
      showLifecycle={data.showLifecycle}
      resizeLimits={data.resizeLimits}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 0.25,
        px: 1,
        py: 0.5,
        backgroundColor: tokens.inputChannel.bg,
        border: `1px solid ${resolveAccent(element, tokens.inputChannel.border)}`,
        // Plain rounded rect — no stadium clamp (plan D-shape: input channel is 2 today).
        borderRadius: shapeRadiusFor('inputChannel', element.shapeVariant, hasDescription),
        color: tokens.inputChannel.fg,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
        <NodeIcon element={element} size={iconSlotSize(element)} fallback={<ChannelGlyph />} />
        <Typography
          sx={{
            fontSize: 11.5,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {element.name}
        </Typography>
      </Box>
      {hasDescription && (
        <NodeDescription kind="inputChannel" text={description} height={height} />
      )}
    </NodeShell>
  );
});
