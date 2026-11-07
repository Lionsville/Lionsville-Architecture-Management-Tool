// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The chart's View bar: Levels, who is drawn, which lines, a new unit and the day,
 * in the kit's order, so a German word has room and nothing moves when one
 * changes. *Levels* says what a first open folded; the zoom is the dock's, as on
 * every canvas, and finding is on the outline.
 */
import type { ReactNode } from 'react'
import { CHART_LINES } from '../../agent/screen'
import type { ChartLines } from '../../agent/screen'
import type { StringKey, Translate } from '../../i18n'
import { CHART_LEVELS } from '../../model/orgChart'
import { DayControl } from '../../widgets/kit/DayControl'
import { Segmented } from '../../widgets/kit/Segmented'
import { ViewBar, ViewBarMenu } from '../../widgets/kit/ViewBar'
import { CHART_PEOPLE } from './useChartFolds'
import type { ChartPeople } from './useChartFolds'

/** The day control's hold on the view: looking at another day, and keeping one. */
export type ChartDay = {
  /** Somebody is looking at a day that is not the one the chart is saved on. */
  looking: boolean
  onChange: (day: string | undefined) => void
  /** Always open it on the day looked at. Absent: nothing to keep, or a reader who may not. */
  onKeep?: () => void
}

const PEOPLE_WORD: Record<ChartPeople, StringKey> = { leaders: 'chart.peopleLeaders', required: 'chart.peopleRequired', all: 'chart.peopleAll' }
const LINES_WORD: Record<ChartLines, StringKey> = { off: 'chart.linesOff', person: 'chart.linesPerson', dotted: 'chart.linesDotted', exceptions: 'chart.linesExceptions' }

export function ChartBar({ level, onLevel, people, onPeople, lines, onLines, add, day, shownDay, t }: {
  level: number | 'all' | undefined
  onLevel: (levels: number | undefined) => void
  people: ChartPeople
  onPeople: (people: ChartPeople) => void
  lines: ChartLines
  onLines: (lines: ChartLines) => void
  add: ReactNode
  day: ChartDay | undefined
  shownDay: string | undefined
  t: Translate
}) {
  return (
    <ViewBar
      label={t('chart.barLabel')} data-guide="chart.bar"
      reading={(
        <span className="chart-bar__levels" data-testid="chart-levels">
          {t('chart.levels')}
          <Segmented
            label={t('chart.levels')} value={level === undefined ? '' : String(level)} data-guide="chart.foldAll"
            onChange={(value) => onLevel(value === 'all' ? undefined : Number(value))}
            options={[...CHART_LEVELS.map((one) => ({ value: String(one), label: String(one) })), { value: 'all', label: t('chart.levelsAll') }]}
          />
        </span>
      )}
      show={(
        <>
          <ViewBarMenu
            label={t('chart.peopleOn', { which: t(PEOPLE_WORD[people]) })} menuLabel={t('chart.people')} data-guide="chart.showOptional"
            items={CHART_PEOPLE.map((one) => ({ label: t(PEOPLE_WORD[one]), checked: one === people, onSelect: () => onPeople(one) }))}
          />
          <ViewBarMenu
            label={t('chart.linesOn', { which: t(LINES_WORD[lines]) })} menuLabel={t('chart.lines')} data-guide="chart.showLines"
            items={CHART_LINES.map((one) => ({ label: t(LINES_WORD[one]), checked: one === lines, onSelect: () => onLines(one) }))}
          />
        </>
      )}
      add={add}
      {...(day ? {
        day: <DayControl day={shownDay} onChange={day.onChange} data-guide="chart.day" {...(day.onKeep ? { onKeep: day.onKeep, keepLabel: t('chart.dayKeep') } : {})} />,
      } : {})}
    />
  )
}
