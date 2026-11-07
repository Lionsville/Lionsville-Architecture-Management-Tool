// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { memo } from 'react';
import { BoardTile } from './BoardTile';
import type { ElementNodeProps } from './nodeData';

/** How work and data enter the landscape (left band). */
export const InputChannelNode = memo(function InputChannelNode({ data, selected }: ElementNodeProps) {
  return <BoardTile data={data} selected={selected} shape="inputChannel" />;
});
