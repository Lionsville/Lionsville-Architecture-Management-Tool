// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { memo } from 'react';
import { BoardTile } from './BoardTile';
import type { ElementNodeProps } from './nodeData';

/** A container on its application's diagram: what it is built with, then what it does. */
export const ComponentNode = memo(function ComponentNode({ data, selected }: ElementNodeProps) {
  return <BoardTile data={data} selected={selected} shape="component" sub={`[${data.element.technology?.trim() || 'Container'}]`} />;
});
