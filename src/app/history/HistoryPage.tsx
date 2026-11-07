// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every snapshot of this folder, and what changed since one of them.
 *
 * The diff is **semantic** and that is the whole reason this page exists rather
 * than a link to a git client. `git log -p` over a landscape folder is a
 * perfectly good answer to "which lines changed" and a useless answer to "what
 * happened to the architecture": a tidy pass is four hundred changed lines and
 * one sentence, and the sentence is what somebody comes here for
 * (`model/diff.ts`).
 *
 * Compared with **the project as it is now**, not with the snapshot before it.
 * The question people actually have in front of a history is "what has happened
 * since then", and answering the other one would need two selections to ask.
 *
 * Rows by day, one line each, and a snapshot read large over the list. The heavy
 * act of putting the whole scope back is out of the way under ⋯, and a record
 * that can no longer change says so in a sentence rather than a dead button.
 *
 * **Or of one thing** (ADR-0008). The subject picker narrows the page to a
 * diagram, a description or a decision: the list is then the snapshots that
 * touched it, and the changes are the rows about it. The diff is still the
 * model's — nothing here knows a path — the page only chooses which rows to
 * speak.
 */
import { useMemo, useState } from 'react'
import { countChanges, diffModels } from '../../model/diff'
import type { ModelChange } from '../../model/diff'
import type { HostModel } from '../../model/hostModel'
import { isAdrLocked } from '../../model/adr'
import { STATUS_LABEL } from '../../decisions/adrScope'
import { formatDay } from '../../i18n/dates'
import { LOCALE } from '../../i18n'
import type { Language, Translate } from '../../i18n'
import { PageDialog } from '../../widgets/PageDialog'
import { Button } from '../../widgets/kit/Button'
import { List } from '../../widgets/kit/List'
import type { ListGroup } from '../../widgets/kit/List'
import { MoreMenu } from '../../widgets/kit/Menu'
import type { MenuEntry } from '../../widgets/kit/Menu'
import { PageState } from '../../widgets/kit/PageState'
import { Preview, PreviewFact } from '../../widgets/kit/Preview'
import type { HistoryEntry } from '../../ports/HistoryRepository'
import type { HistorySubject } from './subjects'
import { changeLine } from './changeLine'
import { changesFor } from './changesFor'
import { LabelDialog } from './LabelDialog'
import { RestoreDialog } from './RestoreDialog'
import './HistoryPage.css'

export type HistoryPageProps = {
  open: boolean
  onClose: () => void
  /** Newest first, as the seam hands them over. */
  entries: readonly HistoryEntry[]
  /** The model at the selected snapshot; `undefined` while it is being read. */
  chosen?: { id: string; model?: HostModel }
  /** A snapshot read, or let go of. */
  onChoose: (id: string | undefined) => void
  /** What is on screen now — the other side of every comparison. */
  current: HostModel
  /** Whose history this is; absent is the whole project's. */
  subject?: HistorySubject
  onSubjectChange: (subject: HistorySubject | undefined) => void
  /**
   * Every scope the subject is filed in, this one first (ADR-0012 §7).
   *
   * An element's page is filed in the scope that answers for it and in every
   * scope that draws it, so the list below is the union of those files'
   * commits — and a person looking at it should be able to see that. One entry
   * or none is the ordinary case and says nothing.
   */
  scopes?: readonly string[]
  /** Make the subject, or the whole project, what the chosen snapshot held (ADR-0008). */
  onRestore: () => void
  /**
   * The scope could not be read whole: going back puts all of it back
   * (`projects/putBack.ts`), and is offered even where what could be read
   * is what the snapshot held — the part that could not is not.
   */
  whole?: boolean
  /**
   * Save what the chosen entry kept of the scope that could not be read, as a
   * file the person keeps (`HistoryEntry.unread`); absent where the history
   * cannot give it.
   */
  onSaveUnread?: (entry: HistoryEntry) => void
  /** Call the chosen snapshot something (ADR-0008). */
  onLabel: (name: string) => void
  /** *Snapshot…*, at the head; absent where nothing here may be written. */
  onSnapshot?: () => void
  language: Language
  s: Translate
}

/** The picker's value: one string per subject, and the empty one for everything. */
const encode = (subject: HistorySubject | undefined): string => (subject ? `${subject.what}:${subject.id}` : '')
function decode(value: string): HistorySubject | undefined {
  const at = value.indexOf(':')
  if (at < 0) return undefined
  const what = value.slice(0, at)
  if (what !== 'diagram' && what !== 'description' && what !== 'decision') return undefined
  return { what, id: value.slice(at + 1) }
}

function when(at: number, language: Language): string {
  return new Date(at).toLocaleString(LOCALE[language], {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

/** A day as the list heads it; the calendar's, as the person's clock reads it. */
function dayOf(at: number): string {
  const date = new Date(at)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * What an entry is called on the page: what it says it was, or — for a move
 * (`HistoryEntry.moved`) — the move, in the language on screen, whatever a
 * source wrote beside it.
 */
function titleOf(entry: HistoryEntry, s: Translate): string {
  return entry.moved ? s('activity.scopeMoved', { from: entry.moved.from, to: entry.moved.to }) : entry.subject ?? ''
}

/** The counts in words: four glyphs with no words need the manual. */
export function changesInWords(changes: readonly ModelChange[], s: Translate): string {
  const counts = countChanges(changes)
  const said = [
    counts.added > 0 && s('history.nAdded', { count: counts.added }),
    counts.removed > 0 && s('history.nRemoved', { count: counts.removed }),
    counts.changed > 0 && s('history.nChanged', { count: counts.changed }),
    counts.moved > 0 && s('history.nMoved', { count: counts.moved }),
  ].filter((one): one is string => typeof one === 'string')
  return s('history.since', { what: said.join(', ') })
}

/** Every line once, with how many times it came: a list that repeats itself reads as more than it says. */
export function mergedLines(lines: readonly string[]): readonly { line: string; count: number }[] {
  const seen = new Map<string, number>()
  for (const line of lines) seen.set(line, (seen.get(line) ?? 0) + 1)
  return [...seen].map(([line, count]) => ({ line, count }))
}

/** What the page can be asked about: every diagram, every described element, every decision. */
function SubjectPicker({ current, subject, onChange, s }: {
  current: HostModel; subject: HistorySubject | undefined; onChange: (subject: HistorySubject | undefined) => void; s: Translate
}) {
  const groups = useMemo(() => [
    { what: 'diagram' as const, label: s('history.diagrams'), held: current.diagrams.map((one) => ({ id: one.id, name: one.name })) },
    { what: 'description' as const, label: s('history.descriptions'), held: current.elements.filter((one) => one.description !== undefined).map((one) => ({ id: one.id, name: one.name })) },
    { what: 'decision' as const, label: s('history.decisions'), held: (current.decisions ?? []).map((one) => ({ id: one.id, name: one.title })) },
  ], [current, s])
  return (
    <label className="history-subject">
      {s('history.subject')}
      <select value={encode(subject)} onChange={(event) => onChange(decode(event.target.value))}>
        <option value="">{s('history.everything')}</option>
        {groups.filter((group) => group.held.length > 0).map((group) => (
          <optgroup key={group.what} label={group.label}>
            {group.held.map((one) => <option key={one.id} value={encode({ what: group.what, id: one.id })}>{one.name}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

/** The list by day: rows are the item, a label beside it where it has one. */
function groupedByDay(entries: readonly HistoryEntry[], language: Language, s: Translate): readonly ListGroup[] {
  const days = new Map<string, HistoryEntry[]>()
  for (const entry of entries) {
    const day = dayOf(entry.at)
    days.set(day, [...(days.get(day) ?? []), entry])
  }
  return [...days].map(([day, held]) => ({
    id: day, label: formatDay(day, language),
    rows: held.map((entry) => ({ id: entry.id, text: titleOf(entry, s), ...(entry.labels.length > 0 ? { note: entry.labels.join(', ') } : {}) })),
  }))
}

/**
 * What the restore would be called, from the project as it is now — or, for a
 * thing that is gone now, from the snapshot, which still has it.
 */
function nameOfSubject(subject: HistorySubject | undefined, current: HostModel, at: HostModel | undefined): string | undefined {
  if (!subject) return undefined
  const from = (model: HostModel | undefined) => {
    if (!model) return undefined
    switch (subject.what) {
      case 'diagram': return model.diagrams.find((held) => held.id === subject.id)?.name
      case 'description': return model.elements.find((held) => held.id === subject.id)?.name
      case 'decision': return (model.decisions ?? []).find((held) => held.id === subject.id)?.title
    }
  }
  return from(current) ?? from(at) ?? subject.id
}

/** A decision that has ended stays as it is, so no version of it can be put back: said, and no dead button. */
function refusalOf(subject: HistorySubject | undefined, current: HostModel, s: Translate): string | undefined {
  const ended = subject?.what === 'decision' ? (current.decisions ?? []).find((one) => one.id === subject.id) : undefined
  return ended && isAdrLocked(ended) ? s('history.lockedDecision', { status: s(STATUS_LABEL[ended.status]).toLowerCase() }) : undefined
}

/** What can be done with the snapshot being read. Putting the whole scope back is the heaviest act there is, so it is under ⋯. */
function SnapshotFoot({ entry, changes, subject, whole, refusal, onSaveUnread, onRestore, onLabel, s }: {
  entry: HistoryEntry
  changes: readonly ModelChange[] | undefined
  subject: HistorySubject | undefined
  whole: boolean
  refusal: string | undefined
  onSaveUnread: HistoryPageProps['onSaveUnread']
  onRestore: () => void
  onLabel: () => void
  s: Translate
}) {
  const changed = (changes?.length ?? 0) > 0
  const more: MenuEntry[] = [
    ...(entry.unread && onSaveUnread ? [{ label: s('history.saveUnread'), onSelect: () => onSaveUnread(entry) }] : []),
    ...(changes && !subject && !whole ? [{
      label: s('history.restoreProject'), final: true, onSelect: onRestore,
      ...(changed ? {} : { refused: s('history.unchanged') }),
    }] : []),
  ]
  return (
    <div className="history-foot">
      {refusal && <p data-testid="history-refused">{refusal}</p>}
      {changes && whole && <Button variant="primary" onClick={onRestore} data-testid="history-restore">{s('history.putBack')}</Button>}
      {changes && subject && !whole && !refusal && (
        <Button onClick={onRestore} data-testid="history-restore" {...(changed ? {} : { reason: s('history.unchangedFor') })}>{s('history.restore')}</Button>
      )}
      <Button onClick={onLabel}>{s('history.label')}</Button>
      <span className="history-foot__grow" />
      {more.length > 0 && <MoreMenu items={more} />}
    </div>
  )
}

/** What changed since the snapshot being read, in words, each repeated line once. */
function SinceSnapshot({ chosen, changes, subject, s }: {
  chosen: HistoryPageProps['chosen']; changes: readonly ModelChange[] | undefined; subject: HistorySubject | undefined; s: Translate
}) {
  return (
    <div data-testid="history-diff">
      {chosen && !chosen.model && <p>{s('history.gone')}</p>}
      {changes && changes.length === 0 && <p>{s(subject ? 'history.unchangedFor' : 'history.unchanged')}</p>}
      {changes && changes.length > 0 && (
        <>
          <h3 className="history-since">{changesInWords(changes, s)}</h3>
          <ul className="history-changes">
            {mergedLines(changes.map((change) => changeLine(change, s))).map(({ line, count }) => (
              <li key={line}>{count > 1 ? s('history.repeated', { line, count }) : line}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function SnapshotFacts({ entry, language, s }: { entry: HistoryEntry; language: Language; s: Translate }) {
  return (
    <>
      <PreviewFact label={s('history.when')}>{when(entry.at, language)}</PreviewFact>
      <PreviewFact label={s('history.who')}>{s('history.by', { author: entry.by })}</PreviewFact>
      {entry.labels.length > 0 && <PreviewFact label={s('history.labels')}>{entry.labels.join(', ')}</PreviewFact>}
    </>
  )
}

export function HistoryPage(props: HistoryPageProps) {
  const {
    open, onClose, entries, chosen, onChoose, current, subject, onSubjectChange,
    scopes = [], onRestore, whole = false, onLabel, language, s,
  } = props
  const [confirming, setConfirming] = useState(false)
  const [labelling, setLabelling] = useState(false)
  const groups = useMemo(() => groupedByDay(entries, language, s), [entries, language, s])
  const changes: ModelChange[] | undefined = useMemo(
    () => (chosen?.model ? changesFor(diffModels(chosen.model, current), subject) : undefined),
    [chosen, current, subject],
  )
  const subjectName = useMemo(() => nameOfSubject(subject, current, chosen?.model), [subject, current, chosen])
  const chosenEntry = entries.find((entry) => entry.id === chosen?.id)

  return (
    <PageDialog open={open} onClose={onClose} aria-label={s('history.title')}>
      <div className="history-page">
        <div className="history-page__inner">
          <header className="history-page__head">
            <h1>{s('history.title')}</h1>
            <SubjectPicker current={current} subject={subject} onChange={onSubjectChange} s={s} />
            <span className="history-foot__grow" />
            {props.onSnapshot && <Button onClick={props.onSnapshot}>{s('history.snapshot')}</Button>}
          </header>
          {/* Where the list is coming from, when it is coming from more than one
              scope (ADR-0012 §7) — and the half of that a person has to know: a
              restore is one command on one session, so it puts back what THIS
              scope holds. */}
          {subject && scopes.length > 1 && (
            <div className="history-everywhere" data-testid="history-everywhere">
              <p>{s('history.everywhere', { scopes: scopes.join(' · ') })}</p>
              <p>{s('history.restorePerScope')}</p>
            </div>
          )}
          {entries.length === 0
            ? <PageState compact state="empty" title={s(subject ? 'history.noneFor' : 'history.none')} />
            : (
              <div data-testid="history-list">
                <List label={s('history.title')} groups={groups} selectedId={chosen?.id ?? null} onOpen={onChoose} />
              </div>
            )}
        </div>
      </div>
      <Preview
        ids={entries.map((entry) => entry.id)}
        currentId={chosen?.id ?? null}
        onSelect={(id) => onChoose(id ?? undefined)}
        title={chosenEntry ? titleOf(chosenEntry, s) : ''}
        foot={chosenEntry && (
          <SnapshotFoot
            entry={chosenEntry} changes={changes} subject={subject} whole={whole} refusal={refusalOf(subject, current, s)}
            onSaveUnread={props.onSaveUnread} onRestore={() => setConfirming(true)} onLabel={() => setLabelling(true)} s={s}
          />
        )}
        facts={chosenEntry && <SnapshotFacts entry={chosenEntry} language={language} s={s} />}
      >
        <SinceSnapshot chosen={chosen} changes={changes} subject={subject} s={s} />
      </Preview>
      <LabelDialog
        open={labelling}
        onCancel={() => setLabelling(false)}
        onLabel={(name) => { setLabelling(false); onLabel(name) }}
        s={s}
      />
      <RestoreDialog
        open={confirming}
        name={subjectName}
        date={chosenEntry ? when(chosenEntry.at, language) : ''}
        whole={whole}
        onCancel={() => setConfirming(false)}
        onRestore={() => { setConfirming(false); onRestore() }}
        s={s}
      />
    </PageDialog>
  )
}
