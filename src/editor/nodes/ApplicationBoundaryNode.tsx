import { memo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { resolveAccent, shapeRadiusFor } from '../theme/elementStyle';
import { getNodeTokens } from '../theme/tokens';
import { iconSlotSize, NodeIcon, NodeShell } from './NodeShell';
import type { ElementNodeProps } from './nodeData';

/**
 * On a container diagram, the application itself renders as the C4 boundary:
 * a large dashed rectangle the components live inside. It is a real node
 * (selectable; floating edges from context elements attach to its sides) but
 * sits behind everything via a negative z-index set in graph building.
 *
 * Phase 3 lit its icon slot too, which is the case that most obviously wanted
 * it: this is the APPLICATION's own diagram, so the application's own logo
 * belongs on the frame around it.
 *
 * It is the one node that takes no resizer (the boundary is sized by the
 * diagram, not dragged) and no selection ring — it recolours its dashed border
 * instead, because a 2 px ring around a whole container diagram would read as a
 * frame around the components inside it.
 */
export const ApplicationBoundaryNode = memo(function ApplicationBoundaryNode({
  data,
  selected,
}: ElementNodeProps) {
  const tokens = getNodeTokens(useTheme());
  const { element } = data;
  return (
    <NodeShell
      element={element}
      selected={selected}
      readOnly={data.readOnly}
      showLifecycle={data.showLifecycle}
      selectionRing={false}
    >
      {/*
       * Interior fill + dashed border are purely decorative. They must not
       * intercept pointer events: this node sits behind its children via a
       * negative z-index (see graph.ts), but a *selected* boundary can still
       * end up painted on top in some stacking scenarios, which would
       * otherwise swallow clicks meant for child component nodes. The title
       * bar below stays interactive so the boundary itself remains
       * selectable — and the handles are the shell's, drawn OUTSIDE this fill
       * for the same reason: inside it they would inherit `none`.
       */}
      <Box
        data-testid="boundary-fill"
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          backgroundColor: tokens.boundary.bg,
          border: `1.5px dashed ${selected ? tokens.card.selectedRing : resolveAccent(element, tokens.boundary.border)}`,
          borderRadius: shapeRadiusFor('boundary', element.shapeVariant, false),
          pointerEvents: 'none',
        }}
      >
        <Box
          data-testid="boundary-title"
          sx={{
            px: 1.5,
            py: 1,
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <NodeIcon element={element} size={iconSlotSize(element, 16)} color={tokens.boundary.fg} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.boundary.fg }}>
              {element.name}
            </Typography>
            <Typography sx={{ fontSize: 10, fontStyle: 'italic', color: tokens.boundary.fg }}>
              [Application]
            </Typography>
          </Box>
        </Box>
      </Box>
    </NodeShell>
  );
});
