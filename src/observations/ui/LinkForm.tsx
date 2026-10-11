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
import { CauseDraftFields, CausePicker, DescriptionField, ExistingCause, LinkRowsTable, LookAlikes, StrengthSelect } from './FormParts'
import type { LinkRow } from './FormParts'
import { FormDialog, problemsLine } from './FormDialog'

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

/** What a new cause holds while it is written: its own fields and the causes behind it. */
type NewCauseState = { draft: CauseDraft; behind: { key: string; strength: CauseStrength }[] }

const freshCause = (create: LinkSpec['create'], s: Translate): NewCauseState => ({
  draft: { title: '', why: '', root: Boolean(create?.rootFixed || create?.rootDefault), strength: 'normal', body: causeTemplate(s) },
  behind: [],
})

/** The footer per tab: its submit, and what it says is missing. */
const FOOT = {
  new: { label: 'observation.linkAdd', testId: 'link-create', missing: (s: Translate) => problemsLine(1, s) },
  existing: { label: 'observation.linkConfirm', testId: 'link-confirm', missing: (s: Translate) => s('observation.linkPickMissing') },
} as const

/** Something of a new cause has been written. */
function written({ draft, behind }: NewCauseState, s: Translate): boolean {
  return Boolean(draft.title.trim() || draft.why.trim() || behind.length) || draft.body !== causeTemplate(s)
}

/**
 * The dialog, both tabs in one width with one footer: *Add cause* under New,
 * *Link* under Existing, and what is missing at the left once it is pressed.
 * *Use this one* on a look-alike picks it under Existing, so its strength is
 * still chosen before it is linked.
 */
export function LinkDialog({ spec, onCancel, onCreate, onLink, renderMarkdown, s }: LinkDialogProps) {
  const [tab, setTab] = useState<Tab>('new')
  const [picked, setPicked] = useState('')
  const [strength, setStrength] = useState<CauseStrength>('normal')
  const [made, setMade] = useState<NewCauseState>(() => freshCause(spec?.create, s))
  const [pressed, setPressed] = useState(false)
  const id = spec?.id
  const create = spec?.create
  const hasCreate = Boolean(create)
  useEffect(() => {
    if (id === undefined) return
    setTab(hasCreate ? 'new' : 'existing'); setPicked(''); setStrength('normal'); setMade(freshCause(create, s)); setPressed(false)
    // Afresh for another record only: the spec is built anew on every render of the page.
  }, [id, hasCreate])
  const root = Boolean(create?.rootFixed || made.draft.root)
  const missing = pressed && (tab === 'new' ? !made.draft.title.trim() : !picked)
  const submit = () => {
    if (tab === 'existing') { if (picked) onLink(picked, strength); else setPressed(true); return }
    const { draft, behind } = made
    if (!draft.title.trim()) { setPressed(true); return }
    onCreate({ ...draft, title: draft.title.trim(), why: draft.why.trim(), root }, root ? [] : behind)
  }
  const use = (key: string) => { setTab('existing'); setPicked(key); setPressed(false) }
  const foot = FOOT[tab]

  return (
    <FormDialog
      open={Boolean(spec)} size="lg" title={spec?.title ?? ''} intro={spec?.intro} dirty={Boolean(picked) || written(made, s)}
      onCancel={onCancel} onSubmit={submit} submitLabel={s(foot.label)} submitTestId={foot.testId}
      submitDisabled={tab === 'existing' && !spec?.candidates.length} problem={missing ? foot.missing(s) : undefined} s={s}
    >
      {create && (
        <ToggleButtonGroup
          exclusive size="small" value={tab} onChange={(_event, next: Tab | null) => { if (next) { setTab(next); setPressed(false) } }}
          aria-label={s('observation.linkTabs')} data-testid="link-tabs" sx={{ alignSelf: 'flex-start' }}
        >
          <ToggleButton value="new" sx={{ textTransform: 'none', py: 0.25 }}>{s('observation.linkTabNew')}</ToggleButton>
          <ToggleButton value="existing" sx={{ textTransform: 'none', py: 0.25 }}>{s('observation.linkTabExisting', { count: spec?.candidates.length ?? 0 })}</ToggleButton>
        </ToggleButtonGroup>
      )}
      {spec && create && tab === 'new' && (
        <NewCause
          key={spec.id} spec={spec} create={create} made={made} onMade={setMade} root={root} problem={missing}
          onUse={use} renderMarkdown={renderMarkdown} s={s}
        />
      )}
      {spec && tab === 'existing' && (
        <>
          <ExistingCause
            candidates={spec.candidates} picked={picked} onPick={(key) => { setPicked(key); setPressed(false) }}
            label={s('observation.linkTabExisting', { count: spec.candidates.length })} empty={s('observation.linkNone')} s={s}
          />
          <StrengthSelect value={strength} onChange={setStrength} label={s('observation.causeStrength')} helperText={s('observation.causeStrengthExample')} s={s} />
        </>
      )}
    </FormDialog>
  )
}

/**
 * The cause form: the facts, the body, and what it links to. A root cause
 * ends the chain, so a root draft has nothing behind it and the rows go.
 */
function NewCause({ spec, create, made, onMade, root, problem, onUse, renderMarkdown, s }: {
  spec: LinkSpec
  create: NonNullable<LinkSpec['create']>
  made: NewCauseState
  onMade: (update: (held: NewCauseState) => NewCauseState) => void
  root: boolean
  /** The title was asked for and is still blank. */
  problem: boolean
  onUse: (key: string) => void
  renderMarkdown: LinkDialogProps['renderMarkdown']
  s: Translate
}) {
  const [picking, setPicking] = useState(false)
  const { draft, behind } = made
  const setDraft = (next: CauseDraft) => onMade((held) => ({ ...held, draft: next }))
  const setBehind = (update: (held: NewCauseState['behind']) => NewCauseState['behind']) => onMade((held) => ({ ...held, behind: update(held.behind) }))
  const alike = draft.title.trim().length >= 6 ? similarTitles(draft.title, spec.candidates) : []
  const labelOf = (key: string) => create.behind.find((one) => one.key === key)?.label ?? key
  const rows: LinkRow[] = [
    { key: 'explains', label: spec.subject, kind: 'existing', root: false, strength: draft.strength, fixed: true, role: s('observation.causeExplainsRow') },
    ...(root ? [] : behind.map((one) => ({
      key: one.key, label: labelOf(one.key), kind: 'existing' as const, root: false, strength: one.strength, role: s('observation.causeBehind'),
    }))),
  ]
  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 3 }}>
        <Box sx={{ display: 'grid', gap: 1, alignContent: 'start' }}>
          <CauseDraftFields
            autoFocus draft={{ ...draft, root }} rootFixed={create.rootFixed} s={s} onChange={setDraft}
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
          label={s('observation.formDescription')} optional value={draft.body ?? ''} onChange={(body) => onMade((held) => ({ ...held, draft: { ...held.draft, body } }))}
          example={s('observation.causeBodyExample')} renderMarkdown={renderMarkdown} s={s} minRows={8}
        />
      </Box>
      <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
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
            ? setDraft({ ...draft, strength })
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
    </>
  )
}
