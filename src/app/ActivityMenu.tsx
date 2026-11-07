// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What has happened to this project since it was opened (ADR-0002, step 9).
 *
 * The first thing the command log buys that undo did not already: a change is
 * a thing with a name and a time, so a list of them is a list somebody can
 * read. Nothing here computes anything — `model/activity.ts` works out what a
 * step is called, at the moment it is made and against the model as it was,
 * because that is the only moment a deleted row can still be named.
 *
 * Read-only on purpose. Stepping back to an entry is a different feature with a
 * different question behind it ("what happens to everything after it?"), and
 * ⌘Z already covers the one this answers.
 *
 * **Where the source keeps a log of its own, the list is that log as well**
 * (`platform/sourceProvider.ts`'s `SourceRecentActivity`). The session's stack
 * begins when the scope is opened, so over a source many people write to it
 * said *nothing yet* to somebody who had just arrived, and named nobody on the
 * person's own steps. The source's answer is merged with the stack — a step
 * both hold is listed once — and every line then says whose it was: *you*, or
 * the author's name. Where the source says nothing, the list is the stack
 * alone and reads exactly as it always did.
 */
import { useEffect, useState } from 'react'
import Typography from '@mui/material/Typography'
import type { Language, Translate } from '../i18n'
import { formatMoment } from '../i18n/dates'
import type { StepSummary } from '../model'
import type { SourceActivityLine } from '../platform/sourceProvider'

/** One line of the list: what was done, when, and by whom where that is not obvious. */
export type ActivityEntry = {
  summary: StepSummary
  /** Epoch milliseconds, as `Date.now()` gives them. */
  at: number
  /**
   * Not the person at this keyboard: the agent on this session (ADR-0007), or
   * another author whose step reached this model from elsewhere. The line says
   * which, because a change nobody here made appearing unattributed on the
   * board is indistinguishable from a fault.
   */
  origin?: 'agent' | 'remote'
  /** Who the other author was, where the step arrived with a name on it. */
  by?: string
  /**
   * What they made it with, where the step said: the line then reads *by
   * A. Author via their client*.
   *
   * The two are separate answers and the line says both, because one author
   * working from two clients and two authors are not the same thing to somebody
   * reading a log. Nothing at all where the step named no client, which is what
   * every step in this repository does.
   */
  via?: string
  /**
   * The step's name outside this session, and the names each announcement of
   * it went out under (`HistoryStep.stepId` and its `folds`). Read only to
   * list a step once where the source's log holds it too.
   */
  stepId?: string
  folds?: readonly { readonly changeId: string }[]
  /**
   * The editor made it by itself, not at anybody's asking (`HistoryStep`'s
   * own): never said to be the person's.
   */
  unattended?: boolean
}

/** A line as the list draws it: an entry, and whether it was the person's own. */
export type ActivityLine = ActivityEntry & {
  /**
   * The person's own step, said as *you*. Only where the source answered: over
   * a source with no log of its own every untagged line is theirs, and the list
   * has never needed to say so.
   */
  you?: boolean
}

/**
 * The session's steps and the source's log, as one list, oldest first.
 *
 * Nothing from the source is the stack as it is, word for word. Otherwise a
 * step the session holds — its own, published under the names of its
 * announcements, or somebody else's that arrived while the scope was open —
 * is dropped from the log's side, because the session's line knows more: the
 * name of a row it deleted, an agent's tag. Everything else in the log is
 * somebody's, and says whose.
 */
export function mergeActivity(
  entries: readonly ActivityEntry[],
  kept: readonly SourceActivityLine[] | undefined,
): ActivityLine[] {
  if (kept === undefined) return [...entries]
  const held = new Set<string>()
  for (const entry of entries) {
    if (entry.stepId !== undefined) held.add(entry.stepId)
    for (const fold of entry.folds ?? []) held.add(fold.changeId)
  }
  const fromLog: ActivityLine[] = kept
    .filter((line) => line.stepId === undefined || !held.has(line.stepId))
    .map((line) => ({
      summary: line.summary,
      at: line.at,
      ...(line.stepId !== undefined ? { stepId: line.stepId } : {}),
      // A layout the editor made by itself is nobody's: no author, no *you*.
      ...(line.unattended === true
        ? { unattended: true }
        : {
          ...(line.via !== undefined ? { via: line.via } : {}),
          ...(line.mine
            ? { you: true }
            : { origin: 'remote' as const, ...(line.by !== undefined ? { by: line.by } : {}) }),
        }),
    }))
  const fromSession: ActivityLine[] = entries.map((entry) => (
    entry.origin === undefined && entry.unattended !== true ? { ...entry, you: true } : entry
  ))
  // Stable, so two steps of one moment keep the order they were found in: the
  // log's before the session's, which is the order they happened in.
  return [...fromLog, ...fromSession].sort((a, b) => a.at - b.at)
}

export type ActivityMenuProps = {
  anchorEl: HTMLElement | null
  onClose: () => void
  /** Oldest first, as the stack holds them. */
  entries: readonly ActivityEntry[]
  /**
   * The source's own log of this scope, asked for each time the list opens
   * (`SourceRecentActivity`, bound to the open scope). Absent where the source
   * keeps none, and the list is then {@link entries} alone.
   */
  recent?: () => Promise<readonly SourceActivityLine[] | undefined>
  language: Language
  s: Translate
}

/**
 * What the source said, once the list is open: `undefined` until it has
 * answered, and where it answered nothing or could not be asked.
 */
function useKept(open: boolean, recent: ActivityMenuProps['recent']) {
  const [kept, setKept] = useState<readonly SourceActivityLine[] | undefined>(undefined)
  const [asking, setAsking] = useState(false)
  useEffect(() => {
    if (!open || !recent) {
      setKept(undefined)
      setAsking(false)
      return undefined
    }
    let gone = false
    setAsking(true)
    void recent().then(
      (said) => { if (!gone) { setKept(said); setAsking(false) } },
      // A log that could not be read is the stack alone, as with no log at all.
      () => { if (!gone) { setKept(undefined); setAsking(false) } },
    )
    return () => { gone = true }
  }, [open, recent])
  return { kept, asking }
}

/**
 * The lines themselves, newest first, for the Activity panel: read-only as a
 * record, and every line the same words the menu said.
 */
export function ActivityLines({ open = true, entries, recent, language, s }: Omit<ActivityMenuProps, 'anchorEl' | 'onClose'> & { open?: boolean }) {
  const { kept, asking } = useKept(open, recent)
  // Newest at the top, which is the order a person reads a log in and the
  // opposite of the order a stack keeps it.
  const lines = mergeActivity(entries, kept).reverse()
  if (lines.length === 0) {
    return <Typography sx={{ fontSize: 'var(--t-small)', color: 'text.secondary' }}>{s(asking ? 'shell.activityReading' : 'shell.activityEmpty')}</Typography>
  }
  return (
    <ul className="kit-lines" aria-label={s('shell.activity')}>
      {lines.map((entry, i) => (
        <li key={`${entry.at}-${i}`} className="kit-lines__row">
          <span data-testid="activity-summary">
            {s(entry.summary.key, {
              name: entry.summary.name ?? '—',
              count: entry.summary.count ?? 1,
              asOf: entry.summary.asOf ?? '',
              // What kind of row it was, in today's language rather than
              // the one it was drawn in (ADR-0012 §5).
              type: entry.summary.typeKey ? s(entry.summary.typeKey) : '',
              // Where a move took the scope from, and to.
              from: entry.summary.from ?? '',
              to: entry.summary.to ?? '',
            })}
          </span>
          <small>
            {(entry.origin !== undefined || entry.you || entry.unattended) && (
              <><span data-testid="activity-origin">{originWords(entry, s)}</span>{' · '}</>
            )}
            {/* The day as well as the time: a log a source keeps reaches back
                past today, and "09:12" alone would not say which morning. */}
            {formatMoment(entry.at, language)}
          </small>
        </li>
      ))}
    </ul>
  )
}

/** Whose a line is, in words: nobody's, the agent's, this person's, or the author's with the client beside it. */
function originWords(entry: ActivityLine, s: Translate): string {
  // Nobody's: a board laid out as it opened. Before any author, because
  // whoever's window it was did not do it.
  if (entry.unattended) return s('shell.activityUnattended')
  if (entry.origin === 'agent') return s('shell.activityAgent')
  // The person's own, where the list also holds everybody else's.
  if (entry.origin === undefined) return s(entry.via === undefined ? 'shell.activityYou' : 'shell.activityYouVia', { client: entry.via ?? '' })
  return s(entry.via === undefined ? 'shell.activityBy' : 'shell.activityByVia', { name: entry.by ?? s('shell.activityElsewhere'), client: entry.via ?? '' })
}
