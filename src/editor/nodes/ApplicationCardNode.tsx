// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { memo } from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { categoryColor } from '../theme/categoryColors';
import { resolveAccent, shapeRadiusFor } from '../theme/elementStyle';
import { getNodeTokens } from '../theme/tokens';
import { useStrings } from '../../i18n/LanguageContext';
import { BlockGlyph, DocGlyph, DrillGlyph } from './glyphs';
import { NodeDescription, NodeIcon, NodeShell, usesBodyIcon } from './NodeShell';
import { AspectBadgeRow } from './AspectBadgeRow';
import type { ElementNodeProps } from './nodeData';
import type { OverlayMark } from '../theme/overlayColors';
import { shownDescription } from './nodeData';
import { hasDocumentation, shortDescription } from '../../documentation/documentation';

/**
 * Application card (default 200×130, the enterprise board style it is
 * modelled on): category strip on top, name bar with vendor chip, two-line
 * description, derived-figures chip row, aspect badge row, and a meta row
 * with price/link/drift decorations.
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
  const { t } = useStrings();
  const tokens = getNodeTokens(theme);
  const { element } = data;
  const bodyIcon = usesBodyIcon(element);

  return (
    <NodeShell
      element={element}
      selected={selected}
      readOnly={data.readOnly}
      showLifecycle={data.showLifecycle}
      phase={data.phase}
      resizeLimits={data.resizeLimits}
      restingShadow={theme.shadows[1]}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: tokens.card.bg,
        // The overlay's wash, laid OVER the card's own ground (ADR-0013): a
        // colour that says which group the card is in, never one that replaces
        // what the card says. A flat gradient rather than `color-mix`, which
        // this build's browser target does not have. Beside the wash, a bar
        // down the card's left edge in the band's full ink and the number tag
        // in the header: the wash alone was a tint nobody could see at the
        // zoom a landscape fits at, and two hues apart are not apart to every
        // eye — the number is.
        ...(data.overlay
          ? {
            backgroundImage: `linear-gradient(${data.overlay.tint}, ${data.overlay.tint})`,
            // A pseudo-element and not an inset shadow: the shell's
            // `boxShadow` is the selection ring, and a card in a band is
            // selected like any other.
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 5,
              backgroundColor: data.overlay.ink,
              pointerEvents: 'none',
            },
          }
          : {}),
        // The reverse question's answer for this card is no (ADR-0020): it
        // fades and loses its colour, so the ones that do stand on the thing
        // are what is left.
        ...(data.overlayFaded ? { opacity: 0.3, filter: 'grayscale(1)' } : {}),
        border: `1px solid ${tokens.card.border}`,
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
        {/* A building block is drawn as a card, marked as one (ADR-0043 §1). */}
        {!bodyIcon && <NodeIcon element={element} size={14} color={tokens.card.subtitle} {...(element.kind === 'buildingBlock' ? { fallback: <BlockGlyph /> } : {})} />}
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
        {data.hasContainerDiagram && (
          <Tooltip title={t('node.hasContainer')}>
            <Box role="img" sx={{ color: tokens.card.subtitle, display: 'flex' }}>
              <DrillGlyph />
            </Box>
          </Tooltip>
        )}
        {hasDocumentation(shownDescription(data)) && (
          <Tooltip title={t('node.hasDocumentation')}>
            <Box role="img" sx={{ color: tokens.card.subtitle, display: 'flex' }} data-testid="doc-glyph">
              <DocGlyph />
            </Box>
          </Tooltip>
        )}
        {data.overlay && <OverlayTag mark={data.overlay} />}
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
        <NodeDescription figure="application"
          text={shortDescription(shownDescription(data))}
          height={height}
          sx={{ flex: 1 }}
        />
      </Box>
      <AspectBadgeRow aspects={element.aspects} config={data.aspectConfig} />
    </NodeShell>
  );
});

/**
 * The band's number in the card's header, in the band's ink: what the legend
 * says beside the same number, so a band is found by reading.
 */
function OverlayTag({ mark }: { mark: OverlayMark }) {
  const theme = useTheme();
  const { t } = useStrings();
  return (
    <Box
      data-testid="overlay-tag"
      aria-label={t('node.overlayBand', { index: String(mark.index) })}
      sx={{
        flexShrink: 0,
        minWidth: 16,
        height: 15,
        px: 0.4,
        borderRadius: '3px',
        fontSize: 9.5,
        fontWeight: 800,
        lineHeight: '15px',
        textAlign: 'center',
        fontVariantNumeric: 'tabular-nums',
        backgroundColor: mark.ink,
        color: theme.palette.getContrastText(mark.ink),
      }}
    >
      {mark.index}
    </Box>
  );
}
