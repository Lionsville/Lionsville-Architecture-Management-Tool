// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { memo } from 'react';
import { BoardTile } from './BoardTile';
import type { ElementNodeProps } from './nodeData';

/**
 * An application, or a building block drawn as one (ADR-0043 §1): the one kind that
 * carries the board's status columns, and the vendor once the reader is close.
 */
export const ApplicationCardNode = memo(function ApplicationCardNode({ data, selected }: ElementNodeProps) {
  return <BoardTile data={data} selected={selected} shape="application" statuses about={data.element.vendor} />;
});
