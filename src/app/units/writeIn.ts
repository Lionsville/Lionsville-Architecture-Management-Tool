// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A link made from one end and kept at the other (ADR-0036, amended 11
 * October 2026): a unit added to a scope's *Served by* is the unit's
 * `scopes`, kept where the unit is, and a capability picked for a unit's
 * *Responsible for* is an `assigned` row, kept where the capability is.
 *
 * **It is that scope's step, under that scope's rights.** A record is edited
 * where it lives (ADR-0012 §7), so the change is applied to the scope that
 * keeps it through the source's repositories, expecting what was read and
 * worked out again over a scope that moved in between
 * (`projects/scopeAccess.changeScope`) — never a step on a session open
 * elsewhere, whose undo stack it would otherwise join. Who serves a scope,
 * and who answers for a capability, is structure and not people, so it is the
 * scope's own right that decides it: a scope the person may only read is
 * refused here, and by the repository again, whatever they manage (§12).
 */
import { useCallback } from 'react'
import type { StringKey } from '../../i18n'
import type { ScopeCommand } from '../../projects/scopeState'
import { ShellError } from '../../platform/errors'
import type { ScopeSnapshot } from '../../projects/scope'
import { changeScope, changeScopes } from '../../projects/scopeAccess'
import type { ScopePath } from '../../projects/scopePath'
import type { BelowScopes } from '../useChangeBelow'

/** Where a change to another scope went: landed, or why not — a refusal by its key. */
export type WrittenIn = { ok: true } | { ok: false; reason: 'unchanged' | 'gone' | 'readOnly' | (string & {}) }

/** One change to the scope at `path`, worked out from what it holds: nothing, or no command, changes nothing. */
export type WriteIn = (path: ScopePath, change: (held: ScopeSnapshot) => readonly ScopeCommand[] | undefined) => Promise<WrittenIn>

/** Land `change` on the scope at `path` as that scope's one step, where the person may change it. */
export async function writeIn(
  deps: { scopes: BelowScopes; writable: (path: ScopePath) => boolean },
  path: ScopePath, change: Parameters<WriteIn>[1],
): Promise<WrittenIn> {
  if (!deps.writable(path)) return { ok: false, reason: 'shell.scopeReadOnly' }
  let made = false
  try {
    const after = await changeScope(deps.scopes, path, (held) => {
      const commands = change(held)
      made = (commands?.length ?? 0) > 0
      return commands
    })
    if (!after) return { ok: false, reason: 'gone' }
  } catch (error) {
    if (error instanceof ShellError) return { ok: false, reason: error.key }
    throw error
  }
  return made ? { ok: true } : { ok: false, reason: 'unchanged' }
}

/**
 * {@link writeIn} over several scopes as one apply, all or none (ADR-0036,
 * amended 17 October 2026): a unit linked to a scope is the unit's `scopes`
 * where the unit is kept and the scope's type in its own header, landed
 * together. Every scope named must be the person's to change, and each
 * change is worked out from what its scope holds; one scope named twice is
 * written once, with its commands in the order given.
 */
export async function writeInEach(
  deps: { scopes: BelowScopes; writable: (path: ScopePath) => boolean },
  changes: readonly { path: ScopePath; change: Parameters<WriteIn>[1] }[],
): Promise<WrittenIn> {
  const refused = changes.find(({ path }) => !deps.writable(path))
  if (refused) return { ok: false, reason: 'shell.scopeReadOnly' }
  let made = false
  try {
    const after = await changeScopes(deps.scopes, changes.map(({ path }) => path), (held) => {
      const commands = new Map<ScopePath, ScopeCommand[]>()
      for (const { path, change } of changes) {
        const scope = held.get(path)
        const list = scope ? change(scope) : undefined
        if (list?.length) commands.set(path, [...(commands.get(path) ?? []), ...list])
      }
      made = commands.size > 0
      return commands
    })
    if (!after) return { ok: false, reason: 'gone' }
  } catch (error) {
    if (error instanceof ShellError) return { ok: false, reason: error.key }
    throw error
  }
  return made ? { ok: true } : { ok: false, reason: 'unchanged' }
}

/**
 * {@link writeIn} over the source's repositories, asked whether anything may
 * be written first — a hook that writes another scope asks `mayChange()`
 * before it does — and the tree told afterwards, so the index reads what
 * landed.
 */
export function useWriteIn(deps: {
  scopes: BelowScopes
  writable: (path: ScopePath) => boolean
  mayChange?: () => boolean
  onTreeChanged?: () => void
}): WriteIn {
  const { scopes, writable, mayChange, onTreeChanged } = deps
  return useCallback(async (path, change) => {
    if (mayChange && !mayChange()) return { ok: false, reason: 'readOnly' }
    const written = await writeIn({ scopes, writable }, path, change)
    if (written.ok) onTreeChanged?.()
    return written
  }, [scopes, writable, mayChange, onTreeChanged])
}

/** What a person is told where a change to another scope did not land: nothing where there was nothing to change. */
export function refusalKey(written: WrittenIn): StringKey | undefined {
  if (written.ok || written.reason === 'unchanged') return undefined
  if (written.reason === 'gone') return 'shell.scopeGone'
  if (written.reason === 'readOnly') return 'shell.scopeReadOnly'
  return written.reason.startsWith('shell.') || written.reason.startsWith('command.') ? written.reason as StringKey : 'pick.notWritten'
}
