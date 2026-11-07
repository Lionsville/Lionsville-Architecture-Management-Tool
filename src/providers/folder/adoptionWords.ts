// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a copy into a folder comes to, in words: the title, what was found there
 * by kind, and every thing that did not come along, by name and with why. Kept
 * apart from the dialog because what it may and may not say is the whole of the
 * promise: only a copy that is whole is told as done.
 */
import type { Translate } from '../../i18n'
import { reasonOf, ShellError } from '../../platform/errors'
import { COPY_KINDS } from '../../projects/copyCounts'
import type { CopyCounts } from '../../projects/copyCounts'
import { isWhole } from '../../projects/copyScopes'
import type { CopyFailure, CopyTally } from '../../projects/copyScopes'

/** Addresses as a person reads them, the organisation's included. */
export const pathsOf = (paths: readonly string[]) => paths.map((path) => path || '/').join(', ')

/** What there is, by kind, as a sentence's list: only the kinds there are. */
export function countsText(counts: CopyCounts, s: Translate): string {
  return COPY_KINDS.filter((kind) => counts[kind] > 0)
    .map((kind) => s(counts[kind] === 1 ? `folder.count.${kind}One` : `folder.count.${kind}`, { count: counts[kind] }))
    .join(', ')
}

/** A cause as a person reads it: a refusal's own words where it has a key, and the message as it is where it has none. */
export function reasonIn(cause: unknown, s: Translate): string {
  return cause instanceof ShellError ? s(cause.key, cause.params) : reasonOf(cause)
}

export type AdoptionOutcome = { title: string; lines: string[]; again: boolean }

/** The scope failures, one sentence per reason, each with the scopes it stopped. */
function writeFailures(failures: readonly CopyFailure[], s: Translate): string[] {
  const byReason = new Map<string, string[]>()
  for (const failure of failures) {
    if (failure.what !== 'scope' || failure.address === undefined) continue
    const reason = reasonIn(failure.cause, s)
    byReason.set(reason, [...byReason.get(reason) ?? [], failure.address])
  }
  return [...byReason].map(([reason, paths]) => s('folder.adoptNotWritten', { count: paths.length, paths: pathsOf(paths), reason }))
}

function reasonsOf(failures: readonly CopyFailure[], what: CopyFailure['what'], s: Translate): string {
  return [...new Set(failures.filter((failure) => failure.what === what).map((failure) => reasonIn(failure.cause, s)))].join('; ')
}

/** Everything that keeps a copy from being whole, one sentence each. */
function whatDidNotCome(tally: CopyTally, s: Translate): string[] {
  const lines: string[] = []
  // Scopes that would not land are the ones `missed` holds beyond those that would not read.
  const written = tally.failures.filter((failure) => failure.what === 'scope')
  const unreadPaths = tally.missed.filter((path) => !written.some((failure) => failure.address === path))
  lines.push(...writeFailures(written, s))
  if (unreadPaths.length) lines.push(s('folder.adoptNotRead', { count: unreadPaths.length, paths: pathsOf(unreadPaths) }))
  if (tally.differs.length) lines.push(s('folder.adoptDiffers', { count: tally.differs.length, paths: pathsOf(tally.differs) }))
  if (tally.meanwhile.length) lines.push(s('folder.adoptMeanwhile', { paths: pathsOf(tally.meanwhile) }))
  for (const { address, lists } of tally.unlike) lines.push(s('folder.adoptUnlike', { paths: pathsOf([address]), lists: lists.join(', ') }))
  const people = reasonsOf(tally.failures, 'people', s)
  if (people) lines.push(s('folder.adoptPeopleFailed', { reason: people }))
  const settings = reasonsOf(tally.failures, 'settings', s)
  if (settings) lines.push(s('folder.adoptSettingsFailed', { reason: settings }))
  if (tally.stopped) lines.push(s('folder.adoptStopped', { left: tally.stopped.left }))
  return lines
}

function titleOf(tally: CopyTally, s: Translate): string {
  if (isWhole(tally)) return s('folder.adoptDoneTitle')
  if (tally.stopped) return s('folder.adoptStoppedTitle')
  return s(tally.counts.scopes === 0 ? 'folder.adoptNoneTitle' : 'folder.adoptPartlyTitle')
}

export function adoptionOutcome(tally: CopyTally, name: string, s: Translate): AdoptionOutcome {
  const whole = isWhole(tally)
  const counts = countsText(tally.counts, s)
  const lines = [
    tally.counts.scopes === 0 ? s('folder.adoptNothing', { name }) : s(whole ? 'folder.adoptDone' : 'folder.adoptPartly', { name, counts }),
    ...tally.already > 0 && tally.scopes > 0 ? [s('folder.adoptAlready', { count: tally.already })] : [],
    ...whatDidNotCome(tally, s),
    ...tally.namesKept.length ? [s('folder.adoptNamesKept', { paths: pathsOf(tally.namesKept) })] : [],
    s('folder.adoptBrowserKept'),
    ...tally.historyStays ? [s('folder.adoptHistoryStays')] : [],
  ]
  return { title: titleOf(tally, s), lines, again: tally.failures.some((failure) => failure.what !== 'read') || Boolean(tally.stopped) }
}
