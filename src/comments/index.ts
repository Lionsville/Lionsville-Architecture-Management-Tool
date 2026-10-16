// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Comments on any record (ADR-0037): the pure rules of a thread and of what
 * travels with a record, and the one thread every reader mounts. A module
 * that computes names the file it wants, not this.
 */
export * from './thread'
export * from './travel'
export { CommentThread } from './ui/threadPart'
export { CommentBadge } from './ui/CommentBadge'
export type { CommentThreadProps } from './ui/CommentThread'
export { CommentsProvider, useComments } from './ui/CommentsContext'
export type { CommentsAccess } from './ui/CommentsContext'
