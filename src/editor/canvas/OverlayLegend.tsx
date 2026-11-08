// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useContext, useState } from 'react';
import { Panel } from '@xyflow/react';
import { useTheme } from '@mui/material/styles';
import type { AspectConfigEntry, DesignDiagram } from '../../model/types';
import { badgeLegend } from '../../model/aspects';
import type { ColourBy, OverlayBand } from '../../model/overlay';
import { useStrings } from '../../i18n/LanguageContext';
import { KeyStrip, OTHER_VALUE, type KeyValue } from '../../widgets/kit/KeyStrip';
import { Mark } from '../../widgets/kit/Mark';
import { ASPECT_STATUS_LABEL } from '../aspectLegend';
import { overlayBandLabel, overlayTitle } from '../overlayWords';
import { overlayIndex, overlayInk } from '../theme/overlayColors';
import { STATUS_MARK } from '../nodes/AspectBadgeRow';
import { BoardFocusContext } from './boardFocus';

export interface OverlayLegendProps {
  colourBy: ColourBy;
  bands: readonly OverlayBand[];
  /** The board's aspect columns, so an aspect overlay can be named by its column. */
  aspectColumns: readonly AspectConfigEntry[];
  /** Takes the overlay off. */
  onClose(): void;
  /** Keeps this reader's lens with the view. Absent: nothing to keep, or nobody here may. */
  onKeep?(): void;
}

/**
 * The key to the one lens that is up, on the canvas and away from the cards: what it
 * is by, each band with the number its cards carry and how many, *Keep with the view*
 * and the way to take it down. Pressing a band keeps its cards and lets the rest recede.
 */
export function OverlayLegend({ colourBy, bands, aspectColumns, onClose, onKeep }: OverlayLegendProps) {
  const { t } = useStrings();
  const theme = useTheme();
  const focus = useContext(BoardFocusContext);
  const [pressed, setPressed] = useState<string | undefined>(undefined);
  const values: KeyValue[] = bands.map((band) => {
    const ink = overlayInk(theme, band);
    return {
      id: band.key,
      label: overlayBandLabel(band, t),
      count: band.memberIds.length,
      shown: band.faded
        ? undefined
        : <span className="lv-lens-tag" style={{ '--lv-lens-ink': ink, '--lv-lens-on': theme.palette.getContrastText(ink) } as React.CSSProperties}>{overlayIndex(band)}</span>,
    };
  });
  const press = (id: string | undefined) => {
    setPressed(id);
    const band = bands.find((one) => one.key === id);
    focus.set(band ? { nodes: new Set(band.memberIds), lines: new Set() } : null);
  };
  return (
    <Panel position="bottom-right" data-canvas-float="">
      <KeyStrip
        foldable
        data-testid="overlay-legend"
        title={t('overlay.legendTitle', { what: overlayTitle(colourBy, aspectColumns, t, bands) })}
        values={values}
        {...(pressed ? { pressed } : {})}
        onPress={(id) => { if (id !== OTHER_VALUE) press(id); }}
        {...(bands.length === 0 ? { note: t('overlay.noCards') } : {})}
        {...(onKeep ? { onKeep } : {})}
        onClose={{ label: t('overlay.off'), press: onClose }}
      />
    </Panel>
  );
}

/**
 * What the dots mean on this board, on the canvas where they are read: one mark per
 * status, and the columns left to right. Show takes it down; an export prints its own.
 */
export function BoardKey({ diagram }: { diagram: DesignDiagram }) {
  const { t } = useStrings();
  const legend = badgeLegend(diagram);
  if (legend.columns.length === 0) return null;
  return (
    <Panel position="bottom-right" data-canvas-float="">
      <KeyStrip
        foldable
        data-testid="board-key"
        values={[...legend.statuses, 'unset' as const].map((status) => ({
          id: status,
          label: status === 'unset' ? t('overlay.unset') : t(ASPECT_STATUS_LABEL[status]),
          shown: <Mark kind={STATUS_MARK[status]} />,
        }))}
        note={t('board.keyColumns', { columns: legend.columns.map((column) => column.label).join(', ') })}
      />
    </Panel>
  );
}
