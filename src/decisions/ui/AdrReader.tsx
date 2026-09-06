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
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { linkElementRefs, outline } from '../../documentation'
import type { Translate } from '../../i18n'
import type { MarkdownRenderOptions } from '../../model'
import {
  formatAdrNumber, isAdrDeletable, isAdrLocked, transitionsFrom,
} from '../adr'
import type { Adr, AdrSigner, AdrStatus, AdrVerdict } from '../adr'
import { STATUS_COLOR, STATUS_LABEL, VERDICT_LABEL } from '../adrScope'

/** How long the text must be quiet before a draft becomes a commit. */
const COMMIT_DELAY_MS = 1200

export type AdrReaderProps = {
  adr: Adr
  /** The same list the record sits in, to resolve links in both directions. */
  list: readonly Adr[]
  readOnly: boolean
  s: Translate
  /** `yyyy-mm-dd`, for a verdict's date. Injected so a test can pin it. */
  today: () => string
  /** For `[[Name]]` links; the project's elements, or none on the group level. */
  elements: readonly { id: string; name: string }[]
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  onUpdate: (patch: Partial<Pick<Adr, 'title' | 'body' | 'signers'>>) => void
  /** A status move. `superseded` is asked for here and completed by the page's dialog. */
  onStatus: (next: AdrStatus) => void
  onDelete: () => void
  /** Follow a superseded/supersedes link to another record in this list. */
  onSelect: (adrId: string) => void
  onElementLink?: (elementId: string) => void
}

type Mode = 'read' | 'edit'

export function AdrReader(props: AdrReaderProps) {
  const { adr, list, readOnly, s, today, elements, renderMarkdown, onUpdate, onStatus, onSelect } = props
  const locked = isAdrLocked(adr)
  const canEdit = !readOnly && !locked
  const [mode, setMode] = useState<Mode>('read')
  const [draft, setDraft] = useState({ title: adr.title, body: adr.body })
  const [helpOpen, setHelpOpen] = useState(false)
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
  const successor = adr.supersededBy ? list.find((a) => a.id === adr.supersededBy) : undefined
  const predecessors = list.filter((a) => a.supersededBy === adr.id)
  const moves = transitionsFrom(adr.status)
  const deciders = adr.signers.map((signer) => signer.name.trim()).filter(Boolean)

  const scrollToHeading = (headingText: string) => {
    const root = contentRef.current
    if (!root) return
    const candidates = root.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')
    const target = Array.from(candidates).find((el) => el.textContent?.trim() === headingText)
    target?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  const rendered = source.trim()
    ? renderMarkdown(source, { onElementLink: props.onElementLink })
    : <Typography color="text.secondary">{s('doc.empty')}</Typography>

  const nameOf = (id: string) => {
    const found = list.find((a) => a.id === id)
    return found ? `${formatAdrNumber(found.number)} · ${found.title}` : id
  }

  return (
    <Box data-testid="adr-reader" sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      {/* ---- the record's own bar: mode, status moves, delete ---- */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.75, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexWrap: 'wrap' }}>
        <Chip size="small" color={STATUS_COLOR[adr.status]} label={s(STATUS_LABEL[adr.status])} data-testid="adr-status" />
        <Typography variant="caption" color="text.secondary">{adr.date}</Typography>
        <Box sx={{ flex: 1 }} />
        {!readOnly && moves.map((next) => (
          <Button key={next} size="small" variant="outlined" onClick={() => onStatus(next)}>
            {s('adr.moveTo', { status: s(STATUS_LABEL[next]) })}
          </Button>
        ))}
        {!readOnly && isAdrDeletable(adr) && (
          <Button size="small" color="error" onClick={props.onDelete}>{s('adr.delete')}</Button>
        )}
        <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_e, value: Mode | null) => switchMode(value)}>
          <ToggleButton value="read">{s('adr.read')}</ToggleButton>
          {canEdit && <ToggleButton value="edit">{s('adr.edit')}</ToggleButton>}
        </ToggleButtonGroup>
      </Box>

      {locked && (
        <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
          {s('adr.locked', { status: s(STATUS_LABEL[adr.status]).toLowerCase() })}
        </Typography>
      )}

      {/* ---- the body, or the source beside it ---- */}
      <Box sx={{ display: 'grid', gridTemplateColumns: mode === 'edit' ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', flex: 1, minHeight: 0 }}>
        {mode === 'edit' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
              <TextField
                size="small"
                label={s('adr.titleField')}
                value={draft.title}
                onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
                onBlur={commit}
                sx={{ flex: 1 }}
              />
              <Button size="small" variant={helpOpen ? 'contained' : 'outlined'} onClick={() => setHelpOpen((v) => !v)}>
                {s('adr.formattingHelp')}
              </Button>
            </Box>
            {helpOpen ? (
              <Box data-testid="adr-formatting-help" sx={{ overflow: 'auto', p: 2, fontSize: 13 }}>
                {renderMarkdown(s('adr.markdownHelp'))}
              </Box>
            ) : (
              <Box
                component="textarea"
                aria-label={s('adr.source')}
                value={draft.body}
                spellCheck={false}
                onChange={(e: { target: { value: string } }) => setDraft((d) => ({ ...d, body: e.target.value }))}
                onBlur={commit}
                sx={{
                  flex: 1, minHeight: 0, resize: 'none', border: 0, outline: 'none', p: 2,
                  bgcolor: 'transparent', color: 'text.primary',
                  font: '13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', tabSize: 2,
                }}
              />
            )}
          </Box>
        )}

        <Box sx={{ overflow: 'auto', minHeight: 0 }}>
          <Box ref={contentRef} sx={{ maxWidth: 820, mx: 'auto', px: mode === 'edit' ? 3 : 5, py: 3.5 }}>
            <Typography variant="overline" color="text.secondary">{formatAdrNumber(adr.number)}</Typography>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {mode === 'edit' ? draft.title : adr.title}
            </Typography>

            {/* MADR front matter, as a definition list rather than prose. */}
            <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 3, rowGap: 0.5, mt: 2, mb: 0, fontSize: 14 }}>
              <Term>{s('adr.status')}</Term>
              <Box component="dd" sx={{ m: 0 }}>
                {s(STATUS_LABEL[adr.status])}
                {successor && (
                  <> · <Link component="button" type="button" onClick={() => onSelect(successor.id)} sx={{ fontSize: 'inherit', verticalAlign: 'baseline' }}>
                    {s('adr.supersededBy', { name: nameOf(successor.id) })}
                  </Link></>
                )}
              </Box>
              <Term>{s('adr.date')}</Term>
              <Box component="dd" sx={{ m: 0 }}>{adr.date}</Box>
              <Term>{s('adr.deciders')}</Term>
              <Box component="dd" sx={{ m: 0, color: deciders.length ? 'inherit' : 'text.secondary' }}>
                {deciders.length ? deciders.join(', ') : '—'}
              </Box>
              {predecessors.length > 0 && (
                <>
                  <Term>{s('adr.statusSuperseded')}</Term>
                  <Box component="dd" sx={{ m: 0 }}>
                    {predecessors.map((p, i) => (
                      <Box component="span" key={p.id}>
                        {i > 0 && ', '}
                        <Link component="button" type="button" onClick={() => onSelect(p.id)} sx={{ fontSize: 'inherit', verticalAlign: 'baseline' }}>
                          {s('adr.supersedes', { name: nameOf(p.id) })}
                        </Link>
                      </Box>
                    ))}
                  </Box>
                </>
              )}
            </Box>

            {headings.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, py: 1.5, mt: 2, mb: 2, borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  {s('adr.contents')}
                </Typography>
                {headings.map((h, index) => (
                  <Typography
                    key={`${h.id}-${index}`}
                    component="button"
                    type="button"
                    variant="caption"
                    onClick={() => scrollToHeading(h.text)}
                    sx={{ border: 0, p: 0, bgcolor: 'transparent', color: 'text.secondary', cursor: 'pointer', pl: h.level === 3 ? 1.5 : 0, '&:hover': { color: 'primary.main' } }}
                  >
                    {h.text}
                  </Typography>
                ))}
              </Box>
            )}

            <Box sx={{ fontSize: 15, mt: headings.length ? 0 : 3 }}>{rendered}</Box>

            <SignersTable
              signers={adr.signers}
              editable={canEdit}
              today={today}
              s={s}
              onChange={(signers) => onUpdate({ signers })}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

function Term({ children }: { children: ReactNode }) {
  return <Box component="dt" sx={{ color: 'text.secondary', fontWeight: 500 }}>{children}</Box>
}

// --- the reviewers ------------------------------------------------------------------

type SignersTableProps = {
  signers: readonly AdrSigner[]
  editable: boolean
  today: () => string
  s: Translate
  onChange: (signers: AdrSigner[]) => void
}

/**
 * Who the decision was put to. Name and role are typed; the verdict is picked,
 * and picking one stamps today — a signature without a date is not one.
 * Edits commit straight away: a table row is a field, not a page.
 */
function SignersTable({ signers, editable, today, s, onChange }: SignersTableProps) {
  const edit = (index: number, patch: Partial<AdrSigner>) =>
    onChange(signers.map((signer, i) => (i === index ? { ...signer, ...patch } : signer)))
  const setVerdict = (index: number, verdict: AdrVerdict | 'pending') => {
    const next: AdrSigner = { ...signers[index] }
    if (verdict === 'pending') { delete next.verdict; delete next.signedAt }
    else { next.verdict = verdict; next.signedAt = today() }
    onChange(signers.map((signer, i) => (i === index ? next : signer)))
  }

  return (
    <Box component="section" data-testid="adr-signers" sx={{ mt: 5, pt: 2, borderTop: 1, borderColor: 'divider' }}>
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
                <TableCell>{signer.signedAt ?? ''}</TableCell>
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
