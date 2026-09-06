import { memo } from 'react';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { resolveAccent, shapeRadiusFor } from '../theme/elementStyle';
import { getNodeTokens } from '../theme/tokens';
import { iconSlotSize, NodeDescription, NodeIcon, NodeShell } from './NodeShell';
import type { ElementNodeProps } from './nodeData';

/**
 * Component: C4 container box with a technology line and description.
 * Carries the incomplete-parameters warning (OM values live here — intent
 * rule 8) and is resizable when selected.
 *
 * Phase 3 lit its icon slot: a component is as likely to be "the Kafka one" or
 * "the Postgres one" as an application is, and the old three-kind vendor gate
 * kept the mark off it for no reason anyone could name. The mark sits above the
 * name, because this card centres its content rather than leading with a row.
 */
export const ComponentNode = memo(function ComponentNode({
  data,
  selected,
  height,
}: ElementNodeProps) {
  const theme = useTheme();
  const tokens = getNodeTokens(theme);
  const { element } = data;
  return (
    <NodeShell
      element={element}
      selected={selected}
      readOnly={data.readOnly}
      showLifecycle={data.showLifecycle}
      resizeLimits={data.resizeLimits}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        px: 1,
        py: 0.75,
        backgroundColor: tokens.component.bg,
        border: `1px solid ${resolveAccent(element, tokens.component.border)}`,
        borderRadius: shapeRadiusFor('component', element.shapeVariant, false),
      }}
    >
      <NodeIcon
        element={element}
        size={iconSlotSize(element)}
        color={tokens.card.subtitle}
      />
      <Typography
        sx={{
          fontSize: 12,
          fontWeight: 700,
          color: tokens.component.fg,
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {element.name}
      </Typography>
      <Typography sx={{ fontSize: 9.5, fontStyle: 'italic', color: tokens.card.subtitle }}>
        [{element.technology?.trim() || 'Container'}]
      </Typography>
      <NodeDescription kind="component" text={element.description} height={height} />
    </NodeShell>
  );
});
