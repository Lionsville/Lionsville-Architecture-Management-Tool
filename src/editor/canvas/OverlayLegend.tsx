// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { Panel } from '@xyflow/react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import type { AspectConfigEntry } from '../../model/types';
import type { ColourBy, OverlayBand } from '../../model/overlay';
import { useStrings } from '../../i18n/LanguageContext';
import { CloseIcon } from '../../widgets/icons';
import { overlayBandLabel, overlayTitle } from '../overlayWords';
import { overlayIndex, overlayInk, overlayTint } from '../theme/overlayColors';

export interface OverlayLegendProps {
  colourBy: ColourBy;
  bands: readonly OverlayBand[];
  /** The board's aspect columns, so an aspect overlay can be named by its column. */
  aspectColumns: readonly AspectConfigEntry[];
  /** Takes the overlay off. */
  onClose(): void;
}

/**
 * The overlay's key, on the canvas while an overlay is up (3.7.0). The
 * legend used to live only under the *Colour by* button, in a popover that
 * closed on the first click outside it — so the one moment a person wanted
 * to read what a colour meant, while looking at the board, it was gone. This
 * stays in the corner: what the board is coloured by, then each band with its
 * number, its swatch, its name and how many cards it holds. The number is
 * what the card's tag says, so a band is found by reading, not by matching a
 * hue. Closing it turns the overlay off; a reader may, as a reader may choose
 * one (`useBoardView`).
 */
export function OverlayLegend({ colourBy, bands, aspectColumns, onClose }: OverlayLegendProps) {
  const { t } = useStrings();
  const theme = useTheme();
  return (
    <Panel position="bottom-right" style={{ marginBottom: 28 }}>
      <Paper
        elevation={2}
        data-testid="overlay-legend"
        role="group"
        aria-label={t('overlay.legend', { what: overlayTitle(colourBy, aspectColumns, t) })}
        sx={{ px: 1.25, py: 0.75, borderRadius: 2, maxWidth: 260, maxHeight: 280, overflow: 'auto' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t('overlay.legendTitle', { what: overlayTitle(colourBy, aspectColumns, t) })}
          </Typography>
          <Tooltip title={t('overlay.off')}>
            <IconButton size="small" aria-label={t('overlay.off')} onClick={onClose} sx={{ p: 0.25, mr: -0.5 }}>
              <CloseIcon size={14} />
            </IconButton>
          </Tooltip>
        </Box>
        {bands.length === 0 && (
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('overlay.noCards')}</Typography>
        )}
        {bands.map((band) => {
          const ink = overlayInk(theme, band);
          return (
            <Box key={band.key} data-testid={`overlay-legend-${band.key}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.2 }}>
              {band.faded ? (
                <Box aria-hidden sx={{ width: 16, height: 15, borderRadius: '3px', flexShrink: 0, border: `1px dashed ${theme.palette.divider}` }} />
              ) : (
                <Box
                  aria-hidden
                  sx={{
                    minWidth: 16, height: 15, px: 0.4, borderRadius: '3px', flexShrink: 0,
                    fontSize: 9.5, fontWeight: 800, lineHeight: '15px', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
                    backgroundColor: ink, color: theme.palette.getContrastText(ink),
                  }}
                >
                  {overlayIndex(band)}
                </Box>
              )}
              <Box aria-hidden sx={{ width: 14, height: 14, borderRadius: '3px', flexShrink: 0, backgroundColor: overlayTint(theme, band), border: `1px solid ${theme.palette.divider}`, boxShadow: band.faded ? 'none' : `inset 3px 0 0 ${ink}` }} />
              <Typography sx={{ fontSize: 11, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: band.faded ? 'text.secondary' : 'text.primary' }}>
                {overlayBandLabel(band, t)}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                {band.memberIds.length}
              </Typography>
            </Box>
          );
        })}
      </Paper>
    </Panel>
  );
}
