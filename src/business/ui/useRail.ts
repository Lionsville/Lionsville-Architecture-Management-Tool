// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * How this person has the stakeholder rail drawn, for the session (ADR-0036,
 * amended 12 October 2026): *All units* on or off, and the stakeholders typed
 * as units while the sheet was up, which stay drawn where they were.
 *
 * Both are kept in the shell's session memory under the view's own key
 * (`widgets/sessionMemory`), so they come back when the tab does and are
 * gone when the app closes — a view of the sheet, never something it says.
 *
 * **A stakeholder typed as a unit does not leave under the cursor.** Between
 * one model and the next, an actor that was a party and is now a unit is kept
 * for the session, in the same render it changed in, and the person is told
 * where it now lives. Only while the rail is drawn and may be written: a
 * page that is only read is not where anybody typed it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DesignDiagram, DesignModel, ElementId } from '../../model'
import { isUnit } from '../../model/units'
import { useSessionSet } from '../../widgets/sessionMemory'
import type { LaidOutSheet, RailOptions } from '../sheet'

/** *All units*, among the kept ids: no element id starts with a NUL. */
const ALL_UNITS = '\u0000allUnits'

/** *All units* on the rail: what it would add, and the switch. Absent from a picture of the page. */
export type RailUnits = { notDrawn: number; all: boolean; onAll(on: boolean): void }

export type Rail = {
  /** What `sheetPage` is laid out with. */
  options: RailOptions
  /** The switch, for the page as it was laid out. */
  units(laidOut: LaidOutSheet): RailUnits
}

export function useRail(model: Pick<DesignModel, 'elements'>, at: {
  /** The view's key in the session memory. Absent: kept while the page is drawn. */
  remember?: string | undefined
  readOnly: boolean
  sheet: Pick<DesignDiagram, 'showActors'> | undefined
  /** Where a note to the person goes, and the note that says where the unit went. */
  notify?: ((message: string) => void) | undefined
  note: string
}): Rail {
  const [held, setHeld] = useSessionSet(at.remember)
  // Only while the rail is drawn and may be written: a page only read is not where anybody typed it.
  const watching = !at.readOnly && at.sheet?.showActors !== false
  const [seen, setSeen] = useState(() => ({ model, parties: partiesOf(model), typed: [] as ElementId[] }))
  let current = seen
  if (seen.model !== model) {
    // A new model: what was a party a moment ago and is a unit now.
    const typed = watching
      ? model.elements.filter((element) => isUnit(element) && seen.parties.has(element.id)).map((element) => element.id)
      : []
    current = { model, parties: partiesOf(model), typed }
    setSeen(current)
  }

  const { notify, note } = at
  useEffect(() => {
    const fresh = current.typed.filter((id) => !held.has(id))
    if (fresh.length === 0) return
    setHeld(new Set([...held, ...fresh]))
    notify?.(note)
  }, [current.typed, held, setHeld, notify, note])

  const allUnits = held.has(ALL_UNITS)
  // One object per change, not per render: the page lays itself out again when it changes.
  const options = useMemo<RailOptions>(() => {
    const kept = new Set([...held, ...current.typed])
    kept.delete(ALL_UNITS)
    return { allUnits: held.has(ALL_UNITS), kept }
  }, [held, current.typed])
  const onAll = useCallback((on: boolean) => {
    const next = new Set(held)
    if (on) next.add(ALL_UNITS)
    else next.delete(ALL_UNITS)
    setHeld(next)
  }, [held, setHeld])
  return { options, units: (laidOut) => ({ notDrawn: laidOut.unitsNotDrawn, all: allUnits, onAll }) }
}

/** The actors with no type: the parties. */
function partiesOf(model: Pick<DesignModel, 'elements'>): ReadonlySet<ElementId> {
  return new Set(model.elements.filter((element) => element.kind === 'actor' && !isUnit(element)).map((element) => element.id))
}
