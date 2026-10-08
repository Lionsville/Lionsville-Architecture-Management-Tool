// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The merge screen (ADR-0035 §1): full window, over the observations page,
 * for observations and for causes. Three parts, top to bottom — what to
 * merge, what the survivor says, what moves with it — and Merge, which says
 * what it will make or why it cannot be pressed.
 *
 * It draws what `useMerge` worked out and hands every press back; what the
 * merge does is the rule's (`planMerge`), and where it lands the hook's.
 *
 * A page over a page, so it takes `windowChrome` as every full-window view
 * does: its top bar keeps clear of the traffic lights and moves the window.
 */
import { useId } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Radio from '@mui/material/Radio'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import { OBSERVATION_IMPACTS } from '../../model/observation'
import { NO_WINDOW_CHROME, barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { PageDialog } from '../../widgets/PageDialog'
import { IMPACT_LABEL, STATE_LABEL, STRENGTH_LABEL } from '../observationScope'
import { MERGE_LINK_REFUSAL } from '../mergeScreen'
import type { MergeLink, RecordAt } from '../merge'
import { DescriptionField } from './FormParts'
import { STRENGTHS } from './useMerge'
import type { MergeField, MergeRow, MergeScreenState } from './useMerge'

export type MergePageProps = {
  /** What the screen shows; closed while absent. */
  state: MergeScreenState | undefined
  s: Translate
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  windowChrome?: WindowChrome
  /** What the last merge across scopes came to, said after it; nothing while there is nothing to say. */
  note?: string
  onNoteClose: () => void
}

const keyOf = (at: RecordAt) => `${at.scope}#${at.id}`

function Section({ title, guide, hint, children }: { title: string; guide: string; hint?: string; children: ReactNode }) {
  return (
    <Box component="section" data-guide={guide} sx={{ display: 'grid', gap: 1.5, py: 2.5, borderBottom: 1, borderColor: 'divider' }}>
      <Box>
        <Typography variant="h6" component="h2">{title}</Typography>
        {hint && <Typography variant="body2" color="text.secondary">{hint}</Typography>}
      </Box>
      {children}
    </Box>
  )
}

/** A record as a row says it: its label, title and — where it is not this one's — its scope. */
function RowText({ row }: { row: MergeRow }) {
  return (
    <Box component="span" sx={{ display: 'grid' }}>
      <Box component="span">{`${row.label} ${row.title}`}</Box>
      {(row.scopeName !== undefined || row.closed !== undefined) && (
        <Typography component="span" variant="caption" color="text.secondary">
          {[row.scopeName, row.closed].filter(Boolean).join(' · ')}
        </Typography>
      )}
    </Box>
  )
}

/** What to merge: the set with its survivor, the search, and what it found. */
function WhatToMerge({ state, s }: { state: MergeScreenState; s: Translate }) {
  return (
    <Section title={s('observation.mergeWhat')} guide="merge.what">
      <Box role="radiogroup" aria-label={s('observation.mergeSurvivor')} data-testid="merge-picked" sx={{ display: 'grid', gap: 0.5 }}>
        <Typography variant="overline" color="text.secondary">{s('observation.mergePicked')}</Typography>
        {state.picked.map((row) => (
          <Box key={keyOf(row.at)} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControlLabel
              sx={{ flex: 1, mr: 0 }}
              control={(
                <Radio
                  size="small" checked={row.survivor} onChange={() => state.choose(row.at)}
                  slotProps={{ input: { 'data-guide': 'merge.survivor' } as object }}
                />
              )}
              label={<RowText row={row} />}
            />
            {row.survivor && <Typography variant="caption" color="text.secondary">{s('observation.mergeSurvivor')}</Typography>}
            {state.picked.length > 1 && (
              <Tooltip title={s('observation.mergeRemove', { label: row.label })}>
                <IconButton size="small" aria-label={s('observation.mergeRemove', { label: row.label })} onClick={() => state.toggle(row.at)}>
                  <Box component="span" aria-hidden sx={{ fontSize: 14, lineHeight: 1, width: 14 }}>✕</Box>
                </IconButton>
              </Tooltip>
            )}
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small" sx={{ flex: 1, minWidth: 260 }} value={state.query} onChange={(event) => state.setQuery(event.target.value)}
          label={s(state.kind === 'cause' ? 'observation.mergeSearchCauses' : 'observation.mergeSearchObservations')}
          slotProps={{ htmlInput: { 'data-guide': 'merge.search', 'data-testid': 'merge-search' } }}
        />
        <Box sx={{ display: 'grid' }}>
          <FormControlLabel
            control={(
              <Checkbox
                size="small" checked={state.across} onChange={(event) => state.setAcross(event.target.checked)}
                slotProps={{ input: { 'data-guide': 'merge.across' } as object }}
              />
            )}
            label={s('observation.mergeAcross')}
          />
          <Typography variant="caption" color="text.secondary">{s('observation.mergeAcrossHint')}</Typography>
        </Box>
      </Box>
      <Box data-testid="merge-hits" sx={{ display: 'grid', gap: 0.25, maxHeight: 320, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, px: 1.5, py: 0.5 }}>
        <Typography variant="overline" color="text.secondary">{s('observation.mergeFound')}</Typography>
        {state.hits.length === 0 && <Typography variant="body2" color="text.secondary">{s('observation.mergeNoHits')}</Typography>}
        {state.hits.map((row) => (
          <FormControlLabel
            key={keyOf(row.at)}
            data-testid={`merge-hit-${keyOf(row.at)}`}
            disabled={row.closed !== undefined && !row.picked}
            control={<Checkbox size="small" checked={row.picked} onChange={() => state.toggle(row.at)} />}
            label={<RowText row={row} />}
          />
        ))}
        {state.more > 0 && <Typography variant="caption" color="text.secondary">{s('observation.mergeMoreHits', { count: String(state.more) })}</Typography>}
      </Box>
    </Section>
  )
}

/** One value row's control: free text, a day, or one of a few. */
function FieldControl({ field, onChange, s }: { field: MergeField; onChange: (value: string) => void; s: Translate }) {
  const testId = `merge-field-${field.key}`
  if (field.key === 'root') {
    return (
      <FormControlLabel
        control={<Checkbox size="small" checked={field.value === 'true'} onChange={(event) => onChange(String(event.target.checked))} slotProps={{ input: { 'data-testid': testId } as object }} />}
        label={field.label}
      />
    )
  }
  const choices = field.key === 'impact'
    ? OBSERVATION_IMPACTS.map((one) => ({ value: one, label: s(IMPACT_LABEL[one]) }))
    : field.key === 'state' ? (['assumed', 'verified'] as const).map((one) => ({ value: one, label: s(STATE_LABEL[one]) })) : undefined
  return (
    <TextField
      size="small" fullWidth label={field.label} value={field.value} select={choices !== undefined}
      type={field.key === 'date' ? 'date' : undefined}
      onChange={(event) => onChange(event.target.value)}
      slotProps={{
        inputLabel: { shrink: true },
        htmlInput: { 'data-testid': testId, ...(choices ? { 'aria-label': field.label } : {}) },
      }}
    >
      {choices?.map((one) => <MenuItem key={one.value} value={one.value}>{one.label}</MenuItem>)}
    </TextField>
  )
}

/** What the survivor says: a row per value, each record's beside it to pick, and the description. */
function WhatItSays({ state, s, renderMarkdown }: { state: MergeScreenState; s: Translate; renderMarkdown: MergePageProps['renderMarkdown'] }) {
  return (
    <Section title={s('observation.mergeSays')} guide="merge.values" hint={s('observation.mergeSaysHint')}>
      {state.fields.map((field) => (
        <Box key={field.key} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 1.5, alignItems: 'center' }}>
          <FieldControl field={field} onChange={(value) => state.setField(field.key, value)} s={s} />
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {field.options.length > 1 && field.options.map((option) => (
              <Button
                key={`${option.label}-${option.value}`} size="small" sx={{ textTransform: 'none' }}
                variant={option.value === field.value ? 'contained' : 'outlined'} aria-pressed={option.value === field.value}
                title={s('observation.mergeUseTip', { label: option.label })} onClick={() => state.setField(field.key, option.value)}
              >
                {s('observation.mergeUse', { label: option.label, value: option.said })}
              </Button>
            ))}
          </Box>
        </Box>
      ))}
      {state.seen !== undefined && (
        <Typography variant="body2" data-testid="merge-seen">{s('observation.mergeSeenSum', { count: String(state.seen) })}</Typography>
      )}
      <DescriptionField
        label={s('observation.formDescription')} value={state.body} onChange={state.setBody}
        example={s('observation.mergeBodyExample')} renderMarkdown={renderMarkdown} s={s} minRows={8}
      />
      <Box>
        <Button size="small" variant="outlined" sx={{ textTransform: 'none' }} disabled={!state.addOthers} onClick={() => state.addOthers?.()} data-testid="merge-add-others">
          {s('observation.mergeAddOthers')}
        </Button>
      </Box>
    </Section>
  )
}

/** One link that names a record being merged: whether it moves, and how strong it lands. */
function LinkRow({ link, state, s }: { link: MergeLink; state: MergeScreenState; s: Translate }) {
  const said = s(link.kind === 'explains' ? 'observation.mergeLinkExplains' : 'observation.mergeLinkAddresses', {
    holder: state.nameAt(link.holder), target: state.nameAt(link.target),
  })
  const after = link.refusal
    ? s(MERGE_LINK_REFUSAL[link.refusal])
    : s('observation.mergeLinkAfter', { holder: state.nameAt(link.into.holder), target: state.nameAt(link.into.target) })
  return (
    <Box data-testid="merge-link" data-key={link.key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
      <FormControlLabel
        sx={{ flex: 1, minWidth: 280, mr: 0 }}
        disabled={link.refusal !== undefined}
        control={(
          <Checkbox
            size="small" checked={link.moves} onChange={(event) => state.setLink(link.key, { move: event.target.checked })}
            slotProps={{ input: { 'aria-label': s('observation.mergeLinkMove', { text: said }) } as object }}
          />
        )}
        label={(
          <Box component="span" sx={{ display: 'grid' }}>
            <Box component="span">{said}</Box>
            <Typography component="span" variant="caption" color="text.secondary">{after}</Typography>
          </Box>
        )}
      />
      {link.both && link.moves && (
        <TextField
          select size="small" sx={{ width: 160 }} label={s('observation.mergeLinkStrength')} value={link.offered}
          onChange={(event) => state.setLink(link.key, { strength: event.target.value as MergeLink['offered'] })}
          slotProps={{ htmlInput: { 'aria-label': s('observation.mergeLinkStrength') } }}
        >
          {STRENGTHS.map((one) => <MenuItem key={one} value={one}>{s(STRENGTH_LABEL[one])}</MenuItem>)}
        </TextField>
      )}
    </Box>
  )
}

function WhatMoves({ state, s }: { state: MergeScreenState; s: Translate }) {
  return (
    <Section title={s('observation.mergeMoves')} guide="merge.links">
      {state.links.length === 0
        ? <Typography variant="body2" color="text.secondary">{s('observation.mergeNoLinks')}</Typography>
        : state.links.map((link) => <LinkRow key={link.key} link={link} state={state} s={s} />)}
    </Section>
  )
}

export function MergePage({ state, s, renderMarkdown, windowChrome, note, onNoteClose }: MergePageProps) {
  const chrome = windowChrome ?? NO_WINDOW_CHROME
  const bar = barChromeFor(chrome)
  const title = s(state?.kind === 'cause' ? 'observation.mergeTitleCauses' : 'observation.mergeTitleObservations')
  const close = () => state?.close()
  // Named by its own heading: a dialog's aria-label lands on the modal's root, not on the dialog.
  const titleId = useId()
  return (
    <>
    <Snackbar
      open={note !== undefined} message={note} autoHideDuration={8000} onClose={onNoteClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} data-testid="merge-note"
    />
    <PageDialog open={Boolean(state)} topInset={chrome.topInset} onClose={close} aria-labelledby={titleId}>
      <Box
        data-testid="merge-topbar"
        sx={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, px: 1.5, pl: `${12 + bar.controlsInset}px`,
          WebkitAppRegion: bar.draggable ? 'drag' : undefined,
          '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
          minHeight: 48, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0,
        }}
      >
        <Tooltip title={s('observation.mergeClose')}>
          <IconButton size="small" aria-label={s('observation.mergeClose')} onClick={close}>
            <Box component="span" aria-hidden sx={{ display: 'inline-block', width: 18, textAlign: 'center', fontSize: 16, lineHeight: 1 }}>‹</Box>
          </IconButton>
        </Tooltip>
        <Typography variant="body1" component="h1" id={titleId} sx={{ fontWeight: 600 }}>{title}</Typography>
      </Box>
      {state && (
        <>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <Box sx={{ maxWidth: 980, mx: 'auto', px: 3, pb: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ pt: 2 }}>{s('observation.mergeIntro')}</Typography>
              <WhatToMerge state={state} s={s} />
              <WhatItSays state={state} s={s} renderMarkdown={renderMarkdown} />
              <WhatMoves state={state} s={s} />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 3, py: 1.25, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
            <Typography variant="body2" color="text.secondary" data-testid="merge-blocked" role="status" sx={{ flex: 1, minWidth: 0 }}>
              {state.confirm.blocked ?? ''}
            </Typography>
            <Button sx={{ textTransform: 'none' }} onClick={close}>{s('common.cancel')}</Button>
            <Button
              variant="contained" sx={{ textTransform: 'none' }} disabled={state.confirm.blocked !== undefined || state.confirm.busy}
              onClick={state.confirm.run} data-guide="merge.confirm" data-testid="merge-confirm"
            >
              {state.confirm.label}
            </Button>
          </Box>
        </>
      )}
    </PageDialog>
    </>
  )
}
