import { memo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { resolveAccent, shapeRadiusFor } from '../theme/elementStyle';
import { getNodeTokens } from '../theme/tokens';
import { useStrings } from '../../i18n/LanguageContext';
import { GlobeGlyph } from './glyphs';
import { iconSlotSize, NodeDescription, NodeIcon, NodeShell } from './NodeShell';
import type { ElementNodeProps } from './nodeData';

/** External system: muted C4-style box — outside our operational scope. */
export const ExternalSystemNode = memo(function ExternalSystemNode({
  data,
  selected,
  height,
}: ElementNodeProps) {
  const { t } = useStrings();
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
        flexDirection: 'column',
        px: 1,
        py: 0.75,
        backgroundColor: tokens.externalSystem.bg,
        border: `1px solid ${resolveAccent(element, tokens.externalSystem.border)}`,
        borderRadius: shapeRadiusFor('externalSystem', element.shapeVariant, false),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: tokens.card.subtitle }}>
        {/* A resolved mark takes the globe's slot; an unknown/absent key falls
            back to the globe. `iconSize: 'large'` just grows it in place — this
            strip IS the body's leading row. */}
        <NodeIcon
          element={element}
          size={iconSlotSize(element, 13)}
          fallback={<GlobeGlyph />}
        />
        <Typography sx={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.8 }}>{t('node.external')}</Typography>
        <Box sx={{ flex: 1 }} />
        {element.vendor && (
          <Typography sx={{ fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 70 }}>
            {element.vendor}
          </Typography>
        )}
      </Box>
      <Typography
        sx={{
          fontSize: 12,
          fontWeight: 700,
          color: tokens.externalSystem.fg,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {element.name}
      </Typography>
      <NodeDescription kind="externalSystem" text={element.description} height={height} />
    </NodeShell>
  );
});
