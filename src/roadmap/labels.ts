/**
 * What a plan's status and a finding are called — published, because a second
 * screen now says them.
 *
 * Both tables were private to the pages that drew them: the status picker in
 * `ui/PlanPage`, the finding sentences in `ui/RoadmapPage`. The organisation
 * screen's roadmap card counts the plans by status and shows the first finding
 * as its line, and a module may not name another module's string keys
 * (`CLAUDE.md`) — so the answer is the one `decisions` already gives with its
 * own `STATUS_LABEL`: publish the table rather than the keys.
 *
 * A table and not a function, so a status or a finding kind added later fails
 * to compile here rather than rendering as a blank.
 */
import type { StringKey } from '../i18n'
import type { Finding } from '../model/checks'
import type { TransitionStatus } from '../model/transition'

export const PLAN_STATUS_LABEL: Record<TransitionStatus, StringKey> = {
  draft: 'plan.draft',
  agreed: 'plan.agreed',
  running: 'plan.running',
  done: 'plan.done',
  abandoned: 'plan.abandoned',
}

/**
 * The sentence each finding is said as. Every one of them names `{name}` and
 * `{detail}`, and two of them a `{count}` or a `{type}` besides — which is why
 * the caller passes the whole finding rather than this taking one.
 */
export const CHECK_SENTENCE: Record<Finding['kind'], StringKey> = {
  retiresWithDependants: 'check.retiresWithDependants',
  successorTooLate: 'check.successorTooLate',
  successorMissing: 'check.successorMissing',
  lineOutlivesEnd: 'check.lineOutlivesEnd',
  planOverdue: 'check.planOverdue',
}
