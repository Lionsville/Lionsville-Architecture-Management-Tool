// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's *Served by*, wired (ADR-0036, amended 11 October 2026): what it
 * says, off the index the shell holds (`servedByView.ts`), and its two edits —
 * a unit added, a unit taken off — each one `unit.scopes` written as a step
 * in the scope that keeps the unit, under that scope's rights
 * (`units/writeIn.ts`). Nothing is open on a home, so there is no session to
 * go through; the tree is read again once a step lands, and the index with it.
 *
 * A unit that said nothing served the scope it is filed in, and goes on
 * serving it beside the one added (`model/serving.scopesWith`) — unless that
 * is the organisation, which is no domain: then it serves the one added alone.
 */
import { useCallback, useMemo } from 'react'
import type { Translate } from '../../i18n'
import type { ElementId } from '../../model'
import { scopesWith, scopesWithout } from '../../model/serving'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import type { BelowScopes } from '../useChangeBelow'
import type { Failed } from '../useShellServices'
import { refusalKey, writeIn } from '../units/writeIn'
import { servedByOf } from './servedByView'
import type { ServedByView } from './servedByView'

export type ServedByAccess = {
  /** What *Served by* says about a scope today; nothing where the organisation has no units to say it with. */
  of: (scope: ScopePath) => ServedByView | undefined
  /** May the person change what a unit serves: the scope that keeps it is theirs to write. */
  mayChange: (unitId: ElementId) => boolean
  add: (scope: ScopePath, unitId: ElementId) => void
  remove: (scope: ScopePath, unitId: ElementId) => void
  /** The unit where it is kept, chosen: its inspector says what it serves from that end. */
  open: (unitId: ElementId) => void
}

export function useServedBy(deps: {
  index: ScopeIndex
  scopes: BelowScopes
  writable: (path: ScopePath) => boolean
  onTreeChanged: () => void
  notify: (message: string, severity: 'success' | 'error' | 'warning') => void
  failed: Failed
  onOpen: (path: ScopePath, unitId: ElementId) => void
  today: string
  scopeName: (path: ScopePath) => string
  s: Translate
}): ServedByAccess {
  const { index, scopes, writable, onTreeChanged, notify, failed, onOpen, today, scopeName, s } = deps
  const keptAt = useMemo(() => new Map(index.units().map(({ scope, unit }) => [unit.id, { scope, name: unit.name }])), [index])
  const of = useMemo(() => {
    const read = new Map<ScopePath, ServedByView | undefined>()
    return (scope: ScopePath) => {
      if (!read.has(scope)) read.set(scope, servedByOf(index, scope, today, { scopeName, s }))
      return read.get(scope)
    }
  }, [index, today, scopeName, s])
  const change = useCallback((scope: ScopePath, unitId: ElementId, adding: boolean) => {
    const kept = keptAt.get(unitId)
    if (!kept) return
    const filedIn = (id: ElementId) => (id === unitId ? kept.scope : undefined)
    void writeIn({ scopes, writable }, kept.scope, (held) => {
      const unit = held.model.elements.find((one) => one.id === unitId && one.ref === undefined)
      if (!unit) return undefined
      const next = adding ? scopesWith(unit, scope, filedIn) : scopesWithout(unit, scope)
      if (JSON.stringify(next) === JSON.stringify(unit.scopes)) return undefined
      return [{ type: 'element.update', id: unitId, patch: { scopes: next } }]
    }).then((written) => {
      if (written.ok) {
        onTreeChanged()
        notify(s(adding ? 'org.servedByAdded' : 'org.servedByRemoved', { unit: kept.name, scope: scopeName(scope), kept: scopeName(kept.scope) }), 'success')
        return
      }
      const key = refusalKey(written)
      if (key) notify(s(key), 'error')
    }, (cause: unknown) => failed('organisation.servedBy', cause, 'pick.notWritten'))
  }, [keptAt, scopes, writable, onTreeChanged, notify, failed, scopeName, s])
  return useMemo<ServedByAccess>(() => ({
    of,
    mayChange: (unitId) => {
      const kept = keptAt.get(unitId)
      return kept !== undefined && writable(kept.scope)
    },
    add: (scope, unitId) => change(scope, unitId, true),
    remove: (scope, unitId) => change(scope, unitId, false),
    open: (unitId) => {
      const kept = keptAt.get(unitId)
      if (kept) onOpen(kept.scope, unitId)
    },
  }), [of, keptAt, writable, change, onOpen])
}
