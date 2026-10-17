// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A finding marked as intended, on screen (ADR-0036, amended 11 October
 * 2026): *Mark as intended…* under an explanation's actions, and *Accepted
 * (N)* under a list's groups — the two places `FindingsList` keeps for them
 * (`more`, `accepted`).
 *
 * **Asked, never required.** *Mark as intended…* asks why it is meant to be
 * so in one field, which may stay empty, and says what a mark does before it
 * is made: the finding leaves the list, is listed apart where anybody can
 * take it back, and comes back by itself when what it is about changes.
 *
 * **Accepted is folded**, like a check's group: what a person settled is
 * there for whoever looks, each with its reason and its day, and *Take back*
 * where the mark may be taken back here.
 *
 * **It knows no model**, as the list does not: the words come as keys in the
 * table the model publishes (`model/checkMarks.CHECK_MARK_WORDS`), and what
 * a mark is, where it is kept and how it is written are the screen's — handed
 * in as `onMark` and `onTakeBack`.
 */
import { useId, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import { FieldsDialog } from './CompactForms'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useStrings } from '../i18n'
import type { StringKey } from '../i18n'
import { formatDay } from '../i18n/dates'
import { useSessionSet } from './sessionMemory'

/** What the two pieces say: the model's `CHECK_MARK_WORDS` is the table. */
export type FindingMarkWords = {
  readonly open: StringKey
  readonly title: StringKey
  readonly about: StringKey
  readonly reason: StringKey
  readonly reasonHelp: StringKey
  readonly confirm: StringKey
  readonly cancel: StringKey
  readonly accepted: StringKey
  readonly on: StringKey
  readonly noReason: StringKey
  readonly takeBack: StringKey
}

const SMALL = { fontSize: 12 } as const
const QUIET = { fontSize: 11.5, color: 'text.secondary' } as const

/**
 * *Mark as intended…*: the button, and the question it asks — the finding in
 * its sentence, what a mark does, and why it is meant to be so.
 */
export function MarkAsIntended({ words, sentence, onMark, inline = false }: {
  words: FindingMarkWords
  /** The finding in its own sentence, said again over the question. */
  sentence: string
  /** Make the mark, with the reason given; an empty one is none. */
  onMark: (reason: string) => void
  /** Beside something on its line, rather than under an explanation's actions. */
  inline?: boolean
}) {
  const { t } = useStrings()
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const titleId = useId()
  const close = () => { setAsking(false); setReason('') }
  const confirm = () => { onMark(reason.trim()); close() }
  return (
    <Box sx={inline ? { flex: 'none' } : { mt: 1 }}>
      <Button
        size="small" variant="text" onClick={() => setAsking(true)} aria-label={inline ? `${t(words.open)} ${sentence}` : undefined}
        data-guide="findings.markIntended" data-testid="finding-mark" sx={{ fontSize: 11.5, textTransform: 'none', px: 0.5 }}
      >
        {t(words.open)}
      </Button>
      <FieldsDialog open={asking} onClose={close} maxWidth="xs" fullWidth aria-labelledby={titleId}>
        <DialogTitle id={titleId} sx={{ fontSize: 16 }}>{t(words.title)}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1 }} data-testid="finding-mark-sentence">{sentence}</Typography>
          <Typography sx={{ ...SMALL, color: 'text.secondary', mb: 1.5 }}>{t(words.about)}</Typography>
          <TextField
            autoFocus fullWidth label={t(words.reason)} helperText={t(words.reasonHelp)} value={reason}
            onChange={(event) => setReason(event.target.value)}
            // The Enter it acts on is consumed, so it cannot go on to press whatever takes the focus next.
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); confirm() } }}
            slotProps={{ htmlInput: { 'data-testid': 'finding-mark-reason', maxLength: 500 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>{t(words.cancel)}</Button>
          <Button variant="contained" onClick={confirm} data-testid="finding-mark-confirm">{t(words.confirm)}</Button>
        </DialogActions>
      </FieldsDialog>
    </Box>
  )
}

/** One finding marked as intended, as *Accepted* lists it. */
export type AcceptedFinding = {
  /** What tells it from the others in the list. */
  readonly key: string
  /** The finding in its own sentence. */
  readonly sentence: string
  readonly reason?: string | undefined
  /** The day it was marked, `yyyy-mm-dd`. */
  readonly on: string
  /** Take the mark back; absent where it may not be taken back here. */
  readonly onTakeBack?: (() => void) | undefined
}

/** The fold's own word in the session's set: the list is open. */
const OPEN = 'open'

/**
 * *Accepted (N)*: the findings of a list that were marked as intended,
 * folded, each with its reason, its day and *Take back*. Nothing where none
 * was marked.
 */
export function AcceptedFindings({ items, words, remember, unfolded = false, testId }: {
  items: readonly AcceptedFinding[]
  words: FindingMarkWords
  /** Where the session keeps whether it is open: beside the list's own folds. */
  remember?: string | undefined
  /** Always open, under a heading: on a page about one check, where there is nothing else to fold it away from. */
  unfolded?: boolean
  testId?: string
}) {
  const { t, language } = useStrings()
  const [held, setHeld] = useSessionSet(remember === undefined ? undefined : `${remember}\u0000accepted`)
  const id = useId()
  if (items.length === 0) return null
  const open = unfolded || held.has(OPEN)
  return (
    <Box data-testid={testId ?? 'findings-accepted'} sx={{ mt: 0.75 }}>
      {unfolded
        ? <Typography component="h3" sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', mt: 1.25, mb: 0.25 }}>{t(words.accepted, { count: items.length })}</Typography>
        : (
          <ButtonBase
            aria-expanded={open} aria-controls={id} onClick={() => setHeld(new Set(open ? [] : [OPEN]))}
            data-guide="findings.accepted" data-testid="findings-accepted-toggle"
            sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, py: 0.25, fontSize: 12, color: 'text.secondary', '&:hover': { textDecoration: 'underline' } }}
          >
            <Box component="span" aria-hidden sx={{ width: 10, fontSize: 10 }}>{open ? '▾' : '▸'}</Box>
            {t(words.accepted, { count: items.length })}
          </ButtonBase>
        )}
      {open && (
        <Box component="ul" id={id} sx={{ listStyle: 'none', m: 0, pl: 1.75, pr: 0 }}>
          {items.map((item) => (
            <Box component="li" key={item.key} data-testid="accepted-finding" sx={{ py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography sx={SMALL}>{item.sentence}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ ...QUIET, flex: 1, minWidth: 0 }} data-testid="accepted-reason">
                  {item.reason ? `“${item.reason}”` : t(words.noReason)} · {t(words.on, { day: formatDay(item.on, language) })}
                </Typography>
                {item.onTakeBack && (
                  <Button size="small" onClick={item.onTakeBack} data-guide="findings.takeBack" data-testid="finding-take-back"
                    aria-label={`${t(words.takeBack)}: ${item.sentence}`}
                    sx={{ fontSize: 11.5, textTransform: 'none', minWidth: 0, px: 0.5 }}>
                    {t(words.takeBack)}
                  </Button>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
