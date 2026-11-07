// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { memo } from 'react';
import { BoardTile } from './BoardTile';
import type { ElementNodeProps } from './nodeData';

/** A platform, a service or a tool (bottom band), with its vendor once the reader is close. */
export const ManagementToolNode = memo(function ManagementToolNode({ data, selected }: ElementNodeProps) {
  return <BoardTile data={data} selected={selected} shape="managementTool" about={data.element.vendor} />;
});
