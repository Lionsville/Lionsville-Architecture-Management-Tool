// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The reading pane of the observations page: one observation, or one cause,
 * read first and edited on request (ADR-0021).
 *
 * The header — number, title, date, where, who, impact, seen, shared — is
 * fields, not text, drawn above the body so it cannot drift from it. The body
 * is markdown through the same renderer as documentation. The history at the
 * end is the dated ledger: recorded, seen again, shared, absorbed, merged,
 * archived. An archived record reads, and offers Restore and nothing else:
 * closed is closed until somebody says otherwise.
 *
 * Editing follows the decisions reader: a local draft, committed when it has
 * been quiet for a moment, when the mode switches back to read, and when the
 * pane closes or moves to another record.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import { DocumentSheet } from '../../documentation/ui/DocumentSheet'
import { DocumentSource } from '../../documentation/ui/DocumentSource'
import type { DocumentImages } from '../../documentation/ui/DocumentSource'
import {
  OBSERVATION_IMPACTS, formatCauseNumber, formatObservationNumber, isRootCause,
} from '../observation'
import type {
  Cause, CauseLink, CausePatch, Observation, ObservationImpact, ObservationPatch,
} from '../observation'
import { EVENT_LABEL, IMPACT_COLOR, IMPACT_LABEL, STATE_COLOR, STATE_LABEL, STRENGTH_LABEL } from '../observationScope'

/** How long the text must be quiet before a draft becomes a commit. */
const COMMIT_DELAY_MS = 1200

export type Mode = 'read' | 'edit'

/** A name for whatever a link or an event points at, resolved by the page. */
export type NameOf = (id: string, scope?: string) => string

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
        <Box component="li" key={one.key} sx={{ display: 'flex', gap: 1, alignItems: 'center', py: 0.25 }}>
          <Link component="button" type="button" onClick={() => onOpen(one.key)} sx={{ fontSize: 'inherit', textAlign: 'left' }}>
            {one.label}
          </Link>
          {one.note && <Typography variant="caption" color="text.secondary">{one.note}</Typography>}
          {one.onRemove && (
            <Button size="small" onClick={one.onRemove} sx={{ minWidth: 0, px: 0.5, fontSize: 11 }}>{one.removeLabel}</Button>
          )}
        </Box>
      ))}
    </Box>
  )
}

// --- one observation --------------------------------------------------------------------

export type ObservationReaderProps = {
  observation: Observation
  /** Present for an observation a scope below shared: read here, changed there. */
  fromScope?: { path: string; label: string }
  /** This scope's causes that explain it. */
  explainedBy: readonly { cause: Cause; link: CauseLink }[]
  /** Where it went, when it was merged away — here, or in a scope above. */
  mergedInto?: { label: string; scope?: string; date?: string }
  readOnly: boolean
  /** Sharing upward is offered where there is an upward: the root has none. */
  canShare: boolean
  s: Translate
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  nameOf: NameOf
  onUpdate: (patch: ObservationPatch) => void
  onSeenAgain: () => void
  onShare: (shared: boolean) => void
  /** Close it (a dialog asks why), or bring it back. */
  onArchive: () => void
  onRestore: () => void
  onMerge: () => void
  onLink: () => void
  onUnlink: (causeId: string) => void
  onDelete: () => void
  onOpenScope?: () => void
  onOpen: (key: string) => void
  onAddImage?: (file: File) => Promise<string | undefined>
  images?: DocumentImages
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
  const { mode, draft, setDraft, commit, switchMode } = useDraft(stored, (patch) => props.onUpdate(patch), canEdit)
  const [previewShown, setPreviewShown] = useState(true)
  const showPreview = mode === 'read' || previewShown
  const text = mode === 'edit' ? draft.body : observation.body
  const rendered = text.trim() ? renderMarkdown(text) : <Typography color="text.secondary">{s('common.empty')}</Typography>
  const label = formatObservationNumber(observation.number)

  return (
    <Box data-testid="observation-reader" sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.75, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexWrap: 'wrap' }}>
        <Chip size="small" color={IMPACT_COLOR[observation.impact]} label={s(IMPACT_LABEL[observation.impact])} data-testid="observation-impact" />
        <Chip size="small" variant="outlined" label={s('observation.seenTimes', { count: observation.seen })} data-testid="observation-seen" />
        {observation.shared && <Chip size="small" variant="outlined" color="info" label={s('observation.sharedMark')} />}
        {archived && <Chip size="small" variant="outlined" label={s('observation.archivedMark')} data-testid="observation-archived" />}
        <Typography variant="caption" color="text.secondary">{observation.date}</Typography>
        <Box sx={{ flex: 1 }} />
        {canEdit && (
          <>
            <Button size="small" variant="outlined" onClick={props.onSeenAgain} data-testid="observation-seen-again">{s('observation.seenAgain')}</Button>
            <Button size="small" variant="outlined" onClick={props.onLink}>{s('observation.link')}</Button>
            <Button size="small" onClick={props.onMerge}>{s('observation.merge')}</Button>
            {props.canShare && (
              <Tooltip title={s('observation.shareHelp')}>
                <Button size="small" onClick={() => props.onShare(!observation.shared)} data-testid="observation-share">
                  {observation.shared ? s('observation.unshare') : s('observation.share')}
                </Button>
              </Tooltip>
            )}
            <Button size="small" onClick={props.onArchive} data-testid="observation-archive">{s('observation.archive')}</Button>
            <Button size="small" color="error" onClick={props.onDelete}>{s('observation.delete')}</Button>
          </>
        )}
        {archived && !readOnly && !fromScope && (
          <Button size="small" variant="outlined" onClick={props.onRestore} data-testid="observation-restore">{s('observation.restore')}</Button>
        )}
        {fromScope && !readOnly && !mergedInto && !archived && (
          <>
            <Button size="small" variant="outlined" onClick={props.onLink}>{s('observation.link')}</Button>
            <Button size="small" onClick={props.onMerge}>{s('observation.merge')}</Button>
          </>
        )}
        <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_e, value: Mode | null) => switchMode(value)}>
          <ToggleButton value="read">{s('observation.read')}</ToggleButton>
          {canEdit && <ToggleButton value="edit">{s('observation.edit')}</ToggleButton>}
        </ToggleButtonGroup>
      </Box>

      {fromScope && (
        <Box data-testid="observation-from-below" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
            {s('observation.fromScope', { scope: fromScope.label })}
          </Typography>
          {props.onOpenScope && <Button size="small" onClick={props.onOpenScope}>{s('observation.openScope', { scope: fromScope.label })}</Button>}
        </Box>
      )}
      {archived && (
        <Typography variant="caption" color="text.secondary" data-testid="observation-archived-note" sx={{ px: 2, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
          {s('observation.archivedOn', { date: archivedOn ?? '' })}
        </Typography>
      )}
      {mergedInto && (
        <Typography variant="caption" color="text.secondary" data-testid="observation-merged" sx={{ px: 2, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
          {mergedInto.scope !== undefined
            ? s('observation.mergedAbove', { name: mergedInto.label, scope: mergedInto.scope, date: mergedInto.date ?? '' })
            : s('observation.mergedInto', { name: mergedInto.label })}
        </Typography>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: mode === 'edit' && showPreview ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', flex: 1, minHeight: 0 }}>
        {mode === 'edit' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', display: 'grid', gap: 1, gridTemplateColumns: '1fr 1fr' }}>
              <TextField size="small" label={s('observation.titleField')} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} onBlur={commit} sx={{ gridColumn: '1 / -1' }} />
              <TextField size="small" label={s('observation.whereField')} value={draft.where} onChange={(e) => setDraft((d) => ({ ...d, where: e.target.value }))} onBlur={commit} />
              <TextField size="small" label={s('observation.byField')} value={draft.by} onChange={(e) => setDraft((d) => ({ ...d, by: e.target.value }))} onBlur={commit} />
              <TextField size="small" type="date" label={s('observation.dateField')} value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} onBlur={commit} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField select size="small" label={s('observation.impactField')} value={draft.impact} onChange={(e) => { setDraft((d) => ({ ...d, impact: e.target.value as ObservationImpact })) }} onBlur={commit} slotProps={{ htmlInput: { 'aria-label': s('observation.impactField') } }}>
                {OBSERVATION_IMPACTS.map((one) => <MenuItem key={one} value={one}>{s(IMPACT_LABEL[one])}</MenuItem>)}
              </TextField>
            </Box>
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
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {mode === 'edit' ? draft.title : observation.title}
            </Typography>
            <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 3, rowGap: 0.5, mt: 2, mb: 0, fontSize: 14 }}>
              <Term>{s('observation.dateField')}</Term><Value>{observation.date}</Value>
              <Term>{s('observation.whereField')}</Term>
              <Value><Box component="span" sx={{ color: observation.where ? 'inherit' : 'text.secondary' }}>{observation.where || '—'}</Box></Value>
              <Term>{s('observation.byField')}</Term>
              <Value testId="observation-by"><Box component="span" sx={{ color: observation.by ? 'inherit' : 'text.secondary' }}>{observation.by || '—'}</Box></Value>
              <Term>{s('observation.impactField')}</Term><Value>{s(IMPACT_LABEL[observation.impact])}</Value>
              <Term>{s('observation.colSeen')}</Term><Value>{s('observation.seenTimes', { count: observation.seen })}</Value>
              <Term>{s('observation.colScope')}</Term>
              <Value>{fromScope ? fromScope.label : observation.shared ? s('observation.shared') : s('observation.local')}</Value>
              <Term>{s('observation.explainedBy')}</Term>
              <Value testId="observation-explained-by">
                {props.explainedBy.length === 0
                  ? <Box component="span" sx={{ color: 'text.secondary' }}>{s('observation.noLinks')}</Box>
                  : (
                    <LinkList
                      onOpen={props.onOpen}
                      links={props.explainedBy.map(({ cause, link }) => ({
                        key: cause.id,
                        label: `${formatCauseNumber(cause.number)} ${cause.title}`,
                        note: s(STRENGTH_LABEL[link.strength]).toLowerCase(),
                        ...(readOnly || mergedInto || archived ? {} : { onRemove: () => props.onUnlink(cause.id), removeLabel: s('observation.unlink') }),
                      }))}
                    />
                  )}
              </Value>
            </Box>
            <Box sx={{ fontSize: 15, mt: 3 }} data-document>{rendered}</Box>

            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 4 }}>{s('observation.history')}</Typography>
            <Box component="ol" data-testid="observation-history" sx={{ listStyle: 'none', m: 0, p: 0, fontSize: 13 }}>
              {observation.history.map((event, index) => (
                <Box component="li" key={index} sx={{ display: 'flex', gap: 2, py: 0.25, borderBottom: 1, borderColor: 'divider' }}>
                  <Box component="span" sx={{ fontFamily: 'ui-monospace, Menlo, monospace', color: 'text.secondary', whiteSpace: 'nowrap' }}>{event.date}</Box>
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

// --- one cause ----------------------------------------------------------------------------

export type CauseReaderProps = {
  cause: Cause
  causes: readonly Cause[]
  readOnly: boolean
  s: Translate
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  nameOf: NameOf
  onUpdate: (patch: CausePatch) => void
  onLinkDeeper: () => void
  onUnlink: (link: CauseLink) => void
  /** Another cause stops explaining this one. */
  onUnlinkFrom: (causeId: string) => void
  onDelete: () => void
  onOpen: (key: string) => void
  /** The solutions that address it (ADR-0026), resolved by the page. */
  solutions?: readonly { key: string; label: string; note: string }[]
  /** Propose a solution for it; absent where nothing may be written. */
  onPropose?: () => void
  onAddImage?: (file: File) => Promise<string | undefined>
  images?: DocumentImages
}

export function CauseReader(props: CauseReaderProps) {
  const { cause, causes, s, renderMarkdown, nameOf, readOnly } = props
  const canEdit = !readOnly
  const stored = useMemo(() => ({ title: cause.title, body: cause.body }), [cause])
  const { mode, draft, setDraft, commit, switchMode } = useDraft(stored, (patch) => props.onUpdate(patch), canEdit)
  const [previewShown, setPreviewShown] = useState(true)
  const showPreview = mode === 'read' || previewShown
  const text = mode === 'edit' ? draft.body : cause.body
  const rendered = text.trim() ? renderMarkdown(text) : <Typography color="text.secondary">{s('common.empty')}</Typography>
  const root = isRootCause(cause, causes)
  const explainedBy = causes.filter((other) => other.explains.some((link) => link.id === cause.id && link.scope === undefined))

  return (
    <Box data-testid="cause-reader" sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.75, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexWrap: 'wrap' }}>
        <Chip size="small" color={STATE_COLOR[cause.state]} label={s(STATE_LABEL[cause.state])} data-testid="cause-state" />
        {root && <Chip size="small" color="secondary" variant="outlined" label={s('observation.rootCause')} data-testid="cause-root" />}
        <Box sx={{ flex: 1 }} />
        {canEdit && (
          <>
            <Button size="small" variant="outlined" onClick={() => props.onUpdate({ state: cause.state === 'assumed' ? 'verified' : 'assumed' })} data-testid="cause-verify">
              {cause.state === 'assumed' ? s('observation.verify') : s('observation.unverify')}
            </Button>
            <Button size="small" variant="outlined" onClick={props.onLinkDeeper}>{s('observation.linkDeeper')}</Button>
            <Button size="small" color="error" onClick={props.onDelete}>{s('observation.delete')}</Button>
          </>
        )}
        <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_e, value: Mode | null) => switchMode(value)}>
          <ToggleButton value="read">{s('observation.read')}</ToggleButton>
          {canEdit && <ToggleButton value="edit">{s('observation.edit')}</ToggleButton>}
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: mode === 'edit' && showPreview ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', flex: 1, minHeight: 0 }}>
        {mode === 'edit' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
              <TextField size="small" fullWidth label={s('observation.titleField')} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} onBlur={commit} />
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
            <Typography variant="overline" color="text.secondary">{formatCauseNumber(cause.number)}</Typography>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {mode === 'edit' ? draft.title : cause.title}
            </Typography>
            <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 3, rowGap: 0.5, mt: 2, mb: 0, fontSize: 14 }}>
              <Term>{s('observation.explains')}</Term>
              <Value testId="cause-explains">
                {cause.explains.length === 0
                  ? <Box component="span" sx={{ color: 'text.secondary' }}>{s('observation.noLinks')}</Box>
                  : (
                    <LinkList
                      onOpen={props.onOpen}
                      links={cause.explains.map((link) => ({
                        key: link.scope === undefined ? link.id : `${link.scope}#${link.id}`,
                        label: nameOf(link.id, link.scope),
                        note: s(STRENGTH_LABEL[link.strength]).toLowerCase(),
                        ...(readOnly ? {} : { onRemove: () => props.onUnlink(link), removeLabel: s('observation.unlink') }),
                      }))}
                    />
                  )}
              </Value>
              <Term>{s('observation.explainedBy')}</Term>
              <Value testId="cause-explained-by">
                {explainedBy.length === 0
                  ? <Box component="span" sx={{ color: 'text.secondary' }}>{root ? s('observation.rootNote') : s('observation.noLinks')}</Box>
                  : (
                    <LinkList
                      onOpen={props.onOpen}
                      links={explainedBy.map((other) => ({
                        key: other.id,
                        label: `${formatCauseNumber(other.number)} ${other.title}`,
                        ...(readOnly ? {} : { onRemove: () => props.onUnlinkFrom(other.id), removeLabel: s('observation.unlink') }),
                      }))}
                    />
                  )}
              </Value>
              {props.solutions && (
                <>
                  <Term>{s('solution.forCause')}</Term>
                  <Value testId="cause-solutions">
                    {props.solutions.length > 0 && <LinkList onOpen={props.onOpen} links={props.solutions} />}
                    {props.onPropose
                      ? <Button size="small" onClick={props.onPropose} data-testid="cause-propose" sx={{ px: 0 }}>{s('solution.proposeForCause')}</Button>
                      : !root && !readOnly
                        ? <Box component="span" sx={{ color: 'text.secondary' }} data-testid="cause-propose-at-root">{s('solution.proposeAtRoot')}</Box>
                        : props.solutions.length === 0 && <Box component="span" sx={{ color: 'text.secondary' }}>{s('solution.none')}</Box>}
                  </Value>
                </>
              )}
            </Box>
            <Box sx={{ fontSize: 15, mt: 3 }} data-document>{rendered}</Box>
          </DocumentSheet>
        )}
      </Box>
    </Box>
  )
}
