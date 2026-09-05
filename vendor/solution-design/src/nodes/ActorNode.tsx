import { memo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { resolveAccent, shapeRadiusFor } from '../theme/elementStyle';
import { getNodeTokens } from '../theme/tokens';
import { useStrings } from '../i18n/LanguageContext';
import { PersonGlyph, StickmanGlyph } from './glyphs';
import { iconSlotSize, NodeDescription, NodeIcon, NodeShell } from './NodeShell';
import type { ElementNodeProps } from './nodeData';
import { shortDescription } from '../model/documentation';

/**
 * Stickman/figure mark (D11). The paths live in `glyphs.tsx` so the palette can
 * draw the same figure; this wrapper supplies what the NODE owns — the accent
 * colour (`currentColor` inherits it), the 26×34 box, and the announcement.
 */
function Stickman({ color }: { color: string }) {
  const { t } = useStrings();
  return (
    <Box sx={{ color, display: 'flex' }} role="img" aria-label={t('node.actorFigure')}>
      <StickmanGlyph size={34} />
    </Box>
  );
}

/**
 * Actor: rounded chip with a person glyph (top zone of the Layer 7 board).
 *
 * Phase 3 lit its icon slot: a chosen mark replaces the generic person, so a
 * "Traveller", a "Conductor" and a "Service desk" stop looking like the same
 * box. The stickman variant keeps the figure — that render exists precisely to
 * be a figure, and swapping the figure for a logo would empty the choice.
 */
export const ActorNode = memo(function ActorNode({ data, selected, height }: ElementNodeProps) {
  const tokens = getNodeTokens(useTheme());
  const { element } = data;
  const description = shortDescription(element.description);
  const hasDescription = Boolean(description);

  // D11: the stickman render bypasses the box/radius entirely (branches BEFORE
  // shapeRadiusFor), so it never fights the actor's default pill/subtle radius.
  // Actor-only — no other kind reaches ActorNode. It ignores `hasDescription`.
  if (element.shapeVariant === 'figure') {
    const stroke = resolveAccent(element, tokens.actor.fg);
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
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.25,
          borderRadius: 2,
          color: tokens.actor.fg,
        }}
      >
        <Stickman color={stroke} />
        <Typography
          sx={{
            fontSize: 11.5,
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
        alignItems: hasDescription ? 'stretch' : 'center',
        justifyContent: 'center',
        gap: 0.25,
        px: 1.25,
        py: 0.5,
        backgroundColor: tokens.actor.bg,
        border: `1px solid ${resolveAccent(element, tokens.actor.border)}`,
        // Pill when it's just a name; a 2-line description reads better in a
        // rounded rect than stretched inside a stadium shape.
        borderRadius: shapeRadiusFor('actor', element.shapeVariant, hasDescription),
        color: tokens.actor.fg,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: hasDescription ? 'flex-start' : 'center',
          gap: 0.75,
          minWidth: 0,
        }}
      >
        <NodeIcon element={element} size={iconSlotSize(element)} fallback={<PersonGlyph />} />
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
        <NodeDescription kind="actor" text={description} height={height} />
      )}
    </NodeShell>
  );
});
