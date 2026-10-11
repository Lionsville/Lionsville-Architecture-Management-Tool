// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where the dates disagree, under the roadmap's axis — and under its empty
 * state too, where it says that they agree: the one place on the page a
 * finding is read (ADR-0009), drawn whether or not there is anything dated
 * above it, with the caption that says what the list cannot tell.
 *
 * In the one list of findings (`widgets/FindingsList`, ADR-0036 amended 11
 * October 2026): grouped by check, folded, each opening its explanation,
 * whose actions go where its sentence used to (`findingTarget`) — the element,
 * the element a row starts from, the plan — and *Accept* writes the
 * application interface the container lines imply, where the page may write.
 */
import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n'
import { CHECK_LIST_WORDS, DATE_CHECK, groupByCheck } from '../../model/checkCatalogue'
import type { CheckAction } from '../../model/checkCatalogue'
import { splitMarked } from '../../model/checkMarks'
import type { CheckMark } from '../../model/checkMarks'
import type { Finding } from '../../model/checks'
import type { Relation } from '../../model'
import { FindingsList } from '../../widgets/FindingsList'
import type { FindingActions } from '../../widgets/FindingsList'
import { findingTarget } from '../findingTarget'
import { findingWords } from './FindingSentence'
import type { RoadmapActions } from './RoadmapPage'

/** The scope the dates were checked in, as the marks handed in are all its own. */
const HERE = ''

export function RoadmapFindings({ problems, marks, relations, readOnly, actions, remember }: {
  problems: readonly Finding[]
  /** The open scope's marks as intended: a finding marked is not among the ones to look at. */
  marks?: readonly CheckMark[] | undefined
  relations: readonly Relation[]
  readOnly: boolean
  actions: RoadmapActions
  /** Where the session keeps the list's folds: the open scope's roadmap. */
  remember?: string | undefined
}) {
  const { t } = useStrings()
  const groups = useMemo(() => {
    const shown = splitMarked(problems, (marks ?? []).map((mark) => ({ scope: HERE, mark })), { scope: HERE }).shown
    return groupByCheck(shown, (problem) => DATE_CHECK[problem.kind])
  }, [problems, marks])
  const doing = useMemo((): FindingActions<Finding, CheckAction> => {
    const element = (problem: Finding) => {
      const target = findingTarget(problem, relations)
      return target?.page === 'element' ? () => actions.onOpenElement(target.id) : undefined
    }
    return {
      openElement: element,
      // A row is opened at the element it starts from, whose inspector holds its dates.
      openRow: element,
      openPlan: (problem) => {
        const target = findingTarget(problem, relations)
        return target?.page === 'plan' ? () => actions.onOpenPlan(target.id) : undefined
      },
      acceptInterface: (problem) => (problem.kind === 'impliedInterface' && !readOnly ? () => actions.acceptInterface(problem.id) : undefined),
    }
  }, [relations, readOnly, actions])
  return (
    <Box sx={{ mt: 3, maxWidth: 760 }} data-guide="roadmap.findings">
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mb: 0.5 }}>
        {t('check.title')}
      </Typography>
      <FindingsList
        groups={groups} words={CHECK_LIST_WORDS} sentence={(problem) => findingWords(problem, t)} keyOf={(problem) => `${problem.kind}-${problem.id}`}
        actions={doing} attributesOf={(problem) => ({ 'data-testid': `finding-${problem.kind}-${problem.id}` })}
        empty={<Typography variant="body2" color="text.secondary">{t('check.none')}</Typography>}
        {...(remember !== undefined ? { remember } : {})}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        {t('check.staleness')}
      </Typography>
    </Box>
  )
}
