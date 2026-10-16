// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The move screen (ADR-0038 §5): full window, over the observations page, as
 * the merge screen is. Three parts, top to bottom — what moves, where to,
 * and what is cut — and Move, which says what it will do or why it cannot be
 * pressed. The scope is picked by its path from the organisation down
 * (`scopeTrail`), nearest first; one the person may read and not change is
 * listed and cannot be picked.
 *
 * It draws what `useMove` worked out and hands every press back; what the
 * move does is the rule's (`planMove`), and where it lands the hook's.
 *
 * A page over a page, so it takes `windowChrome` as every full-window view
 * does: its top bar keeps clear of the traffic lights and moves the window.
 */
import { useId } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Radio from '@mui/material/Radio'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import { NO_WINDOW_CHROME, barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { PageDialog } from '../../widgets/PageDialog'
import { BRIGHT_LABEL } from '../observationScope'
import type { MoveRow, MoveScreenState } from './useMove'

export type MovePageProps = {
  /** What the screen shows; closed while absent. */
  state: MoveScreenState | undefined
  s: Translate
  windowChrome?: WindowChrome
  /** What the last move came to, said after it; nothing while there is nothing to say. */
  note?: string
  onNoteClose: () => void
}

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

/** What moves: the record, its sightings and its thread. */
function WhatMoves({ state, s }: { state: MoveScreenState; s: Translate }) {
  return (
    <Section title={s('observation.moveWhat')} guide="move.what">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }} data-testid="move-record">
        <Typography variant="body1" sx={{ fontWeight: 600 }}>{`${state.label} ${state.title}`}</Typography>
        {state.bright && <Chip size="small" color="success" variant="outlined" label={s(BRIGHT_LABEL)} />}
      </Box>
      <Typography variant="body2" color="text.secondary">
        {[s('observation.moveSeen', { count: String(state.seen) }), state.comments > 0 ? s('observation.moveComments', { count: String(state.comments) }) : '']
          .filter(Boolean).join(' · ')}
      </Typography>
    </Section>
  )
}

/** Where to: the scopes, nearest first, each by its path; the one picked; and what it becomes there. */
function WhereTo({ state, s }: { state: MoveScreenState; s: Translate }) {
  return (
    <Section title={s('observation.moveTarget')} guide="move.target" hint={s('observation.moveTargetHint')}>
      <TextField
        size="small" sx={{ maxWidth: 520 }} value={state.query} onChange={(event) => state.setQuery(event.target.value)}
        label={s('observation.moveSearch')}
        slotProps={{ htmlInput: { 'data-guide': 'move.search', 'data-testid': 'move-search' } }}
      />
      <Box
        role="radiogroup" aria-label={s('observation.moveTarget')} data-testid="move-targets"
        sx={{ display: 'grid', gap: 0.25, maxHeight: 320, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, px: 1.5, py: 0.5 }}
      >
        {state.targets.length === 0 && <Typography variant="body2" color="text.secondary">{s('observation.moveNoScopes')}</Typography>}
        {state.targets.map((one) => (
          <FormControlLabel
            key={one.path}
            data-testid={`move-target-${one.path}`}
            disabled={one.closed !== undefined}
            control={<Radio size="small" checked={one.picked} onChange={() => state.pick(one.path)} />}
            label={(
              <Box component="span" sx={{ display: 'grid' }}>
                <Box component="span">{one.name}</Box>
                {one.closed !== undefined && <Typography component="span" variant="caption" color="text.secondary">{one.closed}</Typography>}
              </Box>
            )}
          />
        ))}
      </Box>
      {state.becomes && <Typography variant="body2" data-testid="move-becomes">{state.becomes}</Typography>}
    </Section>
  )
}

function Rows({ rows, testId }: { rows: readonly MoveRow[]; testId: string }) {
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'grid', gap: 0.75 }}>
      {rows.map((row) => (
        <Box component="li" key={row.key} data-testid={testId}>
          <Box component="span" sx={{ display: 'grid' }}>
            <Box component="span">{row.cause}</Box>
            {row.reaches && <Typography component="span" variant="caption" color="text.secondary">{row.reaches}</Typography>}
          </Box>
        </Box>
      ))}
    </Box>
  )
}

/** What is cut, said before anything is written (ADR-0038 §2, §3); and, moving back, what explains it again. */
function WhatIsCut({ state, s }: { state: MoveScreenState; s: Translate }) {
  return (
    <Section title={s('observation.moveCut')} guide="move.cut">
      {state.cut.length === 0
        ? <Typography variant="body2" color="text.secondary">{s('observation.moveCutNone')}</Typography>
        : <Rows rows={state.cut} testId="move-cut" />}
      {state.restored.length > 0 && (
        <>
          <Typography variant="overline" color="text.secondary">{s('observation.moveRestored')}</Typography>
          <Rows rows={state.restored} testId="move-restored" />
        </>
      )}
    </Section>
  )
}

export function MovePage({ state, s, windowChrome, note, onNoteClose }: MovePageProps) {
  const chrome = windowChrome ?? NO_WINDOW_CHROME
  const bar = barChromeFor(chrome)
  const close = () => state?.close()
  // Named by its own heading: a dialog's aria-label lands on the modal's root, not on the dialog.
  const titleId = useId()
  return (
    <>
    <Snackbar
      open={note !== undefined} message={note} autoHideDuration={8000} onClose={onNoteClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} data-testid="move-note"
    />
    <PageDialog open={Boolean(state)} topInset={chrome.topInset} onClose={close} aria-labelledby={titleId}>
      <Box
        data-testid="move-topbar"
        sx={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, px: 1.5, pl: `${12 + bar.controlsInset}px`,
          WebkitAppRegion: bar.draggable ? 'drag' : undefined,
          '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
          minHeight: 48, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0,
        }}
      >
        <Tooltip title={s('observation.moveClose')}>
          <IconButton size="small" aria-label={s('observation.moveClose')} onClick={close}>
            <Box component="span" aria-hidden sx={{ display: 'inline-block', width: 18, textAlign: 'center', fontSize: 16, lineHeight: 1 }}>‹</Box>
          </IconButton>
        </Tooltip>
        <Typography variant="body1" component="h1" id={titleId} sx={{ fontWeight: 600 }}>{s('observation.moveTitle')}</Typography>
      </Box>
      {state && (
        <>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <Box sx={{ maxWidth: 980, mx: 'auto', px: 3, pb: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ pt: 2 }}>{s('observation.moveIntro')}</Typography>
              <WhatMoves state={state} s={s} />
              <WhereTo state={state} s={s} />
              <WhatIsCut state={state} s={s} />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 3, py: 1.25, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
            <Typography variant="body2" color="text.secondary" data-testid="move-blocked" role="status" sx={{ flex: 1, minWidth: 0 }}>
              {state.confirm.blocked ?? ''}
            </Typography>
            <Button sx={{ textTransform: 'none' }} onClick={close}>{s('common.cancel')}</Button>
            <Button
              variant="contained" sx={{ textTransform: 'none' }} disabled={state.confirm.blocked !== undefined || state.confirm.busy}
              onClick={state.confirm.run} data-guide="move.confirm" data-testid="move-confirm"
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
