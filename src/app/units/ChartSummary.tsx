// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What an organisation chart says as a whole, in the inspector beside it
 * while nothing is picked (ADR-0036 §7, 3.6.1) — where the editor's canvas
 * hint stood, which says nothing about a chart.
 *
 * **The day and the counts**: whose chart and on which day, its units, the
 * people in them and the vacancies left, counted off the same reading the
 * page draws (`useChartReading`). **The findings**: what the organisation
 * contradicts about those units and people on the day, in the one list of
 * findings (`widgets/FindingsList`) — grouped, folded, each opening its
 * explanation, whose *Open the unit* goes to the unit on the chart as any
 * request from outside goes there: unfolded, scrolled to, and chosen where
 * the open scope keeps it; a person's opens them in People. **How to read it**:
 * the dashed vacancy, the red edge, *manages*, the dashed unit that has ended
 * with people in it, and where the empty optional roles are.
 *
 * Moved here from the page, which keeps only the units: one place for each
 * thing, and the chart's width for the chart.
 */
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import { CHECK_LIST_WORDS, groupByCheck } from '../../model/checkCatalogue'
import type { CheckAction } from '../../model/checkCatalogue'
import type { HostModel } from '../../model/hostModel'
import { vacanciesIn, walk } from '../../model/orgChart'
import type { OrgChart } from '../../model/orgChart'
import { splitMarked } from '../../model/checkMarks'
import { pickedPerson } from '../../model/person'
import type { DesignDiagram, ElementId } from '../../model/types'
import { usePersonNames } from '../../people/ui/names'
import type { PersonNames } from '../../people/ui/names'
import { checkMarksHere } from '../../projects/checkMarks'
import { findingSentence } from '../../projects/checks'
import type { Finding } from '../../projects/checks'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import { FindingsList } from '../../widgets/FindingsList'
import type { FindingActions } from '../../widgets/FindingsList'
import { foldKey } from '../sessionFolds'
import { summaryWords } from './chartWords'
import { useChartReading } from './chartReading'
import { unitViewsHere } from './unitViewsHere'

export type ChartSummaryProps = {
  /** The chart, with the day it is looked at on (`asOf`; absent is today). */
  diagram: DesignDiagram
  index: ScopeIndex
  scope: ScopePath
  /** The open scope's model as its session holds it now. */
  model: HostModel
  today: string
  scopeLabel: (path: ScopePath) => string
  /** Go to a unit on the chart, as a request from outside the page does. */
  onGoTo: (unitId: ElementId) => void
  /** Open a person on the People page; absent where the source keeps no register. */
  onOpenPeople?: ((person: string) => void) | undefined
}

const SECTION = { fontSize: 12, fontWeight: 700, color: 'text.secondary', mt: 1.75, mb: 0.5 } as const
const QUIET = { fontSize: 12, color: 'text.secondary' } as const

export function ChartSummary(props: ChartSummaryProps) {
  const { t, language } = useStrings()
  const names = usePersonNames()
  const { index, scope, model, diagram, today } = props
  const day = diagram.asOf ?? today
  const here = useMemo(() => unitViewsHere(index, scope, model), [index, scope, model])
  const { chart, findings: found } = useChartReading(here, day, names.canonical)
  // A finding marked as intended is not among the ones to look at (`model/checkMarks`).
  const findings = useMemo(() => splitMarked(found, checkMarksHere(index, scope, model)).shown, [found, index, scope, model])
  const vacant = useMemo(() => vacanciesIn(chart), [chart])
  const whose = props.scopeLabel(scope)
  return (
    <Box data-testid="chart-summary" data-guide="chart.summary" sx={{ pt: 0.5 }}>
      <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700 }} data-testid="chart-summary-title">
        {day === today ? t('chart.summaryToday', { scope: whose }) : t('chart.summaryOn', { scope: whose, day: formatDay(day, language) })}
      </Typography>
      <Typography sx={{ fontSize: 13 }} data-testid="chart-summary-counts">
        {summaryWords({ units: chart.units, people: chart.people, vacant }, t).map((part, at) => (
          <Box component="span" key={part.key} data-part={part.key} sx={part.warn ? { color: 'warning.main', fontWeight: 600 } : undefined}>
            {at > 0 ? ' · ' : ''}{part.text}
          </Box>
        ))}
      </Typography>
      <Typography component="h3" sx={SECTION}>{t('chart.findings')}</Typography>
      <ChartFindings findings={findings} chart={chart} names={names} scopeLabel={props.scopeLabel} onGoTo={props.onGoTo}
        onOpenPeople={props.onOpenPeople} remember={foldKey(scope, diagram.id, 'findings')} t={t} />
      <Typography component="h3" sx={SECTION}>{t('chart.howToRead')}</Typography>
      <HowToRead t={t} />
    </Box>
  )
}

/**
 * What the organisation contradicts on the day, about the units drawn and the
 * people in them, in the one list of findings: *Open the unit* goes to the
 * unit on the chart — for a domain it answers for outside those it serves,
 * the unit that answers — and *Open in People* to a person over their share.
 */
function ChartFindings({ findings, chart, names, scopeLabel, onGoTo, onOpenPeople, remember, t }: {
  findings: readonly Finding[]; chart: OrgChart; names: PersonNames; scopeLabel: (path: ScopePath) => string
  onGoTo: (unitId: ElementId) => void; onOpenPeople: ((person: string) => void) | undefined; remember: string; t: Translate
}) {
  const groups = useMemo(() => groupByCheck(findings), [findings])
  const drawn = useMemo(() => new Set([...walk(chart.roots)].map((unit) => unit.id)), [chart])
  const name = (person: string) => names.text(pickedPerson(person))
  const unitOf = (finding: Finding) => (finding.key === 'check.unitNotServing' ? finding.fields?.[0] : finding.person === undefined ? finding.id : undefined)
  const actions: FindingActions<Finding, CheckAction> = {
    openUnit: (finding) => {
      const unit = unitOf(finding)
      return unit !== undefined && drawn.has(unit) ? () => onGoTo(unit) : undefined
    },
    openPerson: (finding) => {
      const { person } = finding
      return person !== undefined && onOpenPeople ? () => onOpenPeople(names.canonical(person)) : undefined
    },
  }
  return (
    <FindingsList
      groups={groups} words={CHECK_LIST_WORDS} sentence={(finding) => findingSentence(finding, t, scopeLabel, name)} actions={actions}
      keyOf={(finding) => [finding.key, finding.scope, finding.id, finding.person ?? '', ...(finding.fields ?? [])].join('|')}
      attributesOf={() => ({ 'data-testid': 'chart-finding' })} remember={remember} testId="chart-findings"
      empty={<Typography sx={QUIET}>{t('chart.nothing')}</Typography>}
    />
  )
}

/** The chart's marks, each drawn as the chart draws it, with what it means; and where the empty optional roles went. */
function HowToRead({ t }: { t: Translate }) {
  const marks: { key: string; sample: ReactNode; text: string }[] = [
    {
      key: 'vacant', text: t('chart.readVacant'),
      sample: <Chip size="small" variant="outlined" color="warning" label={t('unit.vacant')} sx={{ borderStyle: 'dashed', height: 22 }} />,
    },
    {
      key: 'over', text: t('chart.readOver'),
      sample: <Chip size="small" variant="outlined" label={t('chart.readName')} sx={{ height: 22, borderColor: 'error.main', borderWidth: 2, borderStyle: 'solid' }} />,
    },
    {
      key: 'manages', text: t('chart.readManages'),
      sample: <Box component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>{t('unit.managesBadge')}</Box>,
    },
    {
      key: 'ended', text: t('chart.readEnded'),
      sample: <Box component="span" sx={{ display: 'inline-block', width: 40, height: 18, border: 1, borderStyle: 'dashed', borderColor: 'text.secondary', borderRadius: 1, verticalAlign: 'middle' }} />,
    },
  ]
  return (
    <>
      <Box component="ul" data-testid="chart-how-to-read" sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {marks.map((mark) => (
          <Box component="li" key={mark.key} data-mark={mark.key} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.375 }}>
            <Box sx={{ flex: 'none', width: 84 }}>{mark.sample}</Box>
            <Typography sx={{ fontSize: 12 }}>{mark.text}</Typography>
          </Box>
        ))}
      </Box>
      <Typography sx={{ ...QUIET, mt: 0.75 }} data-testid="chart-read-optional">{t('chart.readOptional')}</Typography>
    </>
  )
}
