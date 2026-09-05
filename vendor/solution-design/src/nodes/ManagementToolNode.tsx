import { memo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { resolveAccent, shapeRadiusFor } from '../theme/elementStyle';
import { getNodeTokens } from '../theme/tokens';
import { WrenchGlyph } from './glyphs';
import { iconSlotSize, NodeDescription, NodeIcon, NodeShell } from './NodeShell';
import type { ElementNodeProps } from './nodeData';
import { shortDescription } from '../model/documentation';

/** Management tool: compact chip with vendor text (bottom band). */
export const ManagementToolNode = memo(function ManagementToolNode({
  data,
  selected,
  height,
}: ElementNodeProps) {
  const tokens = getNodeTokens(useTheme());
  const { element } = data;
  return (
    <NodeShell
      element={element}
      selected={selected}
      readOnly={data.readOnly}
      showLifecycle={data.showLifecycle}
      resizeLimits={data.resizeLimits}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        backgroundColor: tokens.managementTool.bg,
        border: `1px solid ${resolveAccent(element, tokens.managementTool.border)}`,
        borderRadius: shapeRadiusFor('managementTool', element.shapeVariant, false),
        color: tokens.managementTool.fg,
        overflow: 'hidden',
      }}
    >
      {/* A resolved mark takes the leading wrench slot; unknown/absent → wrench. */}
      <NodeIcon element={element} size={iconSlotSize(element, 13)} fallback={<WrenchGlyph />} />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {element.name}
        </Typography>
        {element.vendor && (
          <Typography
            sx={{
              fontSize: 9,
              color: tokens.card.subtitle,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {element.vendor}
          </Typography>
        )}
        {shortDescription(element.description) && (
          <NodeDescription kind="managementTool" text={element.description} height={height} />
        )}
      </Box>
    </NodeShell>
  );
});
