// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The words for what a badge says, one table for the two things that draw a
 * legend — the toolbar's popover and the export's key — and for the tooltip
 * on the badge itself. The order is the model's (`ASPECT_STATUSES`); the
 * keys are the editor's, because the model has no language.
 */
import type { StringKey } from '../i18n/strings';
import type { AspectStatus, Lifecycle } from '../model/types';

export const ASPECT_STATUS_LABEL: Record<AspectStatus, StringKey> = {
  managed: 'aspect.managed',
  partial: 'aspect.partial',
  atRisk: 'aspect.atRisk',
  none: 'aspect.none',
};

/** The lifecycle colours, in the order a legend lists them, each with its one-line meaning. */
export const LIFECYCLE_LEGEND: readonly { key: Lifecycle; labelKey: StringKey; noteKey: StringKey }[] = [
  { key: 'planned', labelKey: 'lifecycle.planned', noteKey: 'lifecycleNote.planned' },
  { key: 'live', labelKey: 'lifecycle.live', noteKey: 'lifecycleNote.live' },
  { key: 'retiring', labelKey: 'lifecycle.retiring', noteKey: 'lifecycleNote.retiring' },
  { key: 'retired', labelKey: 'lifecycle.retired', noteKey: 'lifecycleNote.retired' },
];
