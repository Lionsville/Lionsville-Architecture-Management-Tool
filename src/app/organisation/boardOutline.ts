// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The boards of a scope in the order its home lists them: each container
 * diagram under the landscape its application is on.
 *
 * A landscape with twenty applications can have twenty container diagrams,
 * and as rows of their own beside it they bury the handful of boards a person
 * came to choose between. Under the landscape they belong to they read as what
 * they are — a closer look at one box on it.
 *
 * "Belong to" is the model's own relation, not a new one: a container diagram
 * is about one application (`applicationElementId`), and a landscape has that
 * application on it when the application is among its `members`. The editor's
 * tab asks the same question to list a landscape's container diagrams. An
 * application on two landscapes puts its diagram under the first in model
 * order, because a row listed twice is a row deleted from one place and still
 * shown in another; one on none, or a diagram that names no application, is
 * listed at the end rather than dropped.
 */
import type { DesignDiagram } from '../../model'

/** A board that is not a container diagram, and the container diagrams under it. */
export interface BoardEntry {
  board: DesignDiagram
  /** Empty for everything but a landscape, and for a landscape with none. */
  containers: DesignDiagram[]
}

export interface BoardOutline {
  /** Every board but the container diagrams, in model order. */
  entries: BoardEntry[]
  /** Container diagrams whose application is on no landscape of this scope, in model order. */
  loose: DesignDiagram[]
}

export function outlineBoards(boards: readonly DesignDiagram[]): BoardOutline {
  const entries: BoardEntry[] = boards
    .filter((board) => board.kind !== 'container')
    .map((board) => ({ board, containers: [] }))
  const landscapes = entries.filter((entry) => entry.board.kind === 'layer7')
  const loose: DesignDiagram[] = []
  for (const board of boards) {
    if (board.kind !== 'container') continue
    const application = board.applicationElementId
    const home = application === undefined
      ? undefined
      : landscapes.find((entry) => entry.board.members.some((member) => member.id === application))
    if (home) home.containers.push(board)
    else loose.push(board)
  }
  return { entries, loose }
}
