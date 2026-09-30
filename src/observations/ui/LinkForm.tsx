// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What lies behind a record, or what a cause explains across a scope boundary
 * (ADR-0032 §4, §6): one dialog for the reader's *Cause*, *Deeper cause*,
 * *Root cause*, *Org cause* and *Local cause*.
 *
 * **New** is the cause form: its facts on the left with an example on every
 * field and *it is a root cause*, the optional body with Edit and Preview on
 * the right, and under them the table of what it links to — what it explains,
 * and the causes already written down that lie behind it — made on submit,
 * as one step. **Existing** picks a cause the rules allow: the page offers
 * only those, so a loop, a link into a root cause, upward or sideways is
 * never on the list.
 *
 * The dialog says what it wants and the page performs it, in the scope the
 * record lives in.
 */
import { useEffect, useState, type ReactNode } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import { LinkIcon } from '../../widgets/icons'
import { causeTemplate, formatCauseNumber } from '../observation'
import type { CauseStrength } from '../observation'
import type { CauseDraft } from '../form'
import { similarTitles } from '../wording'
import { CauseDraftFields, CausePicker, DescriptionField, LinkRowsTable, LookAlikes, StrengthSelect } from './FormParts'
import type { LinkRow } from './FormParts'

/** A cause the dialog may link, by the key the page reads back. */
export type LinkCandidate = { key: string; label: string; root: boolean; title: string }

/** What one opening of the dialog is for, said by the page. */
export type LinkSpec = {
  /** Which record, for the dialog's own freshness. */
  id: string
  title: string
  intro: string
  /** The record the new cause, or the chosen one, explains. */
  subject: string
  candidates: readonly LinkCandidate[]
  /** Where a new cause may be made; absent where only an existing one may be linked. */
  create?: {
    /** The scope it is made in, by name. */
    madeIn: string
    nextNumber: number
    /** Made a root cause, and nothing else: the mode asked for one. */
    rootFixed?: boolean
    rootDefault?: boolean
    /** Causes of the scope it is made in that may lie behind it. */
    behind: readonly LinkCandidate[]
  }
}

export type LinkDialogProps = {
  /** Closed while undefined. */
  spec: LinkSpec | undefined
  onCancel: () => void
  onCreate: (draft: CauseDraft, behind: { key: string; strength: CauseStrength }[]) => void
  onLink: (key: string, strength: CauseStrength) => void
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  s: Translate
}

type Tab = 'new' | 'existing'

export function LinkDialog({ spec, onCancel, onCreate, onLink, renderMarkdown, s }: LinkDialogProps) {
  const [tab, setTab] = useState<Tab>('new')
  const [picked, setPicked] = useState('')
  const [strength, setStrength] = useState<CauseStrength>('normal')
  const [missing, setMissing] = useState(false)
  const id = spec?.id
  const hasCreate = Boolean(spec?.create)
  useEffect(() => {
    if (id === undefined) return
    setTab(hasCreate ? 'new' : 'existing'); setPicked(''); setStrength('normal'); setMissing(false)
  }, [id, hasCreate])
  const link = () => { if (!picked) { setMissing(true); return } onLink(picked, strength) }

  return (
    <Dialog open={Boolean(spec)} onClose={onCancel} maxWidth={tab === 'new' ? 'lg' : 'sm'} fullWidth aria-labelledby="link-dialog-title">
      <DialogTitle id="link-dialog-title">{spec?.title ?? ''}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 13, mb: 1.5 }}>{spec?.intro}</DialogContentText>
        {spec?.create && (
          <ToggleButtonGroup
            exclusive size="small" value={tab} onChange={(_event, next: Tab | null) => { if (next) setTab(next) }}
            aria-label={s('observation.linkTabs')} sx={{ mb: 2 }} data-testid="link-tabs"
          >
            <ToggleButton value="new" sx={{ textTransform: 'none', py: 0.25 }}>{s('observation.linkTabNew')}</ToggleButton>
            <ToggleButton value="existing" sx={{ textTransform: 'none', py: 0.25 }}>{s('observation.linkTabExisting', { count: spec.candidates.length })}</ToggleButton>
          </ToggleButtonGroup>
        )}
        {spec?.create && tab === 'new' && (
          <NewCause key={spec.id} spec={spec} create={spec.create} onCreate={onCreate} onUse={(key) => onLink(key, 'normal')} onCancel={onCancel} renderMarkdown={renderMarkdown} s={s} />
        )}
        {spec && tab === 'existing' && (
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            <ExistingCause candidates={spec.candidates} picked={picked} onPick={(key) => { setPicked(key); setMissing(false) }} s={s} />
            {missing && <Typography role="alert" color="error" sx={{ fontSize: 13 }}>{s('observation.linkPickMissing')}</Typography>}
            <StrengthSelect value={strength} onChange={setStrength} label={s('observation.causeStrength')} helperText={s('observation.causeStrengthExample')} s={s} />
          </Box>
        )}
      </DialogContent>
      {tab === 'existing' && (
        <DialogActions>
          <Button onClick={onCancel} sx={{ textTransform: 'none' }}>{s('common.cancel')}</Button>
          <Button variant="contained" onClick={link} disabled={!spec?.candidates.length} sx={{ textTransform: 'none' }} data-testid="link-confirm">{s('observation.linkConfirm')}</Button>
        </DialogActions>
      )}
    </Dialog>
  )
}

function ExistingCause({ candidates, picked, onPick, s }: {
  candidates: readonly LinkCandidate[]
  picked: string
  onPick: (key: string) => void
  s: Translate
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = candidates.filter((one) => !q || one.label.toLowerCase().includes(q))
  return (
    <>
      <TextField
        autoFocus size="small" fullWidth placeholder={s('observation.causeFind')} value={query}
        onChange={(event) => setQuery(event.target.value)}
        slotProps={{ htmlInput: { 'aria-label': s('observation.causeFind') } }}
      />
      <Box sx={{ maxHeight: 260, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
        {shown.length === 0 && <Typography sx={{ px: 1.5, py: 1, fontSize: 13, color: 'text.secondary' }}>{s('observation.linkNone')}</Typography>}
        <RadioGroup value={picked} onChange={(event) => onPick(event.target.value)} aria-label={s('observation.linkTabExisting', { count: candidates.length })}>
          {shown.map((one) => (
            <FormControlLabel
              key={one.key} value={one.key} data-testid="link-candidate"
              control={<Radio size="small" />}
              label={(
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13 }}>
                  {one.label}
                  {one.root && <Chip size="small" variant="outlined" color="secondary" label={s('observation.formKindRoot')} sx={{ height: 18, fontSize: 10 }} />}
                </Box>
              )}
              sx={{ mx: 0, px: 1, borderBottom: 1, borderColor: 'divider' }}
            />
          ))}
        </RadioGroup>
      </Box>
    </>
  )
}

/**
 * The cause form: the facts, the body, and what it links to. A root cause
 * ends the chain, so a root draft has nothing behind it and the rows go.
 */
function NewCause({ spec, create, onCreate, onUse, onCancel, renderMarkdown, s }: {
  spec: LinkSpec
  create: NonNullable<LinkSpec['create']>
  onCreate: LinkDialogProps['onCreate']
  onUse: (key: string) => void
  onCancel: () => void
  renderMarkdown: LinkDialogProps['renderMarkdown']
  s: Translate
}) {
  const [draft, setDraft] = useState<CauseDraft>(() => ({
    title: '', why: '', root: Boolean(create.rootFixed || create.rootDefault), strength: 'normal', body: causeTemplate(s),
  }))
  const [problem, setProblem] = useState(false)
  const [behind, setBehind] = useState<{ key: string; strength: CauseStrength }[]>([])
  const [picking, setPicking] = useState(false)
  const root = Boolean(create.rootFixed || draft.root)
  const alike = draft.title.trim().length >= 6 ? similarTitles(draft.title, spec.candidates) : []
  const labelOf = (key: string) => create.behind.find((one) => one.key === key)?.label ?? key
  const rows: LinkRow[] = [
    { key: 'explains', label: spec.subject, kind: 'existing', root: false, strength: draft.strength, fixed: true, role: s('observation.causeExplainsRow') },
    ...(root ? [] : behind.map((one) => ({
      key: one.key, label: labelOf(one.key), kind: 'existing' as const, root: false, strength: one.strength, role: s('observation.causeBehind'),
    }))),
  ]
  const submit = () => {
    if (!draft.title.trim()) { setProblem(true); return }
    onCreate({ ...draft, title: draft.title.trim(), why: draft.why.trim(), root }, root ? [] : behind)
  }
  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 3 }}>
        <Box sx={{ display: 'grid', gap: 1, alignContent: 'start' }}>
          <CauseDraftFields
            autoFocus draft={{ ...draft, root }} rootFixed={create.rootFixed} s={s}
            onChange={(next) => { setDraft(next); if (next.title.trim()) setProblem(false) }}
            problem={problem ? s('observation.causeTitleMissing') : undefined}
            alike={(
              <LookAlikes
                testId="link-cause-alike" title={s('observation.causeAlike')}
                action={{ label: s('observation.causeUse'), icon: <LinkIcon size={14} /> }}
                rows={alike.map((one) => ({ id: one.key, label: one.label, tip: s('observation.linkUseTip'), onUse: () => onUse(one.key) }))}
              />
            )}
          />
          <Typography variant="caption" color="text.secondary" data-testid="link-made-as">
            {s('observation.madeAs', { scope: create.madeIn, label: formatCauseNumber(create.nextNumber, root) })}
          </Typography>
        </Box>
        <DescriptionField
          label={s('observation.causeBody')} value={draft.body ?? ''} onChange={(body) => setDraft((held) => ({ ...held, body }))}
          example={s('observation.causeBodyExample')} renderMarkdown={renderMarkdown} s={s} minRows={8}
        />
      </Box>
      <Box sx={{ borderTop: 1, borderColor: 'divider', mt: 2, pt: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography component="h3" sx={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{s('observation.causeLinks')}</Typography>
          {!root && create.behind.length > 0 && (
            <Tooltip title={s('observation.causeBehindTip')} describeChild>
              <Button size="small" variant="outlined" startIcon={<LinkIcon size={14} />} onClick={() => setPicking(true)} sx={{ textTransform: 'none' }} data-testid="link-behind-add">
                {s('observation.causeBehindAdd')}
              </Button>
            </Tooltip>
          )}
        </Box>
        {root && <Alert severity="info" variant="outlined" sx={{ mb: 1, fontSize: 13 }}>{s('observation.rootNote')}</Alert>}
        <LinkRowsTable
          rows={rows} s={s} testId="link-rows" empty=""
          onStrength={(key, strength) => (key === 'explains'
            ? setDraft((held) => ({ ...held, strength }))
            : setBehind((held) => held.map((one) => (one.key === key ? { ...one, strength } : one))))}
          onRemove={(key) => setBehind((held) => held.filter((one) => one.key !== key))}
        />
        {picking && !root && (
          <CausePicker
            heading={s('observation.existingIn', { scope: create.madeIn })}
            candidates={create.behind.map((one) => ({ id: one.key, label: one.label, root: one.root }))}
            taken={new Set(behind.map((one) => one.key))}
            onPick={(key) => setBehind((held) => [...held, { key, strength: 'normal' }])}
            onClose={() => setPicking(false)} s={s}
          />
        )}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
        <Button onClick={onCancel} sx={{ textTransform: 'none' }}>{s('common.cancel')}</Button>
        <Button variant="contained" onClick={submit} sx={{ textTransform: 'none' }} data-testid="link-create">{s('observation.linkAdd')}</Button>
      </Box>
    </>
  )
}
