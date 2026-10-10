// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The reading pane: one decision, read first and edited on request.
 *
 * The header — number, title, status, date, decision-makers — is fields, not
 * text, so it is drawn above the body and cannot drift from it. The body is
 * markdown through the same renderer as documentation, which gives it
 * `[[Name]]` links and mermaid for free. The signers table at the end is where
 * a review is recorded: who was asked, what they said, when.
 *
 * Editing follows the documentation page: the text is a local draft, committed
 * when it has been quiet for a moment, when the mode switches back to read, and
 * when the pane closes or moves to another record. A locked record — accepted,
 * rejected or superseded — has no Edit at all; the status buttons are the only
 * thing left to press, and only where the state machine allows a move.
 *
 * A move with a gate (ADR-0008, amended 28 September 2026) says what it still
 * needs beside its button, and the button waits until the list is clear. The
 * page asks the last question — a confirmation, a reason, a successor — in a
 * dialog of its own.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { linkElementRefs, outline } from '../../documentation'
import type { Language, Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import { DocumentSheet } from '../../documentation/ui/DocumentSheet'
import { DocumentSource } from '../../documentation/ui/DocumentSource'
import type { DocumentImages } from '../../documentation/ui/DocumentSource'
import { formatAdrNumber, isAdrLocked } from '../adr'
import type { Adr, AdrPatch, AdrSigner, AdrStatus, AdrVerdict } from '../adr'
import type { Solution } from '../../model/observation'
import type { Transition } from '../../model/transition'
import { VERDICT_LABEL } from '../adrScope'
import { Contents, FrontMatter, ReaderBar, ReaderNotices } from './AdrReaderParts'
import type { Mode } from './AdrReaderParts'

/** How long the text must be quiet before a draft becomes a commit. */
const COMMIT_DELAY_MS = 1200

export type AdrReaderProps = {
  adr: Adr
  /** The same list the record sits in, to resolve links in both directions. */
  list: readonly Adr[]
  readOnly: boolean
  s: Translate
  /** The language dates are said in. English where it is not given. */
  language?: Language
  /** `yyyy-mm-dd`, for a verdict's date. Injected so a test can pin it. */
  today: () => string
  /** For `[[Name]]` links; the project's elements, or none on the group level. */
  elements: readonly { id: string; name: string }[]
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  onUpdate: (patch: AdrPatch) => void
  /**
   * A status move. Accepting, rejecting and superseding are asked for here
   * and completed by the page's dialogs; a gated move is only offered once
   * its gate is clear.
   */
  onStatus: (next: AdrStatus) => void
  onDelete: () => void
  /** "History…", where the host offers one for this record. */
  onHistory?: () => void
  /** Follow a superseded/supersedes link to another record in this list. */
  onSelect: (adrId: string) => void
  onElementLink?: (elementId: string) => void
  /** Take a picture into the project (ADR-0009); absent, a record cannot be given one. */
  onAddImage?: (file: File) => Promise<string | undefined>
  /** The project's pictures, to put in again or take out. */
  images?: DocumentImages
  /**
   * The plans over the landscape (ADR-0010), so a record can say which plans
   * rest on it — the link back from the one a plan carries. Absent: no row.
   */
  plans?: { list: readonly Transition[]; onOpen(transitionId: string): void }
  /**
   * The solutions of this scope (ADR-0026), so a record can say which one it
   * was decided for — derived from the solution's `decision`, as the plans
   * are from theirs. Absent: no row.
   */
  solutions?: { list: readonly Pick<Solution, 'id' | 'number' | 'title' | 'decision'>[]; onOpen(solutionId: string): void }
  /** Copy a link to this record. Shown when the host can ask for one, read-only included. */
  onCopyLink?: () => void
}

export function AdrReader(props: AdrReaderProps) {
  const { adr, list, readOnly, s, today, elements, renderMarkdown, onUpdate, onStatus, onSelect } = props
  const locked = isAdrLocked(adr)
  const canEdit = !readOnly && !locked
  const [mode, setMode] = useState<Mode>('read')
  const [draft, setDraft] = useState({ title: adr.title, body: adr.body })
  // The rendered record beside the source, which a wide table wants out of the way.
  const [previewShown, setPreviewShown] = useState(true)
  const showPreview = mode === 'read' || previewShown
  const contentRef = useRef<HTMLDivElement>(null)

  // --- the draft and its commits --------------------------------------------

  const latest = useRef({ draft, stored: { title: adr.title, body: adr.body }, onUpdate })
  latest.current = { draft, stored: { title: adr.title, body: adr.body }, onUpdate }

  const commit = useCallback(() => {
    const { draft: d, stored, onUpdate: update } = latest.current
    if (d.title === stored.title && d.body === stored.body) return
    update({ title: d.title, body: d.body })
  }, [])

  useEffect(() => {
    if (mode !== 'edit') return
    const timer = setTimeout(commit, COMMIT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [draft, mode, commit])

  // Unmount — another record, the page closing — commits whatever is pending.
  useEffect(() => commit, [commit])

  useEffect(() => {
    if (mode === 'read') setDraft({ title: adr.title, body: adr.body })
  }, [adr.title, adr.body, mode])

  // A record locked while being edited (accepted from the status row) drops
  // back to reading: there is nothing left that may be typed into.
  useEffect(() => {
    if (!canEdit && mode === 'edit') { commit(); setMode('read') }
  }, [canEdit, mode, commit])

  const switchMode = (next: Mode | null) => {
    if (!next || next === mode) return
    if (next === 'read') commit()
    setMode(next)
  }

  // --- what is shown ------------------------------------------------------------

  const text = mode === 'edit' ? draft.body : adr.body
  const source = useMemo(() => linkElementRefs(text, elements), [text, elements])
  const headings = useMemo(() => outline(text).filter((h) => h.level <= 3), [text])
  const day = (value: string) => formatDay(value, props.language ?? 'en')

  const rendered = source.trim()
    ? renderMarkdown(source, { onElementLink: props.onElementLink })
    : <Typography color="text.secondary">{s('common.empty')}</Typography>

  return (
    <Box data-testid="adr-reader" sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <ReaderBar
        adr={adr} list={list} readOnly={readOnly} canEdit={canEdit} mode={mode} s={s} day={day}
        onStatus={onStatus} onDelete={props.onDelete} onHistory={props.onHistory} onMode={switchMode}
        onCopyLink={props.onCopyLink}
      />
      <ReaderNotices adr={adr} list={list} readOnly={readOnly} s={s} />

      {/* ---- the body, or the source beside it ---- */}
      <Box sx={{ display: 'grid', gridTemplateColumns: mode === 'edit' && showPreview ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', flex: 1, minHeight: 0 }}>
        {mode === 'edit' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
              <TextField
                size="small"
                fullWidth
                label={s('adr.titleField')}
                value={draft.title}
                onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
                onBlur={commit}
              />
            </Box>
            <DocumentSource
              value={draft.body}
              onChange={(body) => setDraft((d) => ({ ...d, body }))}
              onBlur={commit}
              label={s('adr.source')}
              onAddImage={props.onAddImage}
              images={props.images}
              preview={{ shown: previewShown, onToggle: () => setPreviewShown((on) => !on) }}
            />
          </Box>
        )}

        {showPreview && (
          <DocumentSheet ref={contentRef} dense={mode === 'edit'}>
            <Typography variant="overline" color="text.secondary">{formatAdrNumber(adr.number)}</Typography>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {mode === 'edit' ? draft.title : adr.title}
            </Typography>
            <FrontMatter
              adr={adr} list={list} canEdit={canEdit} s={s} day={day} onUpdate={onUpdate} onSelect={onSelect}
              plans={props.plans} solutions={props.solutions}
            />
            <Contents headings={headings} root={contentRef} s={s} />
            <Box sx={{ fontSize: 15, mt: headings.length ? 0 : 3 }} data-document>{rendered}</Box>
            <SignersTable
              signers={adr.signers}
              editable={canEdit}
              today={today}
              s={s}
              day={day}
              onChange={(signers) => onUpdate({ signers })}
            />
          </DocumentSheet>
        )}
      </Box>
    </Box>
  )
}

// --- the reviewers ------------------------------------------------------------------

type SignersTableProps = {
  signers: readonly AdrSigner[]
  editable: boolean
  today: () => string
  s: Translate
  /** A day as the screen says it. */
  day: (value: string) => string
  onChange: (signers: AdrSigner[]) => void
}

/**
 * Who the decision was put to. Name and role are typed; the verdict is picked,
 * and picking one stamps today — a signature without a date is not one.
 * Edits commit straight away: a table row is a field, not a page.
 */
function SignersTable({ signers, editable, today, s, day, onChange }: SignersTableProps) {
  const edit = (index: number, patch: Partial<AdrSigner>) =>
    onChange(signers.map((signer, i) => (i === index ? { ...signer, ...patch } : signer)))
  const setVerdict = (index: number, verdict: AdrVerdict | 'pending') => {
    const next: AdrSigner = { ...signers[index] }
    if (verdict === 'pending') { delete next.verdict; delete next.signedAt }
    else { next.verdict = verdict; next.signedAt = today() }
    onChange(signers.map((signer, i) => (i === index ? next : signer)))
  }

  return (
    <Box component="section" data-testid="adr-signers" data-guide="decision.signers" sx={{ mt: 5, pt: 2, borderTop: 1, borderColor: 'divider' }}>
      <Typography variant="h6" component="h2" sx={{ fontSize: 17, fontWeight: 600 }}>{s('adr.signers')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{s('adr.signersHelp')}</Typography>
      {signers.length === 0 && !editable && (
        <Typography variant="body2" color="text.secondary">{s('adr.noSigners')}</Typography>
      )}
      {signers.length > 0 && (
        <Table size="small" sx={{ '& td, & th': { fontSize: 13, px: 1 } }}>
          <TableHead>
            <TableRow>
              <TableCell>{s('adr.signerName')}</TableCell>
              <TableCell>{s('adr.signerRole')}</TableCell>
              <TableCell>{s('adr.signerVerdict')}</TableCell>
              <TableCell>{s('adr.signedAt')}</TableCell>
              {editable && <TableCell padding="none" />}
            </TableRow>
          </TableHead>
          <TableBody>
            {signers.map((signer, index) => (
              <TableRow key={index}>
                <TableCell>
                  {editable
                    ? <TextField variant="standard" size="small" value={signer.name} aria-label={s('adr.signerName')} onChange={(e) => edit(index, { name: e.target.value })} fullWidth />
                    : signer.name}
                </TableCell>
                <TableCell>
                  {editable
                    ? <TextField variant="standard" size="small" value={signer.role ?? ''} aria-label={s('adr.signerRole')} onChange={(e) => edit(index, { role: e.target.value || undefined })} fullWidth />
                    : (signer.role ?? '')}
                </TableCell>
                <TableCell>
                  {editable ? (
                    <TextField
                      select
                      variant="standard"
                      size="small"
                      value={signer.verdict ?? 'pending'}
                      slotProps={{ select: { 'aria-label': s('adr.signerVerdict') } as Record<string, unknown> }}
                      onChange={(e) => setVerdict(index, e.target.value as AdrVerdict | 'pending')}
                    >
                      {(['pending', 'approved', 'rejected'] as const).map((verdict) => (
                        <MenuItem key={verdict} value={verdict}>{s(VERDICT_LABEL[verdict])}</MenuItem>
                      ))}
                    </TextField>
                  ) : s(VERDICT_LABEL[signer.verdict ?? 'pending'])}
                </TableCell>
                <TableCell>{signer.signedAt ? day(signer.signedAt) : ''}</TableCell>
                {editable && (
                  <TableCell padding="none">
                    <Tooltip title={s('adr.removeSigner', { name: signer.name || '…' })}>
                      <IconButton size="small" aria-label={s('adr.removeSigner', { name: signer.name || '…' })} onClick={() => onChange(signers.filter((_, i) => i !== index))}>
                        ×
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {editable && (
        <Button size="small" sx={{ mt: 1 }} onClick={() => onChange([...signers, { name: '' }])}>
          + {s('adr.addSigner')}
        </Button>
      )}
    </Box>
  )
}
