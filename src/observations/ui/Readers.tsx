// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One observation, or one cause, read (ADR-0021). What is on screen around it is
 * the page's: the large preview over a list, the panel beside a map, or the whole
 * record on a page of its own (`RecordViews`), and being edited it is a full window
 * (`RecordEditor`). So these say what the record holds and nothing about where.
 *
 * `part` says how much. The preview reads the text at full measure with the facts
 * beside it, and *Open full record* adds what a reader who came to look does not
 * need first: its links, history and comments.
 *
 * The body is markdown through the same renderer as documentation. The history at
 * the end is the dated ledger: recorded, seen again, absorbed, merged, archived,
 * noted, and shared, in a record from before nothing was shared (ADR-0032). A
 * record of a scope below says so in a strip, and what is added to it here is
 * made there. Make root and Make cause ask first, and where the chain says
 * otherwise the reader says why, naming the records in the way.
 */
import { useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import { fillEmptySections } from '../../documentation/documentation'
import { MarkdownDocument } from '../../documentation/ui/MarkdownDocument'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import type { DocumentImages } from '../../documentation/ui/MarkdownEditor'
import { ScopeIcon, UnlinkIcon } from '../../widgets/icons'
import { CompactForms, Term, Value } from '../../widgets/CompactForms'

export { Term, Value }
import {
  causeLabel, formatCauseNumber, formatObservationNumber, isNoted, isRootCause, toneOf,
} from '../observation'
import type {
  Cause, CauseLink, CausePatch, Observation, ObservationEvent, ObservationPatch, ObservationTone, RecordedBy,
} from '../observation'
import type { PersonNames } from '../../people/ui/names'
import { recorderEntry, recorderShown } from '../recordedBy'
import { NOT_READ, usePersonNames } from '../../people/ui/names'
import { EVENT_LABEL, TONE_WORD, IMPACT_LABEL, STATE_LABEL, STRENGTH_LABEL } from '../observationScope'
import { COMPACT, ReaderActions, ReaderNotice } from './ActionButton'
import type { ReaderAction } from './ActionButton'
import {
  causeActions, modeAction, observationActions, openScopeAction, restoreAction,
} from './readerActions'
import type { LinkMode, Mode } from './readerActions'
import { CommentThread } from '../../comments/ui/threadPart'
import { CitationsSection } from '../../principles/ui/CitationsSection'
import { RecordChanges } from '../../comments/ui/RecordChanges'
import { ToneBar } from './ToneBar'
import type { CommentThreadProps } from '../../comments/ui/CommentThread'
import type { CommentFrom } from '../../model/comment'
import { nodeKey } from '../graph'
import { experimentKey, solutionKey } from '../solutionGraph'

export type { Mode } from './readerActions'

/**
 * Where a record's thread is read (ADR-0037): the scope below that keeps it,
 * where it is one; what a comment that came with a merged record names it; and
 * how that record is opened, where it still is — a link in the thread.
 *
 * A comment that came with the record itself, from the scope it was moved out
 * of (ADR-0038), names that scope and the number the record had there, as the
 * history line does: `moved` is the observation's own history, and there is
 * nothing to open, because the record is the one being read.
 */
export function threadPlace(
  fromScope: { path: string; label?: string; onOpenScope?: () => void } | undefined, nameOf: NameOf, onOpen: (key: string) => void,
  moved?: { id: string; history: readonly ObservationEvent[]; scopeLabel: ((path: string) => string) | undefined },
  onOpenScope?: () => void,
): Pick<CommentThreadProps, 'scope' | 'scopeLabel' | 'onOpenScope' | 'nameOf' | 'openFrom'> {
  const itself = (from: CommentFrom) => moved !== undefined && from.id === moved.id && from.scope !== undefined
  const openScope = onOpenScope ?? fromScope?.onOpenScope
  return {
    ...(fromScope ? { scope: fromScope.path } : {}),
    ...(fromScope?.label !== undefined ? { scopeLabel: fromScope.label } : {}),
    ...(fromScope && openScope ? { onOpenScope: openScope } : {}),
    nameOf: (from) => {
      const came = itself(from) ? moved?.history.find((event) => event.kind === 'movedIn' && event.scope === from.scope) : undefined
      if (came?.number !== undefined) return `${formatObservationNumber(came.number)} (${(moved?.scopeLabel ?? ((path: string) => path))(from.scope ?? '')})`
      return nameOf(from.id, from.scope)
    },
    openFrom: (from) => (itself(from) ? undefined : () => onOpen(keyOfFrom(from))),
  }
}

/** The page's key for a record a comment came with: the picture's for an observation or a cause, a solution's or an experiment's own. */
function keyOfFrom(from: CommentFrom): string {
  if (from.kind === 'solution') return solutionKey(from.id)
  if (from.kind === 'experiment') return experimentKey(from.id)
  return nodeKey(from.id, from.scope)
}

/** A name for whatever a link or an event points at, resolved by the page. */
export type NameOf = (id: string, scope?: string) => string

/** The reader's outermost box: the container `COMPACT` measures. */
export const READER_ROOT_SX = {
  display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%',
  containerType: 'inline-size', containerName: 'reader',
} as const

/** The reader's outermost box, and the panel's treatment for its fields (`CompactForms`). */
export function ReaderRoot({ testId, children }: { testId: string; children: ReactNode }) {
  return <Box data-testid={testId} sx={READER_ROOT_SX}><CompactForms>{children}</CompactForms></Box>
}

/** A record's text as it is read: on its reader, and on the Preview of its editor, which is the same document. */
export function renderedBody(body: string, s: Translate, renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode): ReactNode {
  // A heading the template left and nobody filled says *Nothing yet* under it, as the rows above do.
  return body.trim() ? renderMarkdown(fillEmptySections(body, s('observation.noLinks'))) : <Typography color="text.secondary">{s('common.empty')}</Typography>
}

/**
 * A whole record as a document: its text, and what is known about it in a quiet
 * column beside it. Where there is no room for the column, as in the panel beside a
 * map, the facts stand above the text.
 */
export function RecordDocument({ side, children }: { side: ReactNode; children: ReactNode }) {
  return (
    <div className="chain-read">
      <div className="chain-read__page">
        <div className="chain-read__text">{children}</div>
        <div className="chain-read__side">{side}</div>
      </div>
    </div>
  )
}

/** A record's title: a size smaller where the reader is narrow, so it does not take four lines. */
export const TITLE_SX = { fontWeight: 600, lineHeight: 1.2, [COMPACT]: { fontSize: 'var(--t-page)' } } as const

/**
 * The strip that says a record lives in a scope below (ADR-0032 §2): read
 * here, and whatever is added to it here is made there. The way to that
 * scope stands under the sentence, so the sentence keeps the strip's width
 * rather than wrapping into a column beside a button.
 */
export function ScopeStrip({ text, action, testId }: { text: string; action?: ReactNode; testId: string }) {
  return (
    <Box
      data-testid={testId}
      sx={{
        display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', columnGap: 1, rowGap: 0.75, alignItems: 'start',
        mx: 2, mt: 1, px: 1.25, py: 0.75, border: 1, borderColor: 'info.main', borderRadius: 1, bgcolor: 'action.hover',
      }}
    >
      <Box component="span" aria-hidden sx={{ color: 'info.main', display: 'inline-flex', pt: 0.25 }}><ScopeIcon size={14} /></Box>
      <Typography variant="caption" sx={{ fontSize: 'var(--t-small)' }}>{text}</Typography>
      {action && <Box sx={{ gridColumn: 2 }}>{action}</Box>}
    </Box>
  )
}

/** How much of a record is read: what a preview shows, or all of it. */
export type ReaderPart = 'preview' | 'full'

export function LinkList({ links, onOpen }: {
  links: readonly { key: string; label: string; note?: string; onRemove?: () => void; removeLabel?: string }[]
  onOpen: (key: string) => void
}) {
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {links.map((one) => (
        // The row wraps rather than squeezing: the label takes what is left and
        // breaks, and the note and the button keep their own width.
        <Box component="li" key={one.key} sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1, rowGap: 0, alignItems: 'center', py: 0.25 }}>
          <Link component="button" type="button" onClick={() => onOpen(one.key)} sx={{ fontSize: 'inherit', textAlign: 'left', minWidth: 0, overflowWrap: 'anywhere' }}>
            {one.label}
          </Link>
          {one.note && <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{one.note}</Typography>}
          {one.onRemove && (
            <Tooltip title={one.removeLabel ?? ''}>
              <IconButton size="small" aria-label={one.removeLabel} onClick={one.onRemove} data-testid="link-unlink" sx={{ p: 0.25, flexShrink: 0 }}>
                <UnlinkIcon size={14} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ))}
    </Box>
  )
}

// --- one observation --------------------------------------------------------------------

/**
 * Where an observation went when it was merged away: into one here, or into
 * one a scope above keeps (ADR-0021). `open` goes to it, where it can be
 * opened from here.
 */
export type MergedInto = {
  label: string; scope?: string; date?: string; open?: () => void
  /** Moved to another scope rather than merged (ADR-0038 §1): `label` is what it is called there, `scope` where. */
  moved?: true
}

/**
 * "Merged into O-0003", as a link to O-0003 where there is a way to it — in
 * the reader and on the row alike. On a row, the click is the link's and not
 * the row's.
 */
export function MergedNote({ merged, s, day }: { merged: MergedInto; s: Translate; day: (date: string) => string }) {
  const words = merged.moved ? s('observation.movedTo', { name: merged.label, scope: merged.scope ?? '' })
    : merged.scope !== undefined ? s('observation.mergedAbove', { name: merged.label, scope: merged.scope, date: merged.date ? day(merged.date) : '' })
    : s('observation.mergedInto', { name: merged.label })
  const open = merged.open
  if (!open) return <>{words}</>
  return (
    <Link
      component="button" type="button" data-testid="observation-merged-link"
      onClick={(event) => { event.stopPropagation(); open() }}
      sx={{ fontSize: 'inherit', textAlign: 'left', verticalAlign: 'baseline' }}
    >
      {words}
    </Link>
  )
}

/** A move in a record's history (ADR-0038 §1): the number it has, or had, in the other scope, and that scope. */
function movedWords(event: ObservationEvent, s: Translate, scopeLabel: ((path: string) => string) | undefined): string {
  const label = event.number !== undefined ? formatObservationNumber(event.number) : ''
  const scope = event.scope === undefined ? '' : scopeLabel ? scopeLabel(event.scope) : event.scope
  return s(EVENT_LABEL[event.kind], { label, scope })
}

export type ObservationReaderProps = {
  observation: Observation
  /** How much of it is read. All of it where the page does not say. */
  part?: ReaderPart
  /** What a scope is called, for a move in its history; the path where absent. */
  scopeLabel?: (path: string) => string
  /** Present for an observation of a scope below: read here, added to there, changed there. */
  fromScope?: { path: string; label: string }
  /** The causes that explain it: its own scope's, with `scope` where that is a scope below. */
  explainedBy: readonly { cause: Cause; link: CauseLink; scope?: string }[]
  /** Where it went, when it was merged away — here, or in a scope above. */
  mergedInto?: MergedInto
  readOnly: boolean
  /** A sighting and a cause may be added to one of a scope below, as that scope's step (ADR-0032 §2). */
  mayChangeBelow?: boolean
  /** `yyyy-mm-dd`: the latest day it may say it was first seen. */
  today: string
  s: Translate
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  nameOf: NameOf
  onUpdate: (patch: ObservationPatch) => void
  onSeenAgain: () => void
  /** Take it off the waiting list with no cause (a dialog asks why, and takes no answer), or put it back. */
  onNote?: () => void
  onUnnote?: () => void
  /** Close it (a dialog asks why), or bring it back. */
  onArchive: () => void
  onRestore: () => void
  onMerge: () => void
  /** *Move to scope…* (ADR-0038 §5); absent where the page cannot write two scopes. Offered on its own, standing record only. */
  onMove?: (() => void) | undefined
  /** A cause for it: a new one, or one already written down in its scope. */
  onLink: () => void
  onUnlink: (causeId: string, scope?: string) => void
  onDelete: () => void
  onOpenScope?: () => void
  onOpen: (key: string) => void
  onAddImage?: (file: File) => Promise<string | undefined>
  images?: DocumentImages
  /** *Copy link* to this record, where the page can make one: offered read-only too. */
  onCopyLink?: (() => void) | undefined
}

/**
 * What an observation's reader offers, read off the same props it is drawn
 * from: its bar, and the right-click on it, which passes how Edit is reached.
 */
export function observationBar(props: ObservationReaderProps, mode: Mode, switchMode: (next: Mode) => void): ReaderAction[] {
  const { observation, s, readOnly, fromScope, mergedInto } = props
  const archived = observation.archived === true
  const canEdit = !readOnly && !fromScope && !mergedInto && !archived
  const standing = !readOnly && !mergedInto && !archived
  return [
    ...observationActions({
      s, own: canEdit, mayAdd: canEdit || (standing && Boolean(fromScope) && props.mayChangeBelow === true),
      scope: fromScope ? fromScope.label : s('observation.thisScope'), mayMerge: standing,
      onSeenAgain: props.onSeenAgain, onLink: props.onLink, onMerge: props.onMerge, onArchive: props.onArchive, onDelete: props.onDelete,
      onMove: props.onMove,
      noted: isNoted(observation), explained: props.explainedBy.length > 0,
      ...(props.onNote ? { onNote: props.onNote } : {}), ...(props.onUnnote ? { onUnnote: props.onUnnote } : {}),
    }),
    ...(canEdit ? [modeAction(mode, switchMode, s('observation.tipEdit'), s)] : []),
    ...(archived && !readOnly && !fromScope ? [restoreAction(s('observation.tipRestore'), props.onRestore, 'observation-restore', s)] : []),
  ]
}

export function ObservationReader(props: ObservationReaderProps) {
  const { observation, s, renderMarkdown, nameOf, readOnly, fromScope, mergedInto, part = 'full' } = props
  const archived = observation.archived === true
  const archivedOn = archived ? [...observation.history].reverse().find((event) => event.kind === 'archived')?.date : undefined
  const notedEvent = isNoted(observation) ? [...observation.history].reverse().find((event) => event.kind === 'noted') : undefined
  const canEdit = !readOnly && !fromScope && !mergedInto && !archived
  // Who saw it, by the register's name or pseudonym, or the text typed (ADR-0036 §8).
  const names = usePersonNames()
  const rendered = renderedBody(observation.body, s, renderMarkdown)
  const label = formatObservationNumber(observation.number)
  const { language } = useStrings()
  const day = (date: string) => formatDay(date, language)
  const standing = !readOnly && !mergedInto && !archived

  return (
    <ReaderRoot testId="observation-reader">
      {fromScope && (
        <ScopeStrip
          testId="observation-from-below"
          text={s('observation.fromScope', { scope: fromScope.label })}
          action={props.onOpenScope ? <ReaderActions actions={[openScopeAction(fromScope.label, props.onOpenScope, s)]} label={s('observation.fromScopeActions')} moreLabel={s('observation.more')} /> : undefined}
        />
      )}
      {archived && <p className="chain-note" data-testid="observation-archived-note">{s('observation.archivedOn', { date: archivedOn ? day(archivedOn) : '' })}</p>}
      {mergedInto && <p className="chain-note" data-testid="observation-merged"><MergedNote merged={mergedInto} s={s} day={day} /></p>}
      {notedEvent && (
        <p className="chain-note" data-testid="observation-noted-note">
          {notedEvent.note ? s('observation.notedOnWhy', { date: day(notedEvent.date), reason: notedEvent.note }) : s('observation.notedOn', { date: day(notedEvent.date) })}
        </p>
      )}
      {part === 'full' ? (
        <RecordDocument
          side={(
            <ObservationFacts
              observation={observation} names={names} s={s} day={day} fromScope={fromScope} label={label}
              explainedBy={props.explainedBy} onOpen={props.onOpen}
              unlink={(causeId, scope) => (!standing || (scope !== undefined && !props.mayChangeBelow) ? undefined : () => props.onUnlink(causeId, scope))}
            />
          )}
        >
          <MarkdownDocument>{rendered}</MarkdownDocument>
          {!fromScope && <CitationsSection about={{ kind: 'observation', id: observation.id }} subject={`${observation.title}\n${observation.body}`} readOnly={!canEdit} />}
          <RecordChanges about={{ kind: 'observation', id: observation.id }} {...(fromScope ? { scope: fromScope.path } : {})} />
          <ObservationHistory history={observation.history} s={s} day={day} nameOf={nameOf} scopeLabel={props.scopeLabel} />
          <CommentThread about={{ kind: 'observation', id: observation.id }} {...threadPlace(fromScope, nameOf, props.onOpen, { id: observation.id, history: observation.history, scopeLabel: props.scopeLabel }, props.onOpenScope)} />
        </RecordDocument>
      ) : <MarkdownDocument className="chain-body">{rendered}</MarkdownDocument>}
    </ReaderRoot>
  )
}

/** What an observation's preview says beside its text, each a label over a value that wraps. */
export function observationFacts(one: Observation, facts: { names: PersonNames; day: (date: string) => string; s: Translate; fromScope?: string | undefined }) {
  const { names, day, s } = facts
  const lastSeen = [...one.history].reverse().find((event) => event.kind === 'seen')?.date
  const seen = s('observation.seenTimes', { count: one.seen })
  return [
    { label: s('observation.toneField'), value: s(TONE_WORD[toneOf(one)]), testId: `observation-tone-${toneOf(one)}` },
    { label: s('observation.impactField'), value: s(IMPACT_LABEL[one.impact]), testId: 'observation-impact' },
    { label: s('observation.colSeen'), value: lastSeen ? s('observation.seenLast', { times: seen, date: day(lastSeen) }) : seen, testId: 'observation-seen' },
    { label: s('observation.dateField'), value: day(one.date) },
    { label: s('observation.whereField'), value: one.where || '—' },
    { label: s('observation.byField'), value: names.text(one.by) || '—', testId: 'observation-by' },
    ...(one.recordedBy ? [{ label: s('observation.colRecordedBy'), value: recordedByText(one.recordedBy, names, s) || s('observation.recordedByUnknown'), testId: 'observation-recorded-by' }] : []),
    ...(facts.fromScope ? [{ label: s('observation.colScope'), value: facts.fromScope }] : []),
  ]
}

/** The facts of an observation as its reader lists them: when, where, who, how much, who recorded it, and what explains it. */
function ObservationFacts({ observation, names, s, day, fromScope, label, explainedBy, onOpen, unlink }: {
  observation: Observation
  names: PersonNames
  s: Translate
  day: (date: string) => string
  fromScope: ObservationReaderProps['fromScope']
  label: string
  explainedBy: ObservationReaderProps['explainedBy']
  onOpen: ObservationReaderProps['onOpen']
  unlink: (causeId: string, scope: string | undefined) => (() => void) | undefined
}) {
  const quiet = (shown: boolean) => ({ color: shown ? 'inherit' : 'text.secondary' })
  return (
    <dl className="chain-facts">
      <Term>{s('observation.toneField')}</Term><Value testId={`observation-tone-${toneOf(observation)}`}><ToneWord tone={toneOf(observation)} s={s} /></Value>
      <Term>{s('observation.dateField')}</Term><Value>{day(observation.date)}</Value>
      <Term>{s('observation.whereField')}</Term>
      <Value><Box component="span" sx={quiet(Boolean(observation.where))}>{observation.where || '—'}</Box></Value>
      <Term>{s('observation.byField')}</Term>
      <Value testId="observation-by"><Box component="span" sx={quiet(Boolean(observation.by))}>{names.text(observation.by) || '—'}</Box></Value>
      <Term>{s('observation.impactField')}</Term><Value testId="observation-impact">{s(IMPACT_LABEL[observation.impact])}</Value>
      <Term>{s('observation.colRecordedBy')}</Term>
      <Value testId="observation-recorded-by">
        <Box component="span" sx={quiet(Boolean(observation.recordedBy))}>
          {(observation.recordedBy && recordedByText(observation.recordedBy, names, s)) || s('observation.recordedByUnknown')}
        </Box>
      </Value>
      <Term>{s('observation.colSeen')}</Term><Value testId="observation-seen">{s('observation.seenTimes', { count: observation.seen })}</Value>
      <Term>{s('observation.colScope')}</Term>
      <Value>{fromScope ? fromScope.label : s('observation.local')}</Value>
      <Term>{s('observation.explainedBy')}</Term>
      <Value testId="observation-explained-by">
        <ExplainedBy links={explainedBy} label={label} s={s} onOpen={onOpen} onUnlink={unlink} />
      </Value>
    </dl>
  )
}

/** What happened to an observation, oldest first: recorded, seen again, merged, moved, archived. */
function ObservationHistory({ history, s, day, nameOf, scopeLabel }: {
  history: Observation['history']
  s: Translate
  day: (date: string) => string
  nameOf: ObservationReaderProps['nameOf']
  scopeLabel: ObservationReaderProps['scopeLabel']
}) {
  const said = (event: ObservationEvent) => {
    if (event.kind === 'absorbed') return s('observation.eventAbsorbed', { name: nameOf(event.id ?? '', event.scope), count: event.seen ?? 0 })
    if (event.kind === 'merged') return s('observation.eventMerged', { name: nameOf(event.id ?? '') })
    if (event.kind === 'moved' || event.kind === 'movedIn') return movedWords(event, s, scopeLabel)
    return s(EVENT_LABEL[event.kind])
  }
  return (
    <>
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 4 }}>{s('observation.history')}</Typography>
      <Box component="ol" data-testid="observation-history" sx={{ listStyle: 'none', m: 0, p: 0, fontSize: 'var(--t-body)' }}>
        {history.map((event, index) => (
          <Box component="li" key={index} sx={{ display: 'flex', gap: 2, py: 0.25, borderBottom: 1, borderColor: 'divider' }}>
            <Box component="span" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{day(event.date)}</Box>
            <Box component="span">{said(event)}{event.note ? ` — ${event.note}` : ''}</Box>
          </Box>
        ))}
      </Box>
    </>
  )
}

/**
 * Who recorded it, and through which client where it was an agent: the one render
 * of a recorder on a screen (`recorderShown`), so a forget reaches it. Nothing
 * where nothing says who; not yet anybody until the register has been read, for
 * a record an entry answers for: never the name stored beside it.
 */
export function recordedByText(by: RecordedBy, names: PersonNames, s: Translate): string {
  const who = recorderWords(by, names)
  const via = by.via ? s('comments.via', { agent: by.via }) : ''
  return who && via ? `${who} ${via}` : who || via
}

function recorderWords(by: RecordedBy, names: PersonNames): string {
  if (names.register === undefined && recorderEntry(by, names.recorder) !== undefined) return NOT_READ
  const shown = recorderShown(by, names.register ?? new Map(), {}, names.recorder)
  return shown === undefined || shown.as === 'nameWithheld' ? '' : names.words(shown)
}

/** The tone, said with its bar (ADR-0038, amended): the same bar the form's buttons carry. */
function ToneWord({ tone, s }: { tone: ObservationTone; s: Translate }) {
  return <span className="chain-tone"><ToneBar tone={tone} /> {s(TONE_WORD[tone])}</span>
}

/** The causes that explain an observation, each a way to it and, where it may be, unlinked. */
function ExplainedBy({ links, label, s, onOpen, onUnlink }: {
  links: ObservationReaderProps['explainedBy']
  label: string
  s: Translate
  onOpen: (key: string) => void
  /** What unlinking one does, or nothing where it may not be. */
  onUnlink: (causeId: string, scope?: string) => (() => void) | undefined
}) {
  if (links.length === 0) return <Box component="span" sx={{ color: 'text.secondary' }}>{s('observation.noLinks')}</Box>
  return (
    <LinkList
      onOpen={onOpen}
      links={links.map(({ cause, link, scope }) => {
        const remove = onUnlink(cause.id, scope)
        return {
          key: scope === undefined ? cause.id : `${scope}#${cause.id}`,
          label: `${causeLabel(cause)} ${cause.title}`,
          note: s(STRENGTH_LABEL[link.strength]).toLowerCase(),
          ...(remove ? { onRemove: remove, removeLabel: s('observation.tipUnlink', { from: causeLabel(cause), to: label }) } : {}),
        }
      })}
    />
  )
}

// --- one cause ----------------------------------------------------------------------------

export type CauseReaderProps = {
  cause: Cause
  part?: ReaderPart
  /** The causes of its own scope: those that explain it are read off these. */
  causes: readonly Cause[]
  /** Present for a cause of a scope below: read here, added to there (ADR-0032 §2). */
  fromScope?: { path: string; label: string; onOpenScope?: () => void }
  /** Where it went, when it was merged (ADR-0035 §4): read, and changed nowhere. */
  mergedInto?: MergedInto
  /** Open the merge screen on it; absent where nothing may be merged. */
  onMerge?: () => void
  /**
   * The causes of another scope that explain it: one here explaining one
   * below, or one above — which opens where it lives, where `open` says how.
   */
  explainedFrom?: readonly { key: string; label: string; onRemove?: () => void; open?: () => void }[]
  readOnly: boolean
  /** Links and the root step may be taken on one of a scope below, as that scope's step. */
  mayChangeBelow?: boolean
  /** The links across a scope boundary this reader offers (ADR-0032 §4), and the name of the scope reading. */
  across?: readonly ('org' | 'local')[]
  here?: string
  /** Why an organisation cause may not be linked to it: it is a root cause below. */
  orgRefused?: string
  s: Translate
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  nameOf: NameOf
  /**
   * The key a linked record is selected by, from its id and the scope its
   * link names: `scope#id` for a record below. A cause of a scope below keys
   * its own links in its own scope; absent, a link with no scope is this
   * scope's.
   */
  keyOf?: (id: string, scope?: string) => string
  onUpdate: (patch: CausePatch) => void
  /**
   * Mark it verified. The page decides how: straight away where the body
   * already holds the evidence, or by asking what confirmed it (ADR-0021,
   * amended 28 September 2026). Back to assumed is `onUpdate`.
   */
  onVerify: () => void
  /**
   * Make it a root cause, or a cause again (ADR-0032 §3); absent where
   * nothing may be written. `rootRefused` says what stands in the way, and
   * pressing it then says so instead of asking.
   */
  onRoot?: () => void
  rootRefused?: string
  /** A deeper cause, a root cause, or a cause across a scope boundary: the page opens the dialog. */
  onLink: (mode: LinkMode) => void
  onUnlink: (link: CauseLink) => void
  /** Another cause of its own scope stops explaining this one. */
  onUnlinkFrom: (causeId: string) => void
  onDelete: () => void
  onOpen: (key: string) => void
  /** The solutions that address it (ADR-0026), resolved by the page. */
  solutions?: readonly { key: string; label: string; note: string }[]
  /** Propose a solution for it; absent where nothing may be written. */
  onPropose?: () => void
  /**
   * A question the right-click asked of it — Make root cause, Make cause, or
   * Org cause on a root — shown under its actions as its own press shows it.
   * Each ask is a new object; one already answered is not asked again.
   */
  asked?: { panel: CausePanel }
  onAddImage?: (file: File) => Promise<string | undefined>
  images?: DocumentImages
  /** *Copy link* to this record, where the page can make one: offered read-only too. */
  onCopyLink?: (() => void) | undefined
}

/** What a cause's reader asks, or refuses, under its actions. */
export type CausePanel = 'root' | 'org'

/**
 * What a cause's reader offers, read off the same props it is drawn from:
 * its bar, and the right-click on it, which passes how Edit is reached and
 * where the root step's question is asked.
 */
export function causeBar(props: CauseReaderProps, mode: Mode, switchMode: (next: Mode) => void, ask: (panel: CausePanel) => void): ReaderAction[] {
  const { cause, s, readOnly, fromScope, mergedInto } = props
  const standing = !readOnly && !mergedInto
  const canEdit = standing && !fromScope
  const root = isRootCause(cause)
  const label = causeLabel(cause)
  return [
    ...causeActions({
      s, label, flipped: formatCauseNumber(cause.number, !root), root, verified: cause.state === 'verified',
      mayAdd: canEdit || (standing && Boolean(fromScope) && props.mayChangeBelow === true), own: canEdit,
      across: standing ? props.across ?? [] : [], here: props.here ?? '', mayPropose: standing && Boolean(props.onPropose),
      ...(standing && props.onMerge ? { onMerge: props.onMerge } : {}),
      onLink: (linkMode) => (linkMode === 'org' && props.orgRefused ? ask('org') : props.onLink(linkMode)),
      ...(props.onRoot ? { onRoot: () => ask('root') } : {}),
      onVerify: () => (cause.state === 'assumed' ? props.onVerify() : props.onUpdate({ state: 'assumed' })),
      onPropose: () => props.onPropose?.(), onDelete: props.onDelete,
    }),
    ...(canEdit ? [modeAction(mode, switchMode, s('observation.tipEditCause'), s)] : []),
  ]
}

export function CauseReader(props: CauseReaderProps) {
  const { cause, causes, s, renderMarkdown, readOnly, fromScope, mergedInto, part = 'full' } = props
  const { language } = useStrings()
  const standing = !readOnly && !mergedInto
  const canEdit = standing && !fromScope
  const mayAdd = canEdit || (standing && Boolean(fromScope) && props.mayChangeBelow === true)
  const [panel, setPanel] = useState<CausePanel | undefined>(undefined)
  // A question asked from the right-click or a press opens here, once per ask.
  const [answered, setAnswered] = useState(props.asked)
  if (props.asked !== answered) {
    setAnswered(props.asked)
    if (props.asked) setPanel(props.asked.panel)
  }
  const rendered = renderedBody(cause.body, s, renderMarkdown)
  const root = isRootCause(cause)
  const label = causeLabel(cause)
  const flipped = formatCauseNumber(cause.number, !root)
  const explainedBy = causes.filter((other) => other.explains.some((link) => link.id === cause.id && link.scope === undefined))
  return (
    <ReaderRoot testId="cause-reader">
      {panel === 'root' && props.onRoot && (
        <RootPanel
          refused={props.rootRefused} root={root} label={label} flipped={flipped} s={s}
          onConfirm={() => { setPanel(undefined); props.onRoot?.() }} onClose={() => setPanel(undefined)}
        />
      )}
      {panel === 'org' && props.orgRefused && (
        <ReaderNotice refused lines={[props.orgRefused]} onClose={() => setPanel(undefined)} closeLabel={s('observation.ok')} testId="cause-org-refused" />
      )}
      {mergedInto && <p className="chain-note" data-testid="cause-merged"><MergedNote merged={mergedInto} s={s} day={(date) => formatDay(date, language)} /></p>}
      {fromScope && (
        <ScopeStrip
          testId="cause-from-below"
          text={s('observation.fromScope', { scope: fromScope.label })}
          action={fromScope.onOpenScope ? <ReaderActions actions={[openScopeAction(fromScope.label, fromScope.onOpenScope, s)]} label={s('observation.fromScopeActions')} moreLabel={s('observation.more')} /> : undefined}
        />
      )}
      <RecordDocument
        side={(
          <>
            <dl className="chain-facts">
              <Term>{s('observation.colState')}</Term>
              <Value testId="cause-state">{s(STATE_LABEL[cause.state])}{root && <span data-testid="cause-root"> · {s('observation.rootCause')}</span>}</Value>
            </dl>
            <CauseLinks cause={cause} explainedBy={explainedBy} mayAdd={mayAdd} props={props} />
          </>
        )}
      >
        <MarkdownDocument>{rendered}</MarkdownDocument>
        {part === 'full' && (
          <>
            <RecordChanges about={{ kind: 'cause', id: cause.id }} {...(fromScope ? { scope: fromScope.path } : {})} />
            <CommentThread about={{ kind: 'cause', id: cause.id }} {...threadPlace(fromScope, props.nameOf, props.onOpen)} />
          </>
        )}
      </RecordDocument>
    </ReaderRoot>
  )
}


/** What a cause explains, what explains it, and the solutions on it, each a way to it. */
function CauseLinks({ cause, explainedBy, mayAdd, props }: {
  cause: Cause
  explainedBy: readonly Cause[]
  mayAdd: boolean
  props: CauseReaderProps
}) {
  const { s, nameOf, readOnly, fromScope } = props
  const keyOf = props.keyOf ?? ((id: string, scope?: string) => (scope === undefined ? id : `${scope}#${id}`))
  const root = isRootCause(cause)
  const label = causeLabel(cause)
  const unlinkFrom = (from: string) => s('observation.tipUnlink', { from, to: label })
  return (
    <dl className="chain-facts">
              <Term>{s('observation.explains')}</Term>
              <Value testId="cause-explains">
                {cause.explains.length === 0
                  ? <Box component="span" sx={{ color: 'text.secondary' }}>{s('observation.noLinks')}</Box>
                  : (
                    <LinkList
                      onOpen={props.onOpen}
                      links={cause.explains.map((link) => ({
                        key: keyOf(link.id, link.scope),
                        label: nameOf(link.id, link.scope),
                        note: s(STRENGTH_LABEL[link.strength]).toLowerCase(),
                        ...(mayAdd ? { onRemove: () => props.onUnlink(link), removeLabel: s('observation.tipUnlink', { from: label, to: nameOf(link.id, link.scope) }) } : {}),
                      }))}
                    />
                  )}
              </Value>
              <Term>{s('observation.explainedBy')}</Term>
              <Value testId="cause-explained-by">
                {explainedBy.length === 0 && !props.explainedFrom?.length
                  ? <Box component="span" sx={{ color: 'text.secondary' }}>{root ? s('observation.rootNote') : s('observation.noLinks')}</Box>
                  : (
                    <LinkList
                      onOpen={(key) => { const from = props.explainedFrom?.find((one) => one.key === key); if (from?.open) from.open(); else props.onOpen(key) }}
                      links={[
                        ...explainedBy.map((other) => ({
                          key: keyOf(other.id),
                          label: `${causeLabel(other)} ${other.title}`,
                          ...(mayAdd && !fromScope ? { onRemove: () => props.onUnlinkFrom(other.id), removeLabel: unlinkFrom(causeLabel(other)) } : {}),
                        })),
                        ...(props.explainedFrom ?? []).map((one) => (
                          one.onRemove && !readOnly
                            ? { key: one.key, label: one.label, onRemove: one.onRemove, removeLabel: unlinkFrom(one.label) }
                            : { key: one.key, label: one.label }
                        )),
                      ]}
                    />
                  )}
              </Value>
              {props.solutions && (
                <>
                  <Term>{s('solution.forCause')}</Term>
                  <Value testId="cause-solutions">
                    {props.solutions.length > 0 && <LinkList onOpen={props.onOpen} links={props.solutions} />}
                    {props.onPropose
                      ? <Link component="button" type="button" onClick={props.onPropose} data-testid="cause-propose" sx={{ fontSize: 'inherit' }}>{s('solution.proposeForCause')}</Link>
                      : !root && !readOnly
                        ? <Box component="span" sx={{ color: 'text.secondary' }} data-testid="cause-propose-at-root">{s('solution.proposeAtRoot')}</Box>
                        : props.solutions.length === 0 && <Box component="span" sx={{ color: 'text.secondary' }}>{s('solution.none')}</Box>}
                  </Value>
                </>
              )}
            </dl>
  )
}

/**
 * Making a root cause, or a cause again, asked before it is taken — or, where
 * the chain says otherwise, refused with the records in the way and how to put
 * it right (ADR-0032 §3).
 */
function RootPanel({ refused, root, label, flipped, s, onConfirm, onClose }: {
  refused?: string
  root: boolean
  label: string
  flipped: string
  s: Translate
  onConfirm: () => void
  onClose: () => void
}) {
  if (refused) {
    const lead = root ? s('observation.makeCauseRefused', { label }) : s('observation.makeRootRefused', { label })
    return <ReaderNotice refused lines={[lead, refused]} onClose={onClose} closeLabel={s('observation.ok')} testId="cause-root-refused" />
  }
  return (
    <ReaderNotice
      refused={false} testId="cause-root-ask"
      lines={[root ? s('observation.makeCauseAsk', { label, next: flipped }) : s('observation.makeRootAsk', { label, next: flipped })]}
      confirm={root ? s('observation.makeCause') : s('observation.makeRoot')} onConfirm={onConfirm}
      onClose={onClose} closeLabel={s('common.cancel')}
    />
  )
}
