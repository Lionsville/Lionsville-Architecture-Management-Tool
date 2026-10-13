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
import type { PickOption } from '../../widgets/PickToAdd'
import type { BelowScopes } from '../useChangeBelow'
import type { Failed } from '../useShellServices'
import { refusalKey, writeIn } from '../units/writeIn'
import { pickableBy, servedByOf, servingChoicesOf } from './servedByView'
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
  /** What the new-scope dialog's *Served by* offers: a scope nobody serves yet, as this person may pick. */
  choicesForNew: () => PickOption[]
  /**
   * A scope made a moment ago, served by a unit: the unit's `scopes` written
   * in the scope that keeps it. Refused, the scope stays and a notice says
   * the link was not made and where it is made instead. Settles either way.
   */
  link: (scope: ScopePath, unitId: ElementId, name: string) => Promise<void>
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
  /** One unit's `scopes`, written where it is kept: what each edit and a new scope's link are. */
  const write = useCallback((scope: ScopePath, unitId: ElementId, adding: boolean) => {
    const kept = keptAt.get(unitId)
    if (!kept) return undefined
    const filedIn = (id: ElementId) => (id === unitId ? kept.scope : undefined)
    const written = writeIn({ scopes, writable }, kept.scope, (held) => {
      const unit = held.model.elements.find((one) => one.id === unitId && one.ref === undefined)
      if (!unit) return undefined
      const next = adding ? scopesWith(unit, scope, filedIn) : scopesWithout(unit, scope)
      if (JSON.stringify(next) === JSON.stringify(unit.scopes)) return undefined
      return [{ type: 'element.update', id: unitId, patch: { scopes: next } }]
    })
    return { kept, written }
  }, [keptAt, scopes, writable])
  const change = useCallback((scope: ScopePath, unitId: ElementId, adding: boolean) => {
    const asked = write(scope, unitId, adding)
    if (!asked) return
    const { kept } = asked
    void asked.written.then((written) => {
      if (written.ok) {
        onTreeChanged()
        notify(s(adding ? 'org.servedByAdded' : 'org.servedByRemoved', { unit: kept.name, scope: scopeName(scope), kept: scopeName(kept.scope) }), 'success')
        return
      }
      const key = refusalKey(written)
      if (key) notify(s(key), 'error')
    }, (cause: unknown) => failed('organisation.servedBy', cause, 'pick.notWritten'))
  }, [write, onTreeChanged, notify, failed, scopeName, s])
  // Named by the caller: a scope made a moment ago is not in the tree these names were read from.
  const link = useCallback(async (scope: ScopePath, unitId: ElementId, name: string) => {
    const asked = write(scope, unitId, true)
    const notLinked = (why: string) => notify(
      `${why} ${s('org.newScopeNotLinked', { unit: asked?.kept.name ?? unitId, scope: name })}`, 'warning',
    )
    if (!asked) { notLinked(s('pick.notWritten')); return }
    try {
      const written = await asked.written
      if (written.ok) { onTreeChanged(); return }
      notLinked(s(refusalKey(written) ?? 'pick.notWritten'))
    } catch (cause: unknown) {
      failed('organisation.servedBy.link', cause)
      notLinked(s('pick.notWritten'))
    }
  }, [write, onTreeChanged, notify, failed, s])
  const mayChange = useCallback((unitId: ElementId) => {
    const kept = keptAt.get(unitId)
    return kept !== undefined && writable(kept.scope)
  }, [keptAt, writable])
  return useMemo<ServedByAccess>(() => ({
    of,
    mayChange,
    choicesForNew: () => pickableBy(servingChoicesOf(index, undefined, today, { scopeName, s }), mayChange, { s }),
    link,
    add: (scope, unitId) => change(scope, unitId, true),
    remove: (scope, unitId) => change(scope, unitId, false),
    open: (unitId) => {
      const kept = keptAt.get(unitId)
      if (kept) onOpen(kept.scope, unitId)
    },
  }), [of, keptAt, mayChange, change, link, onOpen, index, today, scopeName, s])
}
