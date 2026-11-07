// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { memo } from 'react';
import { useStrings } from '../../i18n/LanguageContext';
import { BoardTile } from './BoardTile';
import type { ElementNodeProps } from './nodeData';

/** Outside our operational scope: the dashed edge says so, and near it says where it is defined. */
export const ExternalSystemNode = memo(function ExternalSystemNode({ data, selected }: ElementNodeProps) {
  const { t } = useStrings();
  return (
    <BoardTile
      data={data}
      selected={selected}
      shape="externalSystem"
      outside
      about={data.note ? data.element.vendor : [t('node.external'), data.element.vendor].filter(Boolean).join(' · ')}
    />
  );
});
