// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
 *
 * And a `Translate` is available here without the registry, which matters for
 * who else drafts these. The registry (`i18n/strings.ts`) composes every
 * module's words, so asking it for a translator imports `app/strings` and
 * `editor/strings` at module load — right for anything that draws a screen, and
 * wrong for a build composed from this one that runs the reducer and the folder
 * format in a node process and wants a snapshot's message. A drafted message
 * says what a step is called and how many more there were: two slices, no
 * screens. {@link translateFrom} and {@link draftCommitMessageInEnglish} are
 * those two slices and nothing else, so `projects/` can be reached from a
 * process that never touches `app/` — which `commitMessage.test.ts` pins by
 * walking the imports.
 */
import type { StepSummary } from '../model/activity'
import type { Translate } from '../i18n/strings'
import { translateFrom } from '../i18n/interpolate'
import { EN as MODEL_WORDS } from '../model/strings/en'
import { EN as PROJECT_WORDS } from './strings/en'

/**
 * Re-exported where it always was. It lives in `i18n/interpolate.ts` now, beside
 * the placeholder filling it is built on, because `model/` needs the same thing
 * for the same reason and may not import `projects/`.
 */
export { translateFrom } from '../i18n/interpolate'

/**
 * The words a drafted message can use, in English.
 *
 * The two slices whole, rather than the dozen keys this file happens to reach
 * today: a step summary names any `activity.` key and any `relation.` one
 * (`model/activity.ts`), the tail is `git.andMore`, and a key added to either
 * slice is one a drafted message should have. Both slices import nothing at all,
 * which is what makes this cheap — they are the two `as const` objects and no
 * graph behind them.
 */
export const COMMIT_MESSAGE_WORDS: Readonly<Record<string, string>> = { ...MODEL_WORDS, ...PROJECT_WORDS }

/** English, for a caller that has no language to be in. */
export const ENGLISH_DRAFT: Translate = translateFrom(COMMIT_MESSAGE_WORDS)

/** How many steps the subject line names before it gives up and counts. */
const NAMED_IN_SUBJECT = 3

/** How long a subject line may be. Git's own convention, and a good one. */
const SUBJECT_LIMIT = 72

function sentence(summary: StepSummary, t: Translate): string {
  return t(summary.key, {
    name: summary.name ?? '—',
    count: summary.count ?? 1,
    asOf: summary.asOf ?? '',
    type: summary.typeKey ? t(summary.typeKey) : '',
  })
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

/**
 * The same message with no language chosen and no registry imported: what a
 * process with no screen drafts with.
 */
export function draftCommitMessageInEnglish(steps: readonly StepSummary[]): string {
  return draftCommitMessage(steps, ENGLISH_DRAFT)
}
