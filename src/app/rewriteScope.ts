// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Read a scope, change it, write it back — expecting what was read.
 *
 * Every whole write of a scope outside the open session has this shape: the
 * organisation screen's dialogs, the gestures writing the other scope, a move
 * carrying the references that point into it. Written blind, the save
 * overwrites whatever somebody else saved between the read and the write, and
 * nobody is told. Written expecting the revision it read (`ScopeStore.save`),
 * the store refuses instead — and because every one of these changes is a
 * function of the scope as it stands, the answer to that refusal is to read it
 * again and make the change again, over their work rather than instead of it.
 *
 * A few times and no more: a scope that moves under every attempt is a scope
 * somebody is busy in, and the refusal then goes to the caller to say so.
 */
import { isScopeMoved } from '../projects/revision'
import type { ScopeSnapshot } from '../projects/scope'
import type { ScopePath } from '../projects/scopePath'

/** As much of a store as a rewrite needs. */
export type RewriteStore = {
  load(path: ScopePath): Promise<ScopeSnapshot | undefined>
  save(scope: ScopeSnapshot, expects?: string): Promise<void>
}

/** How many times a change is made again over a scope that moved before the store says so. */
export const REWRITE_TRIES = 3

/**
 * `change` is handed the scope as it stands — `undefined` where there is none —
 * and answers what to write, or `undefined` for *nothing to write*. It may be
 * called more than once, so it must not do anything but answer.
 *
 * Answers what was written, or `undefined` where `change` wrote nothing.
 */
export async function rewriteScope(
  scopes: RewriteStore,
  path: ScopePath,
  change: (held: ScopeSnapshot | undefined) => ScopeSnapshot | undefined,
): Promise<ScopeSnapshot | undefined> {
  for (let tried = 1; ; tried += 1) {
    const held = await scopes.load(path)
    const next = change(held)
    if (!next) return undefined
    try {
      await scopes.save(next, held?.revision)
      return next
    } catch (cause) {
      if (!isScopeMoved(cause) || tried >= REWRITE_TRIES) throw cause
    }
  }
}
