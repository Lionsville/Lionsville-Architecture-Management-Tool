// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { memo } from 'react';
import { useStrings } from '../../i18n/LanguageContext';
import { BoardTile, TileType } from './BoardTile';
import type { ElementNodeProps } from './nodeData';

/**
 * A container on its application's diagram: what it is and what it is built with, then
 * what it does. A long technology keeps to one line, and its whole text is in the panel.
 */
export const ComponentNode = memo(function ComponentNode({ data, selected }: ElementNodeProps) {
  const { t } = useStrings();
  const technology = data.element.technology?.trim();
  const type = technology ? t('c4.containerOf', { technology }) : t('c4.container');
  return <BoardTile data={data} selected={selected} shape="component" sub={<TileType words={type} />} />;
});
