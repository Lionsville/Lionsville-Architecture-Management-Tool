// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The thread every reader mounts, as the readers take it: a part of its own
 * (`widgets/lazyPart`), so its composer, its buttons and the picker it asks
 * *This is me* with arrive with the first reader drawn rather than in the
 * first download. The thread stands at the end of a reader and nothing is
 * pressed into it before it is drawn, so a moment's wait costs nothing; a
 * suite has it before its first render (`preloadLazyParts`).
 */
import type { ComponentProps } from 'react'
import { lazyPart } from '../../widgets/lazyPart'
import type { CommentThread as CommentThreadShape } from './CommentThread'

export const CommentThread = lazyPart<ComponentProps<typeof CommentThreadShape>>(
  () => import('./CommentThread').then((held) => held.CommentThread),
)
