// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The thread every reader mounts, as the readers take it: a part of its own
 * (`widgets/lazyPart`), so its composer, its buttons and the picker it asks
 * *This is me* with arrive with the first reader drawn rather than in the
 * first download. The thread stands at the end of a reader and nothing is
 * pressed into it before it is drawn, so a moment's wait costs nothing; a
 * suite has it before its first render (`preloadLazyParts`).
 *
 * A reader opened offline before its thread's script arrived says, in one
 * line where the thread would be, that its comments could not be loaded, with
 * *Try again*; the reader above it is read and worked as ever.
 */
import type { ComponentProps } from 'react'
import { lazyPart, PartNotLoaded } from '../../widgets/lazyPart'
import type { CommentThread as CommentThreadShape } from './CommentThread'

/** Where the thread's script would not load: the line that stands in its place. */
export function threadNotLoaded(_props: unknown, retry: () => void) {
  return <PartNotLoaded message="comments.notLoaded" onRetry={retry} />
}

export const CommentThread = lazyPart<ComponentProps<typeof CommentThreadShape>>(
  () => import('./CommentThread').then((held) => held.CommentThread),
  { failed: threadNotLoaded },
)
