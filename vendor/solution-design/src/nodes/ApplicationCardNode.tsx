import { memo } from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { categoryColor } from '../theme/categoryColors';
import { resolveAccent, shapeRadiusFor } from '../theme/elementStyle';
import { getNodeTokens } from '../theme/tokens';
import { formatMonthlyPrice } from '../theme/format';
import { useStrings } from '../i18n/LanguageContext';
import { DocGlyph, DrillGlyph, LinkGlyph, WarningGlyph } from './glyphs';
import { NodeDescription, NodeIcon, NodeShell, usesBodyIcon } from './NodeShell';
import { AspectBadgeRow } from './AspectBadgeRow';
import type { ElementNodeProps } from './nodeData';
import { hasDocumentation, shortDescription } from '../model/documentation';

/**
 * Application card (default 200×130, PVH/Akzo board style): category strip on
 * top, name bar with vendor chip, two-line description, derived-figures chip
 * row, aspect badge row, and a meta row with price/link/drift decorations.
 * Resizable when selected (persists on the placement).
 *
 * The card is the one kind whose header is a title BAR rather than the body's
 * first row, so it is also the one kind where `iconSize: 'large'` MOVES the
 * mark: small draws it before the title as before, large puts a 28 px mark
 * beside the description instead of growing the bar to fit it.
 */
export const ApplicationCardNode = memo(function ApplicationCardNode({
  data,
  selected,
  height,
}: ElementNodeProps) {
  const theme = useTheme();
  const { t, language } = useStrings();
  const tokens = getNodeTokens(theme);
  const { element, decoration } = data;
  const warning = decoration?.unlinkedWarning;
  const incomplete = decoration?.incompleteWarning;
  const summary = decoration?.parameterSummary ?? [];
  const bodyIcon = usesBodyIcon(element);

  return (
    <NodeShell
      element={element}
      selected={selected}
      readOnly={data.readOnly}
      showLifecycle={data.showLifecycle}
      resizeLimits={data.resizeLimits}
      restingShadow={theme.shadows[1]}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: tokens.card.bg,
        border: `1px ${warning ? 'dashed' : 'solid'} ${warning ? tokens.card.warningBorder : tokens.card.border}`,
        borderRadius: shapeRadiusFor('application', element.shapeVariant, false),
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          height: 7,
          flexShrink: 0,
          backgroundColor: resolveAccent(element, categoryColor(element.category, tokens.mode)),
        }}
      />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 0.75,
          py: 0.4,
          backgroundColor: tokens.card.headerBg,
        }}
      >
        {!bodyIcon && <NodeIcon element={element} size={14} color={tokens.card.subtitle} />}
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 700,
            color: tokens.card.title,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {element.name}
        </Typography>
        {incomplete && (
          <Tooltip title={incomplete}>
            <Box sx={{ color: theme.palette.warning.main, display: 'flex' }}>
              <WarningGlyph />
            </Box>
          </Tooltip>
        )}
        {data.hasContainerDiagram && (
          <Tooltip title={t('node.hasContainer')}>
            <Box sx={{ color: tokens.card.subtitle, display: 'flex' }}>
              <DrillGlyph />
            </Box>
          </Tooltip>
        )}
        {hasDocumentation(element.description) && (
          <Tooltip title={t('node.hasDocumentation')}>
            <Box sx={{ color: tokens.card.subtitle, display: 'flex' }} data-testid="doc-glyph">
              <DocGlyph />
            </Box>
          </Tooltip>
        )}
        {element.vendor && (
          <Typography
            sx={{
              fontSize: 9,
              fontWeight: 600,
              color: tokens.card.subtitle,
              border: `1px solid ${tokens.card.border}`,
              borderRadius: 1,
              px: 0.5,
              lineHeight: '14px',
              maxWidth: 64,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {element.vendor}
          </Typography>
        )}
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          gap: bodyIcon ? 0.75 : 0,
          px: 0.75,
          pt: 0.25,
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {bodyIcon && <NodeIcon element={element} size={28} color={tokens.card.subtitle} />}
        <NodeDescription
          kind="application"
          text={shortDescription(element.description)}
          height={height}
          sx={{ flex: 1 }}
        />
      </Box>
      {summary.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.75, pb: 0.25, flexWrap: 'nowrap', overflow: 'hidden' }}>
          {summary.map((chip) => (
            <Tooltip key={chip.label} title={chip.title ?? ''}>
              <Typography
                sx={{
                  fontSize: 8.5,
                  fontWeight: 600,
                  color: tokens.card.subtitle,
                  border: `1px solid ${tokens.card.border}`,
                  borderRadius: 1,
                  px: 0.5,
                  lineHeight: '13px',
                  whiteSpace: 'nowrap',
                }}
              >
                {chip.label} {chip.value}
              </Typography>
            </Tooltip>
          ))}
        </Box>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.75, pb: 0.25, minHeight: 16 }}>
        {decoration?.monthlyPrice !== undefined && (
          <Typography
            sx={{
              fontSize: 9,
              fontWeight: 700,
              color: tokens.chips.priceFg,
              backgroundColor: tokens.chips.priceBg,
              borderRadius: 1,
              px: 0.5,
              lineHeight: '14px',
            }}
          >
            {formatMonthlyPrice(decoration.monthlyPrice, language)}
          </Typography>
        )}
        {decoration?.drift && (
          <Typography sx={{ fontSize: 8.5, fontWeight: 700, color: tokens.chips.driftFg, backgroundColor: tokens.chips.driftBg, borderRadius: 1, px: 0.5, lineHeight: '14px' }}>
            DRIFT
          </Typography>
        )}
        {decoration?.dangling && (
          <Typography sx={{ fontSize: 8.5, fontWeight: 700, color: tokens.chips.danglingFg, backgroundColor: tokens.chips.danglingBg, borderRadius: 1, px: 0.5, lineHeight: '14px' }}>
            DANGLING
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        {(decoration?.linkCount ?? 0) > 0 && (
          <Tooltip title={`${decoration?.linkCount} commercial line link(s)`}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: tokens.card.subtitle, fontSize: 9, fontWeight: 600 }}>
              <LinkGlyph />
              {decoration?.linkCount}
            </Box>
          </Tooltip>
        )}
      </Box>
      <AspectBadgeRow aspects={element.aspects} config={data.aspectConfig} />
    </NodeShell>
  );
});
