// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the open scope's element records say about each element (ADR-0032,
 * amended 22 November 2026): the decisions about it, from the session, and
 * the observations on it, from the session for this scope and from the
 * tree's index for every other scope read — no load per row (ADR-0004). A
 * row opens its record on its page: this scope's over the board, another
 * scope's by opening that scope there.
 *
 * Said here in words, because a decision's status and an observation's tone
 * are the decisions' and the observations' vocabulary, which the editor may
 * not name.
 */
import { useMemo } from 'react'
import type { Translate } from '../i18n/strings'
import type { Adr } from '../model/adr'
import type { Observation, ScopeAnalysis } from '../model/observation'
import { formatAdrNumber } from '../decisions/adr'
import { STATUS_LABEL } from '../decisions/adrScope'
import { decisionsAbout, observationsOn } from '../observations/about'
import { formatObservationNumber, toneOf } from '../observations/observation'
import { TONE_WORD } from '../observations/observationScope'
import type { AboutRecordRow, AboutRecords, EditorRecordsAbout } from '../editor/props'

export type RecordsAboutInput = {
  decisions: readonly Adr[] | undefined
  observations: readonly Observation[] | undefined
  /** Every scope's analysis the index read: an empty tree is this scope's only. */
  tree: readonly ScopeAnalysis[]
  /** The open scope's path. */
  here: string
  scopeLabel: (path: string) => string
  t: Translate
}

/** One element's two lists, in words. */
export function recordsAbout(input: RecordsAboutInput, elementId: string): AboutRecords {
  const { t } = input
  const decisions = decisionsAbout(input.decisions, elementId).map((adr): AboutRecordRow => ({
    kind: 'decision', id: adr.id, label: formatAdrNumber(adr.number), title: adr.title, status: t(STATUS_LABEL[adr.status]),
  }))
  const observations = observationsOn(input.observations, input.tree, input.here, elementId).map(({ observation, scope }): AboutRecordRow => ({
    kind: 'observation', id: observation.id, label: formatObservationNumber(observation.number), title: observation.title,
    status: t(TONE_WORD[toneOf(observation)]), tone: toneOf(observation),
    ...(scope !== undefined ? { scope, where: input.scopeLabel(scope) } : {}),
  }))
  return { decisions, observations, observationsAcross: input.tree.length > 0 }
}

/** The editor's seam, over what the workspace holds, and where a row opens. */
export function useRecordsAbout(input: RecordsAboutInput, open: {
  decision: (id: string) => void
  observation: (id: string) => void
  /** Another scope's observation, on that scope's page. */
  elsewhere: ((scope: string, id: string) => void) | undefined
}): EditorRecordsAbout {
  const { decisions, observations, tree, here, scopeLabel, t } = input
  return useMemo(() => ({
    about: (elementId: string) => recordsAbout({ decisions, observations, tree, here, scopeLabel, t }, elementId),
    onOpen: (row: AboutRecordRow) => {
      if (row.kind === 'decision') open.decision(row.id)
      else if (row.scope === undefined) open.observation(row.id)
      else open.elsewhere?.(row.scope, row.id)
    },
  }), [decisions, observations, tree, here, scopeLabel, t, open])
}
