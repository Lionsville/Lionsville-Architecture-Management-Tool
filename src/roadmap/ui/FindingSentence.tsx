// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One finding in words, as a link to what it is about: the place its dates
 * are put right (`findingTarget`).
 *
 * The one component that says a finding. `findingLinks.test.ts` holds every
 * other file to not saying one itself, so a new place that lists findings
 * lists them as links, because this is the only way it can list them.
 */
import Link from '@mui/material/Link'
import { RELATION_LABEL } from '../../model'
import type { Finding } from '../../model/checks'
import type { Translate } from '../../i18n'
import { CHECK_SENTENCE } from '../labels'

/** A finding's sentence, filled in. Not exported: said anywhere else, it would not be a link. */
function findingWords(problem: Finding, t: Translate): string {
  return t(CHECK_SENTENCE[problem.kind], {
    name: problem.name,
    detail: problem.detail ?? '',
    count: String(problem.count ?? 0),
    // Which kind of row it was (ADR-0012 §5), in words: *supports* where
    // the finding means supports.
    type: problem.relationType ? t(RELATION_LABEL[problem.relationType]) : '',
  })
}

export function FindingSentence({ problem, t, onOpen }: { problem: Finding; t: Translate; onOpen: () => void }) {
  return (
    <Link
      component="button"
      type="button"
      data-testid={`finding-${problem.kind}-${problem.id}`}
      onClick={onOpen}
      sx={{ fontSize: 'inherit', textAlign: 'left', verticalAlign: 'baseline' }}
    >
      {findingWords(problem, t)}
    </Link>
  )
}
