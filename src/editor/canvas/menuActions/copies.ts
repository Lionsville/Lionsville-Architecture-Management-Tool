// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { namedAsCopies, type ClipboardPayload } from '../../../model/clipboard';
import type { MenuActionHost } from './types';

/** What a paste or a duplicate from a menu adds, said to be a copy where its name is taken. */
export function asCopies(host: Pick<MenuActionHost, 'model' | 'translate'>, payload: ClipboardPayload): ClipboardPayload {
  const { translate } = host;
  return translate ? namedAsCopies(payload, host.model, (name) => translate('menu.copyName', { name })) : payload;
}
