// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Who is responsible for each area, grouping and capability on a sheet
 * (ADR-0036, amended 11 and 13 October 2026), off its `assigned` rows — here
 * or elsewhere in the tree, counted once.
 *
 * **The unit, always.** A function a unit answers for carries a small label
 * with that unit's name, and *+N* where several do, the names in its title.
 * The label is a way out of the sheet: pressed, it opens the home of the
 * scope the unit serves — a menu of them where it serves several, or where
 * several units answer — and the unit where it is kept where it serves none.
 * Where to go is the host's (`SheetResponsible.openScope`, `.openUnit`): this
 * module knows no scope tree, only the names and paths it is handed.
 *
 * **Everybody, under its lens.** *Who answers* names each other actor the rows
 * point at and marks the ones nobody answers for, on every row. It is the
 * reader's own until kept, and the layout does not move for it.
 *
 * A unit that serves neither the function's domain nor sits under one that
 * does is drawn as a warning, as the check says it.
 */
import { useMemo, useState } from 'react'
import { Menu } from '../../widgets/kit/Menu'
import type { DesignModel, ElementId, Relation } from '../../model'
import type { Translate } from '../../i18n'
import { coverageOf } from '../coverage'
import type { SheetResponsible } from './FunctionInspector'

/** One actor a function is assigned to, as a chip says it. */
export type Holder = { id: ElementId; name: string; outside: boolean }

/** One unit a function is assigned to, as its label says it: and the scopes it serves. */
export type UnitHolder = Holder & { serves: readonly { scope: string; name: string }[] }

/** Who answers for each function on the page. */
export type Who = {
  /** Whether *Who answers* is the lens up: the actors that are not units are named then. */
  shown: boolean
  /** The actors that are not units, under that lens; every holder where the host says nothing of units. */
  of(functionId: ElementId): readonly Holder[]
  /** The units, always: what the label names. */
  units(functionId: ElementId): readonly UnitHolder[]
  /** Whether anybody answers for it at all. */
  anybody(functionId: ElementId): boolean
  open: Pick<SheetResponsible, 'openScope' | 'openUnit'>
}

/** The rows over the page, read once per model and per toggle. Nothing where the host hands no units. */
export function useWho(
  model: DesignModel, elsewhere: readonly Relation[] | undefined, responsible: SheetResponsible | undefined, shown: boolean,
): Who | undefined {
  return useMemo(() => (responsible ? whoOf(model, elsewhere, responsible, shown) : undefined), [model, elsewhere, responsible, shown])
}

/** {@link useWho}'s answer, pure. */
export function whoOf(model: DesignModel, elsewhere: readonly Relation[] | undefined, responsible: SheetResponsible, shown: boolean): Who {
  const coverage = coverageOf(model.relations, elsewhere)
  const named = (id: ElementId) => model.elements.find((one) => one.id === id)?.name ?? responsible.name(id) ?? id
  const holders = (functionId: ElementId) => coverage.get(functionId)?.assignedTo ?? []
  const outside = (id: ElementId, functionId: ElementId) => !responsible.serves(id, functionId)
  return {
    shown,
    of: (functionId) => (shown ? holders(functionId) : [])
      .filter((id) => responsible.unit?.(id) === undefined)
      .map((id) => ({ id, name: named(id), outside: outside(id, functionId) })),
    units: (functionId) => holders(functionId).flatMap((id) => {
      const unit = responsible.unit?.(id)
      return unit ? [{ id, name: unit.name, outside: outside(id, functionId), serves: unit.serves }] : []
    }),
    anybody: (functionId) => holders(functionId).length > 0,
    open: {
      ...(responsible.openScope ? { openScope: responsible.openScope } : {}),
      ...(responsible.openUnit ? { openUnit: responsible.openUnit } : {}),
    },
  }
}

/** Where a label may lead: a scope's home, or a unit where it is kept. */
export type UnitTarget = { key: string; label: string; note?: string; go: () => void }

/** Every place the units answering for a function lead to, in their order: each scope a unit serves, or the unit itself where it serves none. */
export function unitTargets(units: readonly UnitHolder[], open: Who['open'], t: Translate): UnitTarget[] {
  return units.flatMap((unit): UnitTarget[] => {
    if (unit.serves.length === 0) {
      const { openUnit } = open
      return openUnit ? [{ key: `unit:${unit.id}`, label: unit.name, note: t('sheet.unitWhereKept'), go: () => openUnit(unit.id) }] : []
    }
    const { openScope } = open
    if (!openScope) return []
    return unit.serves.map((one) => ({
      key: `${unit.id}:${one.scope}`, label: one.name, ...(units.length > 1 ? { note: unit.name } : {}), go: () => openScope(one.scope),
    }))
  })
}

/**
 * The label on a function a unit answers for: the first unit's name, *+N*
 * for the rest, every name in its title. Pressed, it goes where its one
 * target is, or opens a menu of them. Its own button beside the card's, never
 * inside it, and it stops the press at itself so the card is not chosen too.
 */
export function UnitLabel({ who, functionId, t }: { who: Who | undefined; functionId: ElementId; t: Translate }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const units = who?.units(functionId) ?? []
  if (!who || units.length === 0) return null
  const targets = unitTargets(units, who.open, t)
  const outside = units.some((one) => one.outside)
  const names = units.map((one) => (one.outside ? `${one.name} (${t('sheet.assignedOutside')})` : one.name)).join(', ')
  const more = units.length - 1
  return (
    <>
      <button
        type="button" className="sheet-unit" data-testid={`sheet-unit-${functionId}`} data-sheet-unit={outside ? 'outside' : 'serves'}
        title={names} aria-label={t('sheet.unitLabel', { units: names })}
        disabled={targets.length === 0} aria-haspopup={targets.length > 1 ? 'menu' : undefined}
        onClick={(event) => {
          event.stopPropagation()
          if (targets.length === 1) targets[0].go()
          else setAnchor(event.currentTarget)
        }}
      >
        {more > 0 ? `${units[0].name} ${t('sheet.unitLabelMore', { count: more })}` : units[0].name}
      </button>
      <Menu
        open={anchor !== null} anchorEl={anchor} label={names} onClose={() => setAnchor(null)}
        items={targets.map((target) => ({ label: target.note ? `${target.label} · ${target.note}` : target.label, onSelect: target.go }))}
      />
    </>
  )
}
