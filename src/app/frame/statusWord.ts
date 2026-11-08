// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The status word: the one thing on the frame that says whether work is safe,
 * and so the one thing that may never say anything false.
 *
 * A source whose changes travel as steps has no save to report, and *All
 * changes sent* is only true while somebody is there to send them to: with no
 * connection the word says so, ahead of everything but a state a person has to
 * act on. Which is why the connection is asked here, in the same function, and
 * not beside it where the two could disagree.
 */
import type { Language, StringKey, Translate } from '../../i18n'
import type { DocumentStatus } from '../../projects/documentSession'
import type { SourceWord, StatusTone } from '../../ports/ProviderParts'
import { clockTime } from '../clockTime'
import type { OwnWork } from './frameStore'

export type StatusFacts = {
  /** Absent: nothing is open, so nothing is waiting here. */
  readonly status?: DocumentStatus | undefined
  readonly saveFailed?: boolean | undefined
  readonly savedAt?: Date | null | undefined
  readonly publishesSteps?: boolean | undefined
  readonly sourceStatus?: boolean | undefined
  /** The source's own answer; absent where it has no connection to lose. */
  readonly connected?: boolean | undefined
  /** Where the work is, in the source's word: said after the state, so one word answers both questions. */
  readonly place?: string | undefined
  /** The place is the one this window started in: the panel says it, so a save says its time alone. */
  readonly placeAsStarted?: boolean | undefined
  /** Nothing here outlives this tab, so that is what the word says while nothing is wrong. */
  readonly transient?: boolean | undefined
  /** ...which is nothing to worry about in the example, where nothing being kept is the point. */
  readonly visiting?: boolean | undefined
  /** What the source says of itself, ahead of all this: it alone knows what a change has met on the way. */
  readonly source?: SourceWord | undefined
  /** An editor's work, which the model does not hold yet: what is true of the screen while it is up. */
  readonly own?: OwnWork | undefined
  /**
   * A write made outside the open session that did not land and has been
   * neither made again nor put back (`app/writeRefusals`): ahead of
   * everything, because every other word here would call that work safe.
   */
  readonly refused?: boolean | undefined
  /** The place's own word for a change it would not take (`SourceProvider.refusedWordKey`), as the toast names it. */
  readonly refusedWordKey?: StringKey | (string & {}) | undefined
}

const WORDS: Partial<Record<DocumentStatus, StringKey>> = {
  dirty: 'shell.unsaved', saving: 'shell.saving', 'external-changed': 'shell.changedElsewhere', conflict: 'shell.conflict',
}

export type StatusWord = { readonly text: string; readonly alarm: boolean; readonly tone: StatusTone; readonly short?: string }

const said = (text: string, tone: StatusTone): StatusWord => ({ text, tone, alarm: tone === 'problem' || tone === 'waiting' })

/** A mark for each tone: the shape carries it, for a greyscale print and for anybody who cannot tell the colours apart. */
export const TONE_MARK: Readonly<Record<StatusTone, string>> = { saved: '✓', busy: '◌', waiting: '▲', offline: '○', problem: '●', reading: '◉' }

/**
 * A word's first words, and the rest: what a word that is not calm keeps where
 * the row runs out (*Offline:*, *Not saved*, *Signed out*), and what may then
 * go to an ellipsis. Cut at its first ` · `, `: ` or ` — `, the colon kept with
 * the head; a word with none of them is all head.
 */
export function statusHead(text: string): { head: string; tail: string } {
  const cuts = [' · ', ': ', ' — '].map((mark) => ({ mark, at: text.indexOf(mark) })).filter(({ at }) => at > 0)
  if (cuts.length === 0) return { head: text, tail: '' }
  const { mark, at } = cuts.reduce((first, one) => (one.at < first.at ? one : first))
  const end = mark === ': ' ? at + 1 : at
  return { head: text.slice(0, end), tail: text.slice(end) }
}

function ownWord(own: OwnWork, language: Language, s: Translate): StatusWord {
  switch (own.state) {
    case 'clean': return said(s('frame.ownClean'), 'saved')
    case 'dirty': return said(s('shell.notSaved'), 'busy')
    case 'saving': return said(s('shell.saving'), 'busy')
    case 'failed': return said(s('frame.ownFailed'), 'problem')
    case 'saved': return said(own.savedAt ? s('shell.saved', { time: clockTime(own.savedAt, language) }) : s('frame.ownClean'), 'saved')
  }
}

/** A save's time, with the place after it only where the window has moved since it started: the panel says the first. */
function savedWord(savedAt: Date, { place, placeAsStarted }: StatusFacts, language: Language, s: Translate): string {
  const saved = s('shell.saved', { time: clockTime(savedAt, language) })
  return place && !placeAsStarted ? `${saved} · ${place}` : saved
}

export function statusWord(facts: StatusFacts, language: Language, s: Translate): StatusWord {
  return facts.refused ? refusedWord(facts, s) : keptWord(facts, language, s)
}

/** *Not saved*, with the place that refused where the source names one, as its toast and *Your work* do. */
function refusedWord(facts: StatusFacts, s: Translate): StatusWord {
  return said(s((facts.refusedWordKey ?? 'shell.saveRefused') as StringKey), 'problem')
}

/** The word where nothing written outside the open session is waiting to be tried again. */
function keptWord(facts: StatusFacts, language: Language, s: Translate): StatusWord {
  const { status, saveFailed, savedAt, publishesSteps, sourceStatus, connected, place, transient, source, own } = facts
  if (own) return ownWord(own, language, s)
  if (source) return { text: source.text, tone: source.tone, alarm: source.tone === 'problem' || source.tone === 'waiting', ...(source.short === undefined ? {} : { short: source.short }) }
  if (saveFailed) return refusedWord(facts, s)
  if (status === 'conflict' || status === 'external-changed') return said(s(WORDS[status]!), 'problem')
  if (connected === false) {
    const waiting = status === 'dirty' || status === 'saving'
    return waiting ? said(s('frame.offlineWaiting'), 'waiting') : said(s('frame.offline'), 'offline')
  }
  if (transient && place && status !== 'dirty' && status !== 'saving') return said(place, facts.visiting ? 'saved' : 'waiting')
  if (status === undefined) return said(place ?? s('frame.nothingWaiting'), 'saved')
  if (publishesSteps) {
    if (!sourceStatus) return { text: '', alarm: false, tone: 'saved' }
    return status === 'dirty' || status === 'saving' ? said(s('shell.stepsSending'), 'busy') : said(s('shell.stepsSent'), 'saved')
  }
  const word = WORDS[status]
  if (word) return said(s(word), 'busy')
  if (savedAt) return said(savedWord(savedAt, facts, language, s), 'saved')
  // Clean and not written this session is what was read: kept where it is, which is the one thing to say.
  return said(place ?? s('shell.notSaved'), 'saved')
}
