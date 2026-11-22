// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One box for units and people, results as it is typed, and *Me* beside it. A
 * person is what an organisation chart is read for, and finding only units sent
 * the commonest question to the People page. What it answers stays in its list,
 * so a miss moves nothing on the chart.
 */
import { useMemo } from 'react'
import type { Translate } from '../../i18n'
import { walk } from '../../model/orgChart'
import type { ChartHolder, ChartUnit, OrgChart } from '../../model/orgChart'
import { pickedPerson } from '../../model/person'
import type { ElementId } from '../../model/types'
import type { PersonNames } from '../../people/ui/names'
import { Button } from '../../widgets/kit/Button'
import { Picker } from '../../widgets/kit/Picker'
import type { PickerOption } from '../../widgets/kit/Picker'

const UNIT = 'u:'
const PERSON = 'p:'

/** What the box searches: the units, each with the unit it sits in, then every holder with what they hold where. */
export function findOptions(chart: OrgChart, names: PersonNames, roleName: (id: string) => string, t: Translate): PickerOption[] {
  const units: PickerOption[] = []
  const people: PickerOption[] = []
  const visit = (list: readonly ChartUnit[], parent: ChartUnit | undefined) => {
    for (const unit of list) {
      units.push({ id: `${UNIT}${unit.id}`, label: unit.name, group: t('chart.findUnits'), ...(parent ? { detail: t('chart.findIn', { unit: parent.name }) } : {}) })
      for (const holder of [...unit.slots.flatMap((slot) => slot.holders), ...unit.others]) {
        people.push({
          id: `${PERSON}${holder.assignment.id}`, label: names.text(pickedPerson(holder.person)), group: t('chart.findPeople'),
          detail: t('chart.assignmentIn', { role: roleName(holder.assignment.roleId), unit: unit.name }),
        })
      }
      visit(unit.children, unit)
    }
  }
  visit(chart.roots, undefined)
  return [...units, ...people]
}

/** The holder an option of {@link findOptions} names, with their unit. */
function holderOf(chart: OrgChart, assignmentId: string): { holder: ChartHolder; unit: ChartUnit } | undefined {
  for (const unit of walk(chart.roots)) {
    const holder = [...unit.slots.flatMap((slot) => slot.holders), ...unit.others].find((one) => one.assignment.id === assignmentId)
    if (holder) return { holder, unit }
  }
  return undefined
}

export function ChartFind({ chart, names, roleName, onUnit, onHolder, onMe, note, t }: {
  chart: OrgChart; names: PersonNames; roleName: (id: string) => string
  onUnit: (id: ElementId) => void
  onHolder: (holder: ChartHolder, unit: ChartUnit) => void
  onMe: () => void
  /** What *Me* has to say where it found nobody. */
  note: string | undefined
  t: Translate
}) {
  const options = useMemo(() => findOptions(chart, names, roleName, t), [chart, names, roleName, t])
  const onPick = (option: PickerOption) => {
    if (option.id.startsWith(UNIT)) { onUnit(option.id.slice(UNIT.length)); return }
    const found = holderOf(chart, option.id.slice(PERSON.length))
    if (found) onHolder(found.holder, found.unit)
  }
  return (
    <div className="chart-outline__find" data-testid="chart-find">
      <Picker
        label={t('chart.findLabel')} placeholder={t('chart.findShort')} options={options} onPick={onPick} posture="popup" recent={[]} hint={t('chart.findHint')}
        inputTestId="chart-find-input" data-guide="chart.find"
      />
      <Button onClick={onMe} data-testid="chart-find-me" data-guide="chart.findMe" title={t('chart.findMeTip')}>{t('chart.me')}</Button>
      {note && <p className="chart-outline__note" data-testid="chart-note" role="status">{note}</p>}
    </div>
  )
}
