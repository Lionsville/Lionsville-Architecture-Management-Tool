// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The history page, as the shell and the workspace draw it: a page nobody sees
 * until they ask for it, so its script arrives when they do
 * (`widgets/lazyPart`). One part for both, so opening it from a home and then
 * from a board fetches it once.
 */
import type { ComponentProps } from 'react'
import { lazyPart } from '../../widgets/lazyPart'
import type { HistoryPage as HistoryPageShape } from './HistoryPage'

export const HistoryPage = lazyPart<ComponentProps<typeof HistoryPageShape>>(
  () => import('./HistoryPage').then((held) => held.HistoryPage), { until: (props) => props.open },
)
