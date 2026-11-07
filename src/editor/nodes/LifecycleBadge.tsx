// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { ReactNode } from 'react';
import { useStrings } from '../../i18n/LanguageContext';
import type { Translate } from '../../i18n';
import type { StringKey } from '../../i18n/strings';
import type { Lifecycle } from '../../model/types';

/**
 * Lifecycle is a word on the card (U5): *Retiring*, *Planned*, *Retired*, and nothing
 * for `live`, the normal state, since badging every card is noise. A colour would be
 * one more thing the board says at once, so the word is the channel and its ink quiet.
 */
export function lifecycleWord(lifecycle: Lifecycle, t: Translate): ReactNode {
  if (lifecycle === 'live') return undefined;
  const word = t(`lifecycle.${lifecycle}` as StringKey);
  return (
    <span className="lv-life" data-phase={lifecycle} role="img" aria-label={t('node.lifecycleAria', { name: word })}>
      {word}
    </span>
  );
}

/** The same word where something other than a tile is drawn, in its corner. */
export function LifecycleBadge({ lifecycle, show }: { lifecycle: Lifecycle; show: boolean }) {
  const { t } = useStrings();
  if (!show) return null;
  const word = lifecycleWord(lifecycle, t);
  return word ? <span className="lv-tile__corner">{word}</span> : null;
}
