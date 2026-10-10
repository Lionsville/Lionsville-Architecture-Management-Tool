// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The reading pane of the observations page: one observation, or one cause,
 * read first and edited on request (ADR-0021).
 *
 * The header — number, title, date, where, who, impact, seen, scope — is
 * fields, not text, drawn above the body so it cannot drift from it. The body
 * is markdown through the same renderer as documentation. The history at the
 * end is the dated ledger: recorded, seen again, absorbed, merged, archived —
 * and shared, in a record from before nothing was shared (ADR-0032). An
 * archived record reads, and offers Restore and nothing else: closed is closed
 * until somebody says otherwise.
 *
 * The actions are buttons (ADR-0032 §7, `ActionButton`): an icon, a word or
 * two, and a tooltip that says in full what each does. A record of a scope
 * below says so in a strip, and what is added to it here is made there. Make
 * root and Make cause ask first, and where the chain says otherwise the
 * reader says why, naming the records in the way.
 *
 * Editing follows the decisions reader: a local draft, committed when it has
 * been quiet for a moment, when the mode switches back to read, and when the
 * pane closes or moves to another record. The fields are the form's, with the
 * same examples, and the facts an observation needs are never blanked.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import { DocumentSheet } from '../../documentation/ui/DocumentSheet'
import { DocumentSource } from '../../documentation/ui/DocumentSource'
import type { DocumentImages } from '../../documentation/ui/DocumentSource'
import { ScopeIcon, UnlinkIcon } from '../../widgets/icons'
import {
  causeLabel, formatCauseNumber, formatObservationNumber, isRootCause, OBSERVATION_IMPACTS,
} from '../observation'
import type {
  Cause, CauseLink, CausePatch, Observation, ObservationImpact, ObservationPatch,
} from '../observation'
import { observationProblems } from '../form'
import { EVENT_LABEL, IMPACT_COLOR, IMPACT_LABEL, STATE_COLOR, STATE_LABEL, STRENGTH_LABEL } from '../observationScope'
import { CopyLinkButton } from '../../widgets/CopyLinkButton'
import { COMPACT, ReaderActions, ReaderNotice } from './ActionButton'
import { ExampleField, TitleField } from './FormParts'
import { exampleFor, problemText } from './ObservationForm'
import {
  causeActions, modeAction, observationActions, openScopeAction, restoreAction,
} from './readerActions'
import type { LinkMode, Mode } from './readerActions'

export type { Mode } from './readerActions'

/** How long the text must be quiet before a draft becomes a commit. */
const COMMIT_DELAY_MS = 1200

/** A name for whatever a link or an event points at, resolved by the page. */
export type NameOf = (id: string, scope?: string) => string

/** The reader's outermost box: the container `COMPACT` measures. */
export const READER_ROOT_SX = {
  display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%',
  containerType: 'inline-size', containerName: 'reader',
} as const

/** A record's title: a size smaller where the reader is narrow, so it does not take four lines. */
export const TITLE_SX = { fontWeight: 600, lineHeight: 1.2, [COMPACT]: { fontSize: '1.5rem' } } as const

/** The bar over a record: what it is, then what can be done with it. */
export const BAR_SX = {
  display: 'grid', gap: 0.75, px: 2, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper',
} as const

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
      <Typography variant="caption" sx={{ fontSize: 12.5 }}>{text}</Typography>
      {action && <Box sx={{ gridColumn: 2 }}>{action}</Box>}
    </Box>
  )
}

/**
 * Whether the reader on show is being edited, held by the page rather than
 * the reader, so the page can give an edit the whole width — the picture
 * steps aside — and a right-click can open a record straight into it. A
 * reader with no page around it keeps the mode itself.
 */
export const ReaderModeContext = createContext<{ mode: Mode; setMode: (mode: Mode) => void } | undefined>(undefined)

/** The draft-and-commit cycle every reader shares. */
export function useDraft<T extends { title: string; body: string }>(
  stored: T, onUpdate: (patch: Partial<T>) => void, canEdit: boolean,
) {
  const held = useContext(ReaderModeContext)
  const [own, setOwn] = useState<Mode>('read')
  const mode = held?.mode ?? own
  const setMode = held?.setMode ?? setOwn
  const [draft, setDraft] = useState<T>(stored)
  const latest = useRef({ draft, stored, onUpdate })
  latest.current = { draft, stored, onUpdate }

  const commit = useCallback(() => {
    const { draft: d, stored: held, onUpdate: update } = latest.current
    const patch: Partial<T> = {}
    for (const key of Object.keys(d) as (keyof T)[]) if (d[key] !== held[key]) patch[key] = d[key]
    if (Object.keys(patch).length) update(patch)
  }, [])

  useEffect(() => {
    if (mode !== 'edit') return
    const timer = setTimeout(commit, COMMIT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [draft, mode, commit])
  useEffect(() => commit, [commit])
  // Leaving the edit commits it, whoever ended it: the toggle, the page, or
  // the record becoming one this reader may no longer change.
  const wasEditing = useRef(mode === 'edit')
  useEffect(() => {
    if (wasEditing.current && mode === 'read') commit()
    wasEditing.current = mode === 'edit'
  }, [mode, commit])
  useEffect(() => { if (mode === 'read') setDraft(stored) }, [stored, mode])
  useEffect(() => { if (!canEdit && mode === 'edit') setMode('read') }, [canEdit, mode, setMode])

  const switchMode = (next: Mode | null) => {
    if (!next || next === mode) return
    setMode(next)
  }
  return { mode, draft, setDraft, commit, switchMode }
}

export function Term({ children }: { children: ReactNode }) {
  return <Box component="dt" sx={{ color: 'text.secondary', fontWeight: 500 }}>{children}</Box>
}

export function Value({ children, testId }: { children: ReactNode; testId?: string }) {
  return <Box component="dd" sx={{ m: 0 }} data-testid={testId}>{children}</Box>
}

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
export type MergedInto = { label: string; scope?: string; date?: string; open?: () => void }

/**
 * "Merged into O-0003", as a link to O-0003 where there is a way to it — in
 * the reader and on the row alike. On a row, the click is the link's and not
 * the row's.
 */
export function MergedNote({ merged, s, day }: { merged: MergedInto; s: Translate; day: (date: string) => string }) {
  const words = merged.scope !== undefined
    ? s('observation.mergedAbove', { name: merged.label, scope: merged.scope, date: merged.date ? day(merged.date) : '' })
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

export type ObservationReaderProps = {
  observation: Observation
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
  /** Close it (a dialog asks why), or bring it back. */
  onArchive: () => void
  onRestore: () => void
  onMerge: () => void
  /** A cause for it: a new one, or one already written down in its scope. */
  onLink: () => void
  onUnlink: (causeId: string, scope?: string) => void
  onDelete: () => void
  onOpenScope?: () => void
  onOpen: (key: string) => void
  onAddImage?: (file: File) => Promise<string | undefined>
  images?: DocumentImages
  /** Copy a link to this record. Shown when the page can ask for one, read-only included. */
  onCopyLink?: () => void
}

/**
 * A patch as the reader may hand it on: the four facts an observation needs
 * are never blanked, and the day is never after today (ADR-0032 §6, §10).
 * What was refused stays in the draft, with what is wrong under it.
 */
function keepFacts(patch: ObservationPatch, today: string): ObservationPatch {
  const problems = observationProblems({
    title: patch.title ?? 'x', where: patch.where ?? 'x', by: patch.by ?? 'x', date: patch.date ?? today,
  }, today)
  const kept = { ...patch }
  for (const key of Object.keys(problems) as (keyof typeof problems)[]) delete kept[key]
  return kept
}

export function ObservationReader(props: ObservationReaderProps) {
  const { observation, s, renderMarkdown, nameOf, readOnly, fromScope, mergedInto } = props
  const archived = observation.archived === true
  const archivedOn = archived ? [...observation.history].reverse().find((event) => event.kind === 'archived')?.date : undefined
  const canEdit = !readOnly && !fromScope && !mergedInto && !archived
  const stored = useMemo(() => ({
    title: observation.title, body: observation.body, where: observation.where ?? '', by: observation.by ?? '',
    date: observation.date, impact: observation.impact,
  }), [observation])
  const { mode, draft, setDraft, commit, switchMode } = useDraft(stored, (patch) => props.onUpdate(keepFacts(patch, props.today)), canEdit)
  const [previewShown, setPreviewShown] = useState(true)
  const showPreview = mode === 'read' || previewShown
  const text = mode === 'edit' ? draft.body : observation.body
  const rendered = text.trim() ? renderMarkdown(text) : <Typography color="text.secondary">{s('common.empty')}</Typography>
  const label = formatObservationNumber(observation.number)
  const { language } = useStrings()
  const day = (date: string) => formatDay(date, language)
  const standing = !readOnly && !mergedInto && !archived
  const actions = [
    ...observationActions({
      s, own: canEdit, mayAdd: canEdit || (standing && Boolean(fromScope) && props.mayChangeBelow === true),
      scope: fromScope ? fromScope.label : s('observation.thisScope'), mayMerge: standing,
      onSeenAgain: props.onSeenAgain, onLink: props.onLink, onMerge: props.onMerge, onArchive: props.onArchive, onDelete: props.onDelete,
    }),
    ...(canEdit ? [modeAction(mode, switchMode, s('observation.tipEdit'), s)] : []),
    ...(archived && !readOnly && !fromScope ? [restoreAction(s('observation.tipRestore'), props.onRestore, 'observation-restore', s)] : []),
  ]

  return (
    <Box data-testid="observation-reader" sx={READER_ROOT_SX}>
      <Box sx={BAR_SX}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip size="small" variant="outlined" label={label} sx={{ fontFamily: 'ui-monospace, Menlo, monospace' }} />
          <Chip size="small" color={IMPACT_COLOR[observation.impact]} label={s(IMPACT_LABEL[observation.impact])} data-testid="observation-impact" />
          <Chip size="small" variant="outlined" label={s('observation.seenTimes', { count: observation.seen })} data-testid="observation-seen" />
          {archived && <Chip size="small" variant="outlined" label={s('observation.archivedMark')} data-testid="observation-archived" />}
          <Typography variant="caption" color="text.secondary">{day(observation.date)}</Typography>
        </Box>
        {(actions.length > 0 || props.onCopyLink) && (
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
            {actions.length > 0 && <ReaderActions actions={actions} label={s('observation.actions', { name: label })} moreLabel={s('observation.more')} />}
            {props.onCopyLink && <CopyLinkButton label={s('share.copy')} onCopy={props.onCopyLink} />}
          </Box>
        )}
      </Box>

      {fromScope && (
        <ScopeStrip
          testId="observation-from-below"
          text={s('observation.fromScope', { scope: fromScope.label })}
          action={props.onOpenScope ? <ReaderActions actions={[openScopeAction(fromScope.label, props.onOpenScope, s)]} label={s('observation.fromScopeActions')} moreLabel={s('observation.more')} /> : undefined}
        />
      )}
      {archived && (
        <Typography variant="caption" color="text.secondary" data-testid="observation-archived-note" sx={{ px: 2, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
          {s('observation.archivedOn', { date: archivedOn ? day(archivedOn) : '' })}
        </Typography>
      )}
      {mergedInto && (
        <Typography variant="caption" color="text.secondary" data-testid="observation-merged" sx={{ px: 2, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
          <MergedNote merged={mergedInto} s={s} day={day} />
        </Typography>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: mode === 'edit' && showPreview ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', flex: 1, minHeight: 0 }}>
        {mode === 'edit' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <ObservationFields draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} onBlur={commit} today={props.today} s={s} />
            <DocumentSource
              value={draft.body}
              onChange={(body) => setDraft((d) => ({ ...d, body }))}
              onBlur={commit}
              label={s('observation.source')}
              onAddImage={props.onAddImage}
              images={props.images}
              preview={{ shown: previewShown, onToggle: () => setPreviewShown((on) => !on) }}
            />
          </Box>
        )}
        {showPreview && (
          <DocumentSheet dense={mode === 'edit'}>
            <Typography variant="overline" color="text.secondary">{label}</Typography>
            <Typography variant="h4" component="h1" sx={TITLE_SX}>
              {mode === 'edit' ? draft.title : observation.title}
            </Typography>
            <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 3, rowGap: 0.5, mt: 2, mb: 0, fontSize: 14 }}>
              <Term>{s('observation.dateField')}</Term><Value>{day(observation.date)}</Value>
              <Term>{s('observation.whereField')}</Term>
              <Value><Box component="span" sx={{ color: observation.where ? 'inherit' : 'text.secondary' }}>{observation.where || '—'}</Box></Value>
              <Term>{s('observation.byField')}</Term>
              <Value testId="observation-by"><Box component="span" sx={{ color: observation.by ? 'inherit' : 'text.secondary' }}>{observation.by || '—'}</Box></Value>
              <Term>{s('observation.impactField')}</Term><Value>{s(IMPACT_LABEL[observation.impact])}</Value>
              <Term>{s('observation.colSeen')}</Term><Value>{s('observation.seenTimes', { count: observation.seen })}</Value>
              <Term>{s('observation.colScope')}</Term>
              <Value>{fromScope ? fromScope.label : s('observation.local')}</Value>
              <Term>{s('observation.explainedBy')}</Term>
              <Value testId="observation-explained-by">
                <ExplainedBy
                  links={props.explainedBy} label={label} s={s} onOpen={props.onOpen}
                  onUnlink={(causeId, scope) => (!standing || (scope !== undefined && !props.mayChangeBelow) ? undefined : () => props.onUnlink(causeId, scope))}
                />
              </Value>
            </Box>
            <Box sx={{ fontSize: 15, mt: 3 }} data-document>{rendered}</Box>

            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 4 }}>{s('observation.history')}</Typography>
            <Box component="ol" data-testid="observation-history" sx={{ listStyle: 'none', m: 0, p: 0, fontSize: 13 }}>
              {observation.history.map((event, index) => (
                <Box component="li" key={index} sx={{ display: 'flex', gap: 2, py: 0.25, borderBottom: 1, borderColor: 'divider' }}>
                  <Box component="span" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{day(event.date)}</Box>
                  <Box component="span">
                    {event.kind === 'absorbed'
                      ? s('observation.eventAbsorbed', { name: nameOf(event.id ?? '', event.scope), count: event.seen ?? 0 })
                      : event.kind === 'merged'
                        ? s('observation.eventMerged', { name: nameOf(event.id ?? '') })
                        : s(EVENT_LABEL[event.kind])}
                    {event.note ? ` — ${event.note}` : ''}
                  </Box>
                </Box>
              ))}
            </Box>
          </DocumentSheet>
        )}
      </Box>
    </Box>
  )
}

/** The four facts and the impact, as the form asks them: an example under each, and what is wrong in its place. */
function ObservationFields({ draft, onChange, onBlur, today, s }: {
  draft: { title: string; where: string; by: string; date: string; impact: ObservationImpact }
  onChange: (patch: Partial<{ title: string; where: string; by: string; date: string; impact: ObservationImpact }>) => void
  onBlur: () => void
  today: string
  s: Translate
}) {
  const problems = observationProblems(draft, today)
  const field = (key: 'title' | 'where' | 'by', labelKey: 'observation.titleField' | 'observation.whereField' | 'observation.byField', wide?: boolean) => (
    <Box sx={wide ? { gridColumn: '1 / -1' } : undefined}>
      <ExampleField
        required label={s(labelKey)} value={draft[key]} onChange={(value) => onChange({ [key]: value })} onBlur={onBlur}
        example={exampleFor(key, s)} problem={problemText(key, problems[key], s)}
      />
    </Box>
  )
  return (
    <Box sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: 'divider', display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr' }}>
      {field('title', 'observation.titleField', true)}
      {field('where', 'observation.whereField')}
      {field('by', 'observation.byField')}
      <ExampleField
        required type="date" max={today} label={s('observation.dateField')} value={draft.date}
        onChange={(date) => onChange({ date })} onBlur={onBlur}
        example={exampleFor('date', s)} problem={problemText('date', problems.date, s)}
      />
      <ExampleField
        select label={s('observation.impactField')} value={draft.impact} example={s('observation.formImpactExample')}
        onChange={(value) => onChange({ impact: value as ObservationImpact })} onBlur={onBlur}
      >
        {OBSERVATION_IMPACTS.map((one) => <MenuItem key={one} value={one}>{s(IMPACT_LABEL[one])}</MenuItem>)}
      </ExampleField>
    </Box>
  )
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
  /** The causes of its own scope: those that explain it are read off these. */
  causes: readonly Cause[]
  /** Present for a cause of a scope below: read here, added to there (ADR-0032 §2). */
  fromScope?: { label: string; onOpenScope?: () => void }
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
  onAddImage?: (file: File) => Promise<string | undefined>
  images?: DocumentImages
  /** Copy a link to this record. Shown when the page can ask for one, read-only included. */
  onCopyLink?: () => void
}

export function CauseReader(props: CauseReaderProps) {
  const { cause, causes, s, renderMarkdown, readOnly, fromScope, mergedInto } = props
  const { language } = useStrings()
  const standing = !readOnly && !mergedInto
  const canEdit = standing && !fromScope
  const mayAdd = canEdit || (standing && Boolean(fromScope) && props.mayChangeBelow === true)
  const stored = useMemo(() => ({ title: cause.title, body: cause.body }), [cause])
  const { mode, draft, setDraft, commit, switchMode } = useDraft(stored, (patch) => {
    // A title is never blanked: what was refused stays in the draft.
    const { title, ...rest } = patch
    props.onUpdate(title !== undefined && !title.trim() ? rest : patch)
  }, canEdit)
  const [previewShown, setPreviewShown] = useState(true)
  const [panel, setPanel] = useState<'root' | 'org' | undefined>(undefined)
  const showPreview = mode === 'read' || previewShown
  const text = mode === 'edit' ? draft.body : cause.body
  const rendered = text.trim() ? renderMarkdown(text) : <Typography color="text.secondary">{s('common.empty')}</Typography>
  const root = isRootCause(cause)
  const label = causeLabel(cause)
  const flipped = formatCauseNumber(cause.number, !root)
  const explainedBy = causes.filter((other) => other.explains.some((link) => link.id === cause.id && link.scope === undefined))
  const verify = () => (cause.state === 'assumed' ? props.onVerify() : props.onUpdate({ state: 'assumed' }))
  const actions = [
    ...causeActions({
      s, label, flipped, root, verified: cause.state === 'verified', mayAdd, own: canEdit,
      across: standing ? props.across ?? [] : [], here: props.here ?? '', mayPropose: standing && Boolean(props.onPropose),
      ...(standing && props.onMerge ? { onMerge: props.onMerge } : {}),
      onLink: (linkMode) => (linkMode === 'org' && props.orgRefused ? setPanel('org') : props.onLink(linkMode)),
      ...(props.onRoot ? { onRoot: () => setPanel('root') } : {}),
      onVerify: verify, onPropose: () => props.onPropose?.(), onDelete: props.onDelete,
    }),
    ...(canEdit ? [modeAction(mode, switchMode, s('observation.tipEditCause'), s)] : []),
  ]
  return (
    <Box data-testid="cause-reader" sx={READER_ROOT_SX}>
      <Box sx={BAR_SX}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip size="small" variant="outlined" label={label} sx={{ fontFamily: 'ui-monospace, Menlo, monospace' }} />
          {root && <Chip size="small" color="secondary" variant="outlined" label={s('observation.rootCause')} data-testid="cause-root" />}
          <Chip size="small" color={STATE_COLOR[cause.state]} label={s(STATE_LABEL[cause.state])} data-testid="cause-state" />
        </Box>
        {(actions.length > 0 || props.onCopyLink) && (
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
            {actions.length > 0 && <ReaderActions actions={actions} label={s('observation.actions', { name: label })} moreLabel={s('observation.more')} />}
            {props.onCopyLink && <CopyLinkButton label={s('share.copy')} onCopy={props.onCopyLink} />}
          </Box>
        )}
      </Box>
      {panel === 'root' && props.onRoot && (
        <RootPanel
          refused={props.rootRefused} root={root} label={label} flipped={flipped} s={s}
          onConfirm={() => { setPanel(undefined); props.onRoot?.() }} onClose={() => setPanel(undefined)}
        />
      )}
      {panel === 'org' && props.orgRefused && (
        <ReaderNotice refused lines={[props.orgRefused]} onClose={() => setPanel(undefined)} closeLabel={s('observation.ok')} testId="cause-org-refused" />
      )}
      {mergedInto && (
        <Typography variant="caption" color="text.secondary" data-testid="cause-merged" sx={{ px: 2, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
          <MergedNote merged={mergedInto} s={s} day={(date) => formatDay(date, language)} />
        </Typography>
      )}
      {fromScope && (
        <ScopeStrip
          testId="cause-from-below"
          text={s('observation.fromScope', { scope: fromScope.label })}
          action={fromScope.onOpenScope ? <ReaderActions actions={[openScopeAction(fromScope.label, fromScope.onOpenScope, s)]} label={s('observation.fromScopeActions')} moreLabel={s('observation.more')} /> : undefined}
        />
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: mode === 'edit' && showPreview ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', flex: 1, minHeight: 0 }}>
        {mode === 'edit' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Box sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
              <TitleField
                label={s('observation.titleField')} value={draft.title} onChange={(title) => setDraft((d) => ({ ...d, title }))} onBlur={commit}
                example={s('observation.causeTitleExample')} missing={s('observation.causeTitleMissing')}
              />
            </Box>
            <DocumentSource
              value={draft.body}
              onChange={(body) => setDraft((d) => ({ ...d, body }))}
              onBlur={commit}
              label={s('observation.causeSource')}
              onAddImage={props.onAddImage}
              images={props.images}
              preview={{ shown: previewShown, onToggle: () => setPreviewShown((on) => !on) }}
            />
          </Box>
        )}
        {showPreview && (
          <DocumentSheet dense={mode === 'edit'}>
            <Typography variant="overline" color="text.secondary">{label}</Typography>
            <Typography variant="h4" component="h1" sx={TITLE_SX}>
              {mode === 'edit' ? draft.title : cause.title}
            </Typography>
            <CauseLinks cause={cause} explainedBy={explainedBy} mayAdd={mayAdd} props={props} />
            <Box sx={{ fontSize: 15, mt: 3 }} data-document>{rendered}</Box>
          </DocumentSheet>
        )}
      </Box>
    </Box>
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
    <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 3, rowGap: 0.5, mt: 2, mb: 0, fontSize: 14 }}>
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
            </Box>
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
