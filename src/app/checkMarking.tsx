// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Marking a finding as intended, and taking a mark back, from any list of
 * findings (ADR-0036, amended 11 October 2026; `model/checkMarks.ts` for
 * what a mark is).
 *
 * **Kept in the scope of the finding's first subject** (`checkMarkScope`):
 * the scope the finding is about, the scope the dates were checked in, or
 * where the Conway map's row, application or unit is kept. A Conway map's
 * finding about something the open scope's session holds is kept there, even
 * before the index has read it.
 *
 * **Written the way the app changes that scope.** Where it is the scope that
 * is open, the mark is a command through its session: one step, one undo, in
 * its Activity list at once. Anywhere else it is that scope's step, written
 * through the source's repositories under that scope's rights
 * (`units/writeIn.ts`), the way *Served by* and *Responsible for* write a
 * link kept elsewhere — never a step on the open session, whose undo would
 * otherwise take back another scope's mark. A scope the person may only read
 * offers no mark and no *Take back*; neither does a fix, which is fixed in
 * the model, nor a finding the tree knows nowhere to keep.
 *
 * **Handed down as a context**, from the workspace and from a home, so every
 * list in either — a unit's checks, the chart's summary, the Conway map, a
 * plan's *Still open*, the Checks page — reaches it without each page between
 * carrying it. A list drawn with none, in a test or a page on its own, splits
 * by the marks it was given and offers no mark.
 */
import { createContext, useContext, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import type { StringKey } from '../i18n'
import type { Command } from '../model'
import { CHECK_MARK_WORDS, checkMarkFor, checkMarkId, findingCheck, isMarkable, splitMarked } from '../model/checkMarks'
import type { AnyFinding, CheckMark, KeptCheckMark } from '../model/checkMarks'
import type { ConwayFinding } from '../model/conway'
import type { HostModel } from '../model/hostModel'
import { checkMarkScope, checkMarksHere } from '../projects/checkMarks'
import type { ScopeIndex } from '../projects/scopeIndex'
import type { ScopePath } from '../projects/scopePath'
import { AcceptedFindings, MarkAsIntended } from '../widgets/FindingMarks'
import type { AcceptedFinding } from '../widgets/FindingMarks'
import { refusalKey } from './units/writeIn'
import type { WriteIn } from './units/writeIn'

/** What a list asks of the marks: which hold, where a finding's may be made, and the two moves. */
export type CheckMarking = {
  /** The tree's marks, the open scope's as its session holds them now. */
  marks: readonly KeptCheckMark[]
  /**
   * The scope a finding's mark would be kept in, where it may be made here:
   * nothing for a fix, a finding the tree knows nowhere to keep, or a scope
   * the person may only read. `checkedIn` is the scope a date finding was
   * checked in.
   */
  markableIn: (finding: AnyFinding, checkedIn?: ScopePath) => ScopePath | undefined
  /** Mark it as intended, with the reason given; a blank one is none. */
  mark: (finding: AnyFinding, reason: string, checkedIn?: ScopePath) => void
  /** May a mark kept in this scope be taken back here. */
  mayTakeBack: (scope: ScopePath) => boolean
  takeBack: (kept: KeptCheckMark) => void
}

/** The scope that is open, as marking reads and writes it: through its session. */
export type OpenForMarking = {
  scope: ScopePath
  /** The model as the session holds it now. */
  model: Pick<HostModel, 'elements' | 'relations' | 'checkMarks'>
  dispatch: (command: Command) => unknown
  /** May the session write: the scope is not only read here. */
  writable: boolean
}

export const CheckMarkingContext = createContext<CheckMarking | undefined>(undefined)

/** The marking of the screen this is drawn in, where it has one. */
export function useCheckMarking(): CheckMarking | undefined {
  return useContext(CheckMarkingContext)
}

/** Whether the open scope's session keeps what a Conway map's finding is about, as its first subject. */
function heldHere(model: OpenForMarking['model'], finding: ConwayFinding): boolean {
  const row = (id: string) => model.relations.some((one) => one.id === id)
  const own = (id: string) => model.elements.some((one) => one.id === id && one.ref === undefined)
  switch (finding.kind) {
    case 'undeclared': return row(finding.flow.id)
    case 'unused': return row(finding.interaction.id)
    case 'unowned': return own(finding.applicationId)
    case 'overLimit': return own(finding.unitId)
  }
}

const isConway = (finding: AnyFinding): finding is ConwayFinding => !('scope' in finding && 'key' in finding) && !('subject' in finding)

/** A mark already kept in a scope, by its id. */
const holds = (marks: readonly CheckMark[] | undefined, id: string) => (marks ?? []).some((one) => checkMarkId(one) === id)

export function checkMarking(deps: {
  index: Pick<ScopeIndex, 'checkMarks' | 'lookup' | 'rowsOf'>
  /** The scope open in the workspace; none on a home. */
  open?: OpenForMarking | undefined
  /** May the person change the scope at this path. */
  writable: (path: ScopePath) => boolean
  /** A change to a scope other than the open one, as its step; absent: only the open scope's marks are made here. */
  writeIn?: WriteIn | undefined
  /** The day a mark is made on. */
  today: string
  /** Where a mark that did not land is said: by its refusal's key. */
  onRefused?: ((key: StringKey) => void) | undefined
}): CheckMarking {
  const { index, open, writable, writeIn, today, onRefused } = deps
  const here = (scope: ScopePath) => open !== undefined && scope === open.scope
  const keptAt = (finding: AnyFinding, checkedIn?: ScopePath) => (
    open && isConway(finding) && heldHere(open.model, finding) ? open.scope : checkMarkScope(index, finding, checkedIn)
  )
  const mayWrite = (scope: ScopePath) => (here(scope) ? open?.writable === true : writeIn !== undefined && writable(scope))
  /** One move on the scope that keeps the mark: through the session where it is open, else as that scope's step. */
  const write = (scope: ScopePath, command: Command, unchanged: (marks: readonly CheckMark[] | undefined) => boolean) => {
    if (here(scope)) { open?.dispatch(command); return }
    void writeIn?.(scope, (held) => (unchanged(held.model.checkMarks) ? undefined : [command])).then(
      (written) => { const key = refusalKey(written); if (key) onRefused?.(key) },
      () => onRefused?.('pick.notWritten'),
    )
  }
  return {
    marks: open ? checkMarksHere(index, open.scope, open.model) : index.checkMarks(),
    markableIn: (finding, checkedIn) => {
      if (!isMarkable(findingCheck(finding))) return undefined
      const scope = keptAt(finding, checkedIn)
      return scope !== undefined && mayWrite(scope) ? scope : undefined
    },
    mark: (finding, reason, checkedIn) => {
      if (!isMarkable(findingCheck(finding))) return
      const scope = keptAt(finding, checkedIn)
      if (scope === undefined || !mayWrite(scope)) return
      const made = checkMarkFor(finding, { on: today, reason })
      write(scope, { type: 'checkMark.add', mark: made }, (marks) => holds(marks, checkMarkId(made)))
    },
    mayTakeBack: mayWrite,
    takeBack: ({ scope, mark }) => {
      if (!mayWrite(scope)) return
      const id = checkMarkId(mark)
      write(scope, { type: 'checkMark.remove', id }, (marks) => !holds(marks, id))
    },
  }
}

/** What a list draws for the marks: the findings still shown, *Mark as intended…* under an explanation, and *Accepted (N)*. */
export type FindingMarkSlots<I> = {
  shown: I[]
  more: (item: I) => ReactNode
  accepted: ReactNode
}

/**
 * A list's items split by the marks, and its two places for them filled
 * (`widgets/FindingsList`'s `more` and `accepted`). An item is a finding, or
 * a line said from one (`findingOf`); a line said from none — a plan's
 * interaction to declare — is always shown and never marked.
 */
export function useFindingMarks<I>(items: readonly I[], how: {
  findingOf: (item: I) => AnyFinding | undefined
  sentence: (item: I) => string
  /** The scope the dates were checked in, for a list of theirs. */
  checkedIn?: ScopePath | undefined
  /** The marks a list drawn with no marking is split by: the screen's own reading. */
  marks?: readonly KeptCheckMark[] | undefined
  /** Where the session keeps whether *Accepted* is open: beside the list's own folds. */
  remember?: string | undefined
}): FindingMarkSlots<I> {
  const marking = useCheckMarking()
  const marks = marking?.marks ?? how.marks
  const { checkedIn } = how
  // Read through a ref: the screens hand these in as lambdas, and the split is about the items and the marks.
  const said = useRef(how)
  said.current = how
  const split = useMemo(() => {
    const found = new Map<I, AnyFinding>()
    for (const item of items) {
      const finding = said.current.findingOf(item)
      if (finding) found.set(item, finding)
    }
    const { marked } = splitMarked([...found.values()], marks ?? [], checkedIn !== undefined ? { scope: checkedIn } : {})
    const byFinding = new Map(marked.map((one) => [one.finding, one]))
    return {
      found,
      shown: items.filter((item) => !byFinding.has(found.get(item) as AnyFinding)),
      marked: items.flatMap((item) => {
        const one = byFinding.get(found.get(item) as AnyFinding)
        return one ? [{ item, mark: one.mark, scope: one.scope }] : []
      }),
    }
  }, [items, marks, checkedIn])
  const more = (item: I): ReactNode => {
    const finding = split.found.get(item)
    if (!marking || !finding || marking.markableIn(finding, checkedIn) === undefined) return null
    return <MarkAsIntended words={CHECK_MARK_WORDS} sentence={how.sentence(item)} onMark={(reason) => marking.mark(finding, reason, checkedIn)} />
  }
  const accepted: AcceptedFinding[] = split.marked.map(({ item, mark, scope }, at) => ({
    key: `${scope}\u0000${checkMarkId(mark)}\u0000${at}`,
    sentence: how.sentence(item),
    reason: mark.reason,
    on: mark.on,
    onTakeBack: marking?.mayTakeBack(scope) ? () => marking.takeBack({ scope, mark }) : undefined,
  }))
  return {
    shown: split.shown,
    more,
    accepted: <AcceptedFindings items={accepted} words={CHECK_MARK_WORDS} remember={how.remember} />,
  }
}
