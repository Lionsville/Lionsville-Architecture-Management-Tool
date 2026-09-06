/**
 * A commit message, drafted from what was actually done.
 *
 * The reason the command log from ADR-0002 was worth building. A snapshot whose
 * message is "Update project" is a snapshot nobody will ever go back to; a
 * history is only worth keeping if its lines say something, and the app is the
 * only thing in the room that knows what happened — the diff of a landscape
 * folder does not, and the person is not going to type it.
 *
 * So: the steps since the last snapshot, in the reader's language, as a subject
 * line and a body. Drafted, never final. It goes into a field the user can edit
 * before it is committed, because sometimes the honest message is not the list
 * of what happened but the reason for it.
 *
 * Pure: the summaries and a translate go in, a string comes out.
 */
import type { StepSummary } from '../model/activity'
import type { Translate } from '../i18n'

/** How many steps the subject line names before it gives up and counts. */
const NAMED_IN_SUBJECT = 3

/** How long a subject line may be. Git's own convention, and a good one. */
const SUBJECT_LIMIT = 72

function sentence(summary: StepSummary, t: Translate): string {
  return t(summary.key, { name: summary.name ?? '—', count: summary.count ?? 1 })
}

/**
 * Consecutive steps that say the same thing, said once.
 *
 * Not global deduplication: moving a node, renaming it and moving it again is
 * three things, and collapsing the two moves into one would be a message that
 * disagrees with the history it describes. Only the run — which is what a
 * afternoon of dragging looks like in the log.
 */
function collapsed(steps: readonly StepSummary[], t: Translate): string[] {
  const lines: string[] = []
  for (const step of steps) {
    const line = sentence(step, t)
    if (lines[lines.length - 1] !== line) lines.push(line)
  }
  return lines
}

/**
 * The message for a snapshot covering these steps.
 *
 * Empty list, empty message — the caller decides what to do about a snapshot of
 * nothing, because "nothing changed since the last one" and "this is the first
 * one" are different situations and only the caller can tell them apart.
 */
export function draftCommitMessage(steps: readonly StepSummary[], t: Translate): string {
  const lines = collapsed(steps, t)
  if (lines.length === 0) return ''

  const named = lines.slice(0, NAMED_IN_SUBJECT)
  const rest = lines.length - named.length
  let subject = named.join(', ')
  if (rest > 0) subject += t('git.andMore', { count: rest })
  if (subject.length > SUBJECT_LIMIT) {
    subject = `${subject.slice(0, SUBJECT_LIMIT - 1).trimEnd()}…`
  }

  // A body only when it says more than the subject already did. Git's own
  // shape: subject, blank line, the details.
  if (lines.length <= NAMED_IN_SUBJECT && subject === lines.join(', ')) return subject
  return `${subject}\n\n${lines.map((line) => `- ${line}`).join('\n')}\n`
}
