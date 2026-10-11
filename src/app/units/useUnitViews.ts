// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation chart and the Conway map, made (ADR-0036 §7).
 *
 * Each is a view and the active one while it is up, laid out in its tab as a
 * map is. Making one is a command, the same as making a sheet; what it shows
 * is worked out from the units, the assignments and the rows every time it
 * is drawn, so it starts with nothing on it but its name.
 */
import { useCallback } from 'react'
import { toDiagram } from '../../model'
import type { MakeId } from '../../model/keys'
import { laidOutView } from '../../model/orgChart'
import type { Translate } from '../../i18n'
import type { ModelSession } from '../useModelSession'

export type UnitViewKind = 'chart' | 'conway'

export type UnitViews = {
  /** Make one, and make it the active view. */
  create: (kind: UnitViewKind) => void
}

const MADE = {
  chart: { prefix: 'oc', name: 'shell.newChart' },
  conway: { prefix: 'cw', name: 'shell.newConway' },
} as const

export function useUnitViews(deps: { session: Pick<ModelSession, 'dispatch'>; makeId: MakeId; s: Translate }): UnitViews {
  const { session, makeId, s } = deps
  const create = useCallback((kind: UnitViewKind) => {
    const view = laidOutView(kind, makeId(MADE[kind].prefix), s(MADE[kind].name))
    session.dispatch({ type: 'diagram.create', diagram: toDiagram(view) }, { activeDiagramId: view.id })
  }, [session, makeId, s])
  return { create }
}
