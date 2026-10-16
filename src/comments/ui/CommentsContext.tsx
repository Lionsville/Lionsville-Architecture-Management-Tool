// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What every thread under the shell reads and writes through (ADR-0037 §3):
 * the open scope's comments, the way a comment's step goes in, and what the
 * source says this person may do. Handed down once, by the workspace, so a
 * reader mounts `<CommentThread about />` and nothing else — the one line a
 * kind costs beside its line in `model/commentable.ts`.
 *
 * With no provider — a reader tested on its own, a page with no scope open —
 * a thread draws nothing.
 */
import { createContext, useContext, type ReactNode } from 'react'
import type { Command } from '../../model/commands'
import type { Comment } from '../../model/comment'

export type CommentsAccess = {
  /** The scope open, by its path (`''` the organisation): the one whose comments these are. */
  readonly scope: string
  /** The open scope's comments, as the session holds them. */
  readonly comments: readonly Comment[]
  /** A comment's step, through the session: whether the writer took it. */
  readonly dispatch: (command: Command) => boolean
  /** Whether this person may comment here: where the scope may be written, or where the source lets a reader comment. */
  readonly mayComment: boolean
  /** Whether this person may remove other people's comments here; their own they always may. */
  readonly mayModerate: boolean
  /** A fresh comment id. */
  readonly makeId: () => string
  /** Now, as an ISO date and time. */
  readonly now: () => string
}

const CommentsContext = createContext<CommentsAccess | undefined>(undefined)

export function CommentsProvider({ value, children }: { value: CommentsAccess | undefined; children: ReactNode }) {
  return <CommentsContext.Provider value={value}>{children}</CommentsContext.Provider>
}

/** The comments the shell provides, or nothing where it provides none. */
export function useComments(): CommentsAccess | undefined {
  return useContext(CommentsContext)
}
