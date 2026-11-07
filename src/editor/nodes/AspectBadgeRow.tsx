// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import Tooltip from '@mui/material/Tooltip';
import { aspectShortCode } from '../../model/aspects';
import type { AspectConfigEntry, AspectStatus, DesignElement } from '../../model/types';
import { useStrings } from '../../i18n/LanguageContext';
import { Mark, type MarkKind } from '../../widgets/kit/Mark';
import { ASPECT_STATUS_LABEL } from '../aspectLegend';

/** One shape per status, so a dot reads without its colour and without its code. */
export const STATUS_MARK: Record<AspectStatus | 'unset', MarkKind> = {
  managed: 'managed',
  partial: 'partial',
  atRisk: 'risk',
  none: 'none',
  unset: 'unset',
};

/**
 * The status columns, in the board's order. A dot alone at a distance, and from the
 * middle distance the column's code on the status's soft ground; board.css says which.
 * The tooltip carries the long name, the status and the person's note.
 */
export function AspectBadgeRow({
  aspects,
  config,
}: {
  aspects: DesignElement['aspects'];
  config: readonly AspectConfigEntry[];
}) {
  const { t } = useStrings();
  return (
    <span className="lv-statuses">
      {config.map((entry) => {
        const aspect = aspects[entry.key];
        const kind = STATUS_MARK[aspect?.status ?? 'unset'];
        const tooltip = aspect
          ? `${entry.label}: ${t(ASPECT_STATUS_LABEL[aspect.status])}${aspect.note ? ` — ${aspect.note}` : ''}${aspect.derived ? ` (${t('aspect.derivedTip')})` : ''}`
          : `${entry.label}: ${t('aspect.notSet')}`;
        return (
          <Tooltip key={entry.key} title={tooltip}>
            <span className="lv-status" data-status={kind} role="img">
              <Mark kind={kind} />
              <span className="lv-status__code">{aspectShortCode(entry)}</span>
            </span>
          </Tooltip>
        );
      })}
    </span>
  );
}
