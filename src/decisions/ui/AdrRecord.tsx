// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One decision, read: the large preview over the list. Where it stands is said
 * once, by a stepper and one sentence under the title; the foot names the one
 * thing that happens next, and what acceptance still needs is beside the text
 * from the first draft, each line going to where it is answered.
 *
 * Reading writes nothing. Everything that changes the text is in `AdrWriting`,
 * and what is left here to press is a move, a citation or a comment, each of
 * which says what it does.
 */
import { useMemo, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import type { Language, Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import { linkElementRefs, outline } from '../../documentation'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import { formatAdrNumber, isAdrDeletable, isAdrLocked, selfAccepted, supersededByUnaccepted } from '../adr'
import type { Adr, AdrGateItem, AdrStatus } from '../adr'
import { movesOf, stepsOf } from '../adrList'
import { writtenBody } from '../adrSections'
import type { Solution } from '../../model/observation'
import { transitionLabel } from '../../model/transition'
import type { Transition } from '../../model/transition'
import { usePersonNames } from '../../people/ui/names'
import type { PersonNames } from '../../people/ui/names'
import { CommentThread } from '../../comments/ui/threadPart'
import { RecordChanges } from '../../comments/ui/RecordChanges'
import { CitationsSection } from '../../principles/ui/CitationsSection'
import { Button } from '../../widgets/kit/Button'
import { RecordActions } from '../../widgets/kit/RecordActions'
import type { MenuEntry } from '../../widgets/kit/Menu'
import { NextStep, StepLadder } from '../../widgets/kit/NextStep'
import type { NextAction } from '../../widgets/kit/NextStep'
import { Preview, PreviewFact } from '../../widgets/kit/Preview'
import { AdrGateList, proposerText, SignersRead, stillOpen } from './AdrParts'

export type AdrRecordProps = {
  /** The record up; nothing is the preview closed. */
  adr: Adr | undefined
  /** The list's order, as drawn, for walking it. */
  ids: readonly string[]
  /** The same list the record sits in, to resolve links in both directions. */
  list: readonly Adr[]
  /** Not to be changed from here: only read, or kept in a scope above. */
  locked: boolean
  /** The scope above that keeps it, by name and path: read here, edited there (ADR-0012 §7). */
  above?: { name: string; path: string; onOpen?: () => void }
  /** What it is about, where that is not the scope itself. */
  about?: string
  s: Translate
  language: Language
  /** For `[[Name]]` links; the project's elements, or none for a record from above. */
  elements: readonly { id: string; name: string }[]
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  onSelect: (id: string | null) => void
  onWrite: (at?: AdrGateItem) => void
  /** A status move. Accepting, rejecting and superseding are completed by the page's dialogs. */
  onStatus: (next: AdrStatus) => void
  onDelete: () => void
  onHistory?: () => void
  onCopyLink?: () => void
  onElementLink?: (elementId: string) => void
  plans?: { list: readonly Transition[]; onOpen(transitionId: string): void }
  solutions?: { list: readonly Pick<Solution, 'id' | 'number' | 'title' | 'decision'>[]; onOpen(solutionId: string): void }
}

/** `SO-0003`, as the observations page writes it. Said here: `decisions` may not import `observations`, and a label is one line. */
function solutionLabel(number: number): string {
  return `SO-${String(Math.max(0, Math.trunc(number))).padStart(4, '0')}`
}

/** A record as its list names it: number and title. */
function namer(list: readonly Adr[]): (id: string) => string {
  return (id) => {
    const found = list.find((a) => a.id === id)
    return found ? `${formatAdrNumber(found.number)} ${found.title}` : id
  }
}

function standingSentence(adr: Adr, s: Translate, day: string): string {
  switch (adr.status) {
    case 'proposed': return s('adr.saidProposed', { day })
    case 'reviewing': return s('adr.saidReviewing', { day })
    case 'accepted': return s('adr.saidAccepted', { day })
    case 'rejected': return s('adr.saidRejected', { day })
    case 'superseded': return s('adr.saidSuperseded', { day })
  }
}

/** Under the title, once: where it stands, who proposed it, why it ended. Status, date and reason are said here and nowhere else. */
function Standing({ adr, above, about, names, s, day }: Pick<AdrRecordProps, 'adr' | 'above' | 'about'> & { names: PersonNames; s: Translate; day: string }) {
  if (!adr) return null
  const proposer = proposerText(adr, names)
  return (
    <>
      <p className="adr-standing" data-testid="adr-status" data-guide="decision.status">
        {standingSentence(adr, s, day)}
        {adr.reason && <span data-testid="adr-reason"> {s('adr.saidReason', { reason: adr.reason })}</span>}
        {proposer && <> {s('adr.saidProposedBy')} <span data-testid="adr-proposed-by">{proposer}</span>.</>}
        {about && <> {s('adr.saidAbout', { about })}</>}
      </p>
      {above && (
        <p className="adr-standing" data-testid="adr-from-ancestor" data-guide="decisions.fromAbove">{s('adr.fromAncestor', { scope: above.name })}</p>
      )}
    </>
  )
}

/** One line of links to other records. Nothing when there are none. */
function LinkLine({ term, links, testId }: { term: string; links: readonly { key: string; label: string; onOpen: () => void }[]; testId?: string }) {
  if (links.length === 0) return null
  return (
    <p className="adr-links" data-testid={testId}>
      {term}{' '}
      {links.map((link, at) => (
        <span key={link.key}>
          {at > 0 && ', '}
          <button type="button" className="adr-link" onClick={link.onOpen}>{link.label}</button>
        </span>
      ))}
    </p>
  )
}

/** What the record is tied to, both ways: its successor and what it replaces, what it was decided for, what rests on it. */
function Links({ adr, list, onSelect, plans, solutions, s }: Pick<AdrRecordProps, 'list' | 'onSelect' | 'plans' | 'solutions' | 's'> & { adr: Adr }) {
  const nameOf = namer(list)
  const to = (id: string) => ({ key: id, label: nameOf(id), onOpen: () => onSelect(id) })
  const pending = adr.status === 'accepted' || adr.status === 'superseded' ? [] : adr.supersedes ?? []
  return (
    <>
      <LinkLine term={s('adr.supersededByLine')} links={adr.supersededBy && list.some((a) => a.id === adr.supersededBy) ? [to(adr.supersededBy)] : []} testId="adr-superseded-by" />
      <LinkLine term={s('adr.supersedesLine')} links={list.filter((a) => a.supersededBy === adr.id).map((a) => to(a.id))} />
      <LinkLine term={s('adr.willSupersedeLine')} links={pending.map(to)} />
      <LinkLine
        term={s('adr.decidedFor')} testId="adr-decided-for"
        links={(solutions?.list ?? []).filter((one) => one.decision === adr.id)
          .map((one) => ({ key: one.id, label: `${solutionLabel(one.number)} ${one.title}`, onOpen: () => solutions?.onOpen(one.id) }))}
      />
      <LinkLine
        term={s('adr.plans')} testId="adr-plans"
        links={(plans?.list ?? []).filter((plan) => plan.decisions.includes(adr.id))
          .map((plan) => ({ key: plan.id, label: `${transitionLabel(plan)} ${plan.title}`, onOpen: () => plans?.onOpen(plan.id) }))}
      />
    </>
  )
}

/** The next step under the title; History, ✎ Edit and the rest under ⋯ at the end of the head (`RecordActions`). */
function recordHead({ adr, list, props }: { adr: Adr; list: readonly Adr[]; props: AdrRecordProps }): { next: ReactNode; actions: ReactNode } {
  const { locked, s, above, onStatus, onHistory, onCopyLink, onWrite, onDelete } = props
  const open = locked ? 0 : stillOpen(adr, list)
  const moves = locked ? [] : movesOf(adr.status)
  const canWrite = !locked && !isAdrLocked(adr)
  const label = (key: typeof moves[number]['label'], to: AdrStatus) => (to === 'accepted' && open > 0 ? s('adr.verbAcceptHeld', { count: open }) : s(key))
  const actions: NextAction[] = [
    ...moves.filter((one) => !one.more).map((one) => ({
      label: label(one.label, one.to), primary: one.primary, held: one.to === 'accepted' && open > 0,
      onPress: () => onStatus(one.to), dataGuide: 'decision.move', testId: `adr-move-${one.to}`,
    })),
    ...(above?.onOpen ? [{ label: s('adr.openScope', { scope: above.name }), primary: true, onPress: above.onOpen }] : []),
  ]
  const more: MenuEntry[] = [
    ...moves.filter((one) => one.more).map((one) => ({ label: s(one.label), onSelect: () => onStatus(one.to), 'data-guide': 'decision.move' })),
    ...(onCopyLink ? [{ label: s('common.copyLink'), onSelect: onCopyLink }] : []),
    ...(!locked && isAdrDeletable(adr) ? [{ label: s('adr.verbDelete'), onSelect: onDelete, final: true }] : []),
  ]
  const holds = open > 0 ? Array.from({ length: open }, (_, at) => ({ label: String(at) })) : undefined
  return {
    next: actions.length > 0 && <NextStep inline actions={actions} holds={holds} dataGuide="decision.next" />,
    actions: (
      <RecordActions
        verbs={onHistory && <Button variant="quiet" onClick={onHistory}>{s('common.history')}</Button>}
        {...(canWrite ? { edit: { onPress: () => onWrite(), testId: 'adr-write' } } : {})}
        more={more} moreGuide="decision.more"
      />
    ),
  }
}

const onPageHeadings = (text: string) => outline(text).filter((heading) => heading.level <= 3)

/** What the record says: where it stands, what it is tied to, who was asked, the text, and what was said about it. */
function RecordBody({ adr, written, root, props }: { adr: Adr; written: string; root: RefObject<HTMLDivElement | null>; props: AdrRecordProps }) {
  const { list, locked, above, about, s, language, elements, renderMarkdown, onSelect } = props
  const names = usePersonNames()
  const source = useMemo(() => linkElementRefs(written, elements), [written, elements])
  const day = (value: string) => formatDay(value, language)
  const ownApproval = (adr.status === 'reviewing' || adr.status === 'accepted') && selfAccepted(adr, names.canonical)
  const open = !isAdrLocked(adr)
  const kept = above ? { scope: above.path } : {}
  const reviewers = (
    <section className="adr-section" data-testid="adr-signers" data-guide="decision.signers">
      <h3>{s('adr.signers')}</h3>
      <SignersRead signers={adr.signers} names={names} s={s} day={day} {...(open && !locked ? { onAdd: () => props.onWrite('approved') } : {})} />
    </section>
  )
  return (
    <div className="adr-record" ref={root}>
      <StepLadder steps={stepsOf(adr.status, (key) => s(key))} />
      <Standing adr={adr} above={above} about={about} names={names} s={s} day={day(adr.date)} />
      {supersededByUnaccepted(adr, list) && <p className="adr-warning" data-testid="adr-broken-successor">{s('adr.brokenSuccessor')}</p>}
      {ownApproval && <p className="adr-warning" data-testid="adr-self-accepted">{s('adr.selfAccepted', { name: proposerText(adr, names) })}</p>}
      <Links adr={adr} list={list} onSelect={onSelect} plans={props.plans} solutions={props.solutions} s={s} />
      {/* On an open record who is asked comes first: that is what it waits for. */}
      {open && reviewers}
      <div className="adr-body" data-document>
        {source.trim()
          ? renderMarkdown(source, { onElementLink: props.onElementLink })
          : <p className="adr-note">{s('common.empty')}</p>}
      </div>
      {!open && reviewers}
      {above === undefined && <CitationsSection about={{ kind: 'decision', id: adr.id }} subject={`${adr.title}\n${adr.body}`} readOnly={locked || !open} />}
      <RecordChanges about={{ kind: 'decision', id: adr.id }} {...kept} first="proposed" />
      <CommentThread about={{ kind: 'decision', id: adr.id }} {...kept} />
    </div>
  )
}

/** Beside the text: what acceptance still needs, and a way round a long record. */
function RecordFacts({ adr, written, root, props }: { adr: Adr; written: string; root: RefObject<HTMLDivElement | null>; props: AdrRecordProps }) {
  const { list, locked, s, onWrite } = props
  const headings = useMemo(() => onPageHeadings(written), [written])
  const scrollTo = (selector: string, text?: string) => {
    const candidates = Array.from(root.current?.querySelectorAll<HTMLElement>(selector) ?? [])
    const target = text === undefined ? candidates[0] : candidates.find((one) => one.textContent?.trim() === text)
    target?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  }
  return (
    <>
      {!locked && !isAdrLocked(adr) && <AdrGateList adr={adr} list={list} onGo={(item) => onWrite(item)} s={s} />}
      {headings.length > 0 && (
        <PreviewFact label={s('adr.contents')}>
          <nav className="adr-outline" aria-label={s('adr.contents')}>
            {headings.map((heading, at) => (
              <button type="button" key={`${heading.id}-${at}`} data-level={heading.level} onClick={() => scrollTo('h1, h2, h3, h4, h5, h6, [role="heading"]', heading.text)}>{heading.text}</button>
            ))}
            <button type="button" onClick={() => scrollTo('[data-testid="adr-signers"]')}>{s('adr.signers')}</button>
          </nav>
        </PreviewFact>
      )}
    </>
  )
}

export function AdrRecord(props: AdrRecordProps) {
  const { adr, ids, above, s, onSelect } = props
  const root = useRef<HTMLDivElement>(null)
  // An open record reads as what has been written; the template's words look like content, and are only a start.
  const written = useMemo(() => (adr && !isAdrLocked(adr) ? writtenBody(adr.body, s) : adr?.body ?? ''), [adr, s])
  const number = adr && formatAdrNumber(adr.number)
  const head = adr && recordHead({ adr, list: props.list, props })
  return (
    <Preview
      ids={ids}
      currentId={adr?.id ?? null}
      onSelect={onSelect}
      title={adr?.title ?? ''}
      code={above && number ? s('adr.numberOf', { number, scope: above.name }) : number}
      {...(head ? { actions: head.actions, ...(head.next ? { next: head.next } : {}) } : {})}
      dataGuide="decision.record"
      facts={adr && <RecordFacts adr={adr} written={written} root={root} props={props} />}
    >
      {adr && <RecordBody adr={adr} written={written} root={root} props={props} />}
    </Preview>
  )
}
