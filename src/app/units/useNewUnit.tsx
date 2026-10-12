// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *+ Unit* on the organisation chart (ADR-0036, as built 3.6.2): what each
 * place offers, the dialog it opens, the unit made, and the unit picked once
 * the chart draws it.
 *
 * **One step in the scope it is filed in.** Filed in the open scope, it is
 * the session's step, undone with ⌘Z here. Filed in another, it is that
 * scope's step under that scope's rights, written the way a link kept at the
 * other end is (`writeIn.ts`) — never a step on a session open elsewhere.
 * Making a unit is structure, so the scope's right decides: a managing
 * role's right covers a unit's people, never a new unit (§12), and a chart
 * that is only read offers nothing.
 *
 * **Then it is picked.** Once the chart draws it — at once where it is kept
 * here, once the tree is read again where it is kept elsewhere — it is gone to
 * as a pick in the outline goes: the way to it unfolded, scrolled to, chosen
 * where the open scope keeps it. Its type's required roles are on it as
 * vacancies, so assigning people follows on from there.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Translate } from '../../i18n'
import type { Command } from '../../model/commands'
import { walk } from '../../model/orgChart'
import type { ChartUnit, OrgChart } from '../../model/orgChart'
import type { ElementId } from '../../model/types'
import type { ScopePath } from '../../projects/scopePath'
import { NewUnitDialog } from './NewUnitDialog'
import type { NewUnitForm, NewUnitNone } from './NewUnitDialog'
import { newUnitElement, typesThatMaySit } from './newUnit'
import type { UnitViewsHere } from './unitViewsHere'
import { refusalKey } from './writeIn'
import type { WriteIn } from './writeIn'

/** What making a unit from the chart is handed by the workspace. */
export type UnitMaking = {
  /** Every scope's path, in the tree's order. */
  scopes: readonly ScopePath[]
  /** Whether the person may change the scope at this path. */
  writable: (path: ScopePath) => boolean
  /** The open scope's own step. Answers nothing where it was refused. */
  dispatch: (command: Command) => unknown
  /** Another scope's step, under its rights. */
  writeIn: WriteIn
  /** A fresh element id for a name, unique across the tree. */
  newId: (name: string) => ElementId
  /** The operating model's page, at the organisation. */
  onOpenOperating: () => void
}

/** What a place offers: a dialog of the types that may sit there, or why none may. */
export type UnitOffer = { ok: true } | { ok: false; reason: string; link: string }

export type NewUnit = {
  /** What *+ Unit* offers inside `parent`, or at the top; absent where nothing is made here. */
  offer: ((parent?: ChartUnit) => UnitOffer) | undefined
  /** Open the dialog for `parent`, or the top. */
  open: (parent?: ChartUnit) => void
  /** The dialog, while it is open. */
  dialog: ReactNode
}

export function useNewUnit(at: {
  make: UnitMaking | undefined
  readOnly: boolean
  here: UnitViewsHere
  chart: OrgChart
  day: string
  /** The scope the chart is open in. */
  scope: ScopePath
  scopeLabel: (path: ScopePath) => string
  typeName: (id: string | undefined) => string
  goTo: (id: ElementId) => void
  t: Translate
}): NewUnit {
  const { make, here, chart, day, scope, t, goTo } = at
  const making = make !== undefined && !at.readOnly ? make : undefined
  const unitTypes = here.at.organisation.unitTypes
  const [place, setPlace] = useState<{ parent?: ChartUnit } | undefined>(undefined)
  const [pending, setPending] = useState<ElementId | undefined>(undefined)
  // The unit made is gone to once the chart draws it.
  useEffect(() => {
    if (pending === undefined || ![...walk(chart.roots)].some((unit) => unit.id === pending)) return
    setPending(undefined)
    goTo(pending)
  }, [pending, chart, goTo])
  const typesAt = useCallback((parent?: ChartUnit) => typesThatMaySit(unitTypes, parent?.unitTypeId, day), [unitTypes, day])
  const offer = useMemo(() => (making ? (parent?: ChartUnit): UnitOffer => {
    if (unitTypes.length === 0) return { ok: false, reason: t('chart.addNoTypes'), link: t('chart.addStartLibrary') }
    if (typesAt(parent).length > 0) return { ok: true }
    const reason = parent ? t('chart.addNoneIn', { type: at.typeName(parent.unitTypeId) }) : t('chart.addNoneAtTop')
    return { ok: false, reason, link: t('chart.addOpenOperating') }
  } : undefined), [making, unitTypes, typesAt, t, at.typeName])
  const open = useCallback((parent?: ChartUnit) => setPlace(parent ? { parent } : {}), [])
  const create = useCallback(async (form: NewUnitForm): Promise<string | undefined> => {
    if (!making) return t('chart.addNotMade')
    const parentId = place?.parent?.id
    const element = newUnitElement({ id: making.newId(form.name), name: form.name, unitTypeId: form.unitTypeId, parentId, scopes: form.serves })
    const command: Command = { type: 'element.create', element }
    if (form.filedIn === scope) {
      if (making.dispatch(command) === undefined) return t('chart.addNotMade')
    } else {
      const written = await making.writeIn(form.filedIn, (held) => (held.model.elements.some((one) => one.id === element.id) ? undefined : [command]))
      if (!written.ok) {
        const key = refusalKey(written)
        return key ? t(key) : t('chart.addNotMade')
      }
    }
    setPending(element.id)
    return undefined
  }, [making, place, scope, t])
  const writable = useMemo(() => (making ? making.scopes.filter(making.writable) : []), [making])
  let dialog: ReactNode = null
  if (place && making && offer) {
    const offered = offer(place.parent)
    const none: NewUnitNone | undefined = offered.ok ? undefined : { reason: offered.reason, link: offered.link, onLink: making.onOpenOperating }
    const parent = place.parent
    dialog = (
      <NewUnitDialog
        place={parent ? { parent: { id: parent.id, name: parent.name, typeName: at.typeName(parent.unitTypeId), scope: here.scopeOf(parent.id) } } : {}}
        types={typesAt(parent)} none={none} scopes={making.scopes} writable={writable} chartScope={scope}
        scopeLabel={at.scopeLabel} onCreate={create} onClose={() => setPlace(undefined)} s={t}
      />
    )
  }
  return { offer, open, dialog }
}
