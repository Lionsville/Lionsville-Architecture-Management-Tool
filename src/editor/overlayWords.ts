// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The words for an overlay and its bands, once, for the three places that
 * say them: the *Colour by* menu, the legend on the canvas and the button
 * that shows which overlay is up. The model names the overlay; the words are
 * the editor's, because the model has no language.
 */
import type { StringKey, Translate } from '../i18n/strings';
import type { AspectConfigEntry, AspectStatus } from '../model/types';
import { aspectColouredBy, oneColouredBy, type ColourBy, type OverlayBand } from '../model/overlay';
import { ASPECT_STATUS_LABEL, LIFECYCLE_LEGEND } from './aspectLegend';

/** The label of each overlay that names no element and no column. */
export const COLOUR_BY_LABEL: Record<Exclude<ColourBy, `one:${string}` | `aspect:${string}`>, StringKey> = {
  platform: 'overlay.platform',
  technologyLifecycle: 'overlay.technologyLifecycle',
  lifecycle: 'overlay.lifecycle',
  category: 'overlay.category',
  owner: 'overlay.owner',
  vendor: 'overlay.vendor',
  technology: 'overlay.technology',
};

/**
 * What an overlay is called: its label, an aspect column's long name, or the
 * name of the one thing asked about — which the legend's own band carries,
 * so the caller hands the bands over for it.
 */
export function overlayTitle(
  colourBy: ColourBy,
  aspectColumns: readonly AspectConfigEntry[],
  t: Translate,
  bands: readonly OverlayBand[] = [],
): string {
  const one = oneColouredBy(colourBy);
  if (one !== undefined) return bands.find((band) => band.key === one)?.name ?? t('overlay.one');
  const aspect = aspectColouredBy(colourBy);
  if (aspect !== undefined) return aspectColumns.find((column) => column.key === aspect)?.label ?? aspect;
  return t(COLOUR_BY_LABEL[colourBy as keyof typeof COLOUR_BY_LABEL]);
}

/** What a band is called in a legend: its name, its phase, its status, or one of the two nothings. */
export function overlayBandLabel(band: OverlayBand, t: Translate): string {
  if (band.name !== undefined) return band.name;
  if (band.phase) return t(LIFECYCLE_LEGEND.find((entry) => entry.key === band.phase)?.labelKey ?? 'lifecycle.live');
  if (band.status) return band.status === 'unset' ? t('overlay.unset') : t(ASPECT_STATUS_LABEL[band.status as AspectStatus]);
  if (band.faded) return t('overlay.notOnIt');
  if (band.key === 'unset') return t('overlay.unset');
  return t('overlay.onNothing');
}
