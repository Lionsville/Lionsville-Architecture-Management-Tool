// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { selectAllContent } from '../../useEditorState';
import { pasteOffsetFor } from '../../../model/clipboard';
import type { MenuActionFamily } from './types';

/** What a right-click on the empty board offers. */
export const PANE_ACTIONS = {
  'paste-here': ({ host, state }) => {
    const payload = host.clipboardRef?.current;
    if (payload) host.actions.pasteClipboard(payload, pasteOffsetFor(payload, state.flowPosition));
  },
  'add-here': ({ host, state, args }) => {
    if (args.kind) host.addElementAt(args.kind, state.flowPosition);
  },
  'add-domain-group-here': ({ host, state }) => {
    host.addDomainGroupAt?.(state.flowPosition);
  },
  'add-existing-here': ({ host, state }) => {
    host.addExistingAt?.(state.flowPosition);
  },
  'select-all': ({ host }) => {
    host.setSelection(selectAllContent(host.model, host.diagram));
  },
  tidy: ({ host }) => {
    host.tidy?.();
  },
  'route-connections': ({ host }) => {
    host.routeConnections?.();
  },
  'route-connections-all': ({ host }) => {
    host.routeConnectionsAll?.();
  },
  'fit-view': ({ host }) => {
    host.fitView();
  },
  'toggle-grid': ({ host }) => {
    host.toggleGrid();
  },
  'toggle-snap': ({ host }) => {
    host.toggleSnap();
  },
} satisfies MenuActionFamily;
