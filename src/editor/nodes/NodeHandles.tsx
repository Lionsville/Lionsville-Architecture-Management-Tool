// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { Fragment } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useStrings } from '../../i18n/LanguageContext';

/**
 * Connection points. One shows, on the card under the pointer: the nub at its right,
 * a drawn dot at a fixed size whatever the zoom, with a target of the size a hand
 * needs. Where a line lands is where it is released, so the four sides answer while a
 * line is in hand, and Alt brings them all up for a person choosing the side it leaves.
 *
 * Four sides, each a source and a target, and EVERY handle has a unique id (POC
 * lesson): React Flow resolves an edge's missing handle to the first of its type in
 * DOM order, not a per-side default, so an id-less handle pulls links to one side.
 * The source renders last, on top, so a drag always starts a source-to-target link.
 */
const SIDES = [
  { pos: Position.Top, source: 'top-s', target: 'top-t' },
  { pos: Position.Right, source: 'right-s', target: 'right-t' },
  { pos: Position.Bottom, source: 'bottom-s', target: 'bottom-t' },
  { pos: Position.Left, source: 'left-s', target: 'left-t' },
] as const;

export function NodeHandles({ connectable }: { connectable: boolean }) {
  const { t } = useStrings();
  const hint = connectable ? t('node.dragToConnect') : undefined;
  return (
    <>
      {SIDES.map(({ pos, source, target }) => (
        <Fragment key={pos}>
          <Handle type="target" position={pos} id={target} className="lv-side" isConnectable={connectable} />
          <Handle
            type="source"
            position={pos}
            id={source}
            className={pos === Position.Right ? 'lv-nub' : 'lv-side'}
            isConnectable={connectable}
            title={hint}
          />
        </Fragment>
      ))}
    </>
  );
}
