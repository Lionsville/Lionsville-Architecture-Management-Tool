// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Share with a Link…*: the link to the place on screen, to read, select and
 * copy again — or the sentence that says why there is none (ADR-0033,
 * amended). Presentational: the link is made, and copied the first time, by
 * `useShareLink`; this places what it is handed.
 *
 * The link is in a read-only field rather than in a paragraph, so a person
 * whose clipboard refused can select all of it with one click and a key, and
 * a screen reader reads it as the value of something named.
 */
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { ShareAnswer } from '../useShareLink'

export function ShareLinkDialog({ answer, onCopy, onClose, s }: {
  /** What the last press came to; absent, the dialog is shut. */
  answer: ShareAnswer | undefined
  onCopy: () => void
  onClose: () => void
  s: Translate
}) {
  const link = answer && 'link' in answer ? answer.link : undefined
  return (
    <Dialog
      open={answer !== undefined}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="share-link-title"
      data-testid="share-link-dialog"
    >
      <DialogTitle id="share-link-title" sx={{ fontSize: 15 }}>{s('share.title')}</DialogTitle>
      <DialogContent>
        {link !== undefined ? (
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Typography sx={{ fontSize: 13 }}>{s('share.what')}</Typography>
            <TextField
              value={link}
              size="small"
              fullWidth
              onFocus={(event) => event.target.select()}
              slotProps={{
                htmlInput: { readOnly: true, 'aria-label': s('share.linkLabel'), 'data-testid': 'share-link' },
              }}
            />
          </Stack>
        ) : answer && 'refused' in answer ? (
          <Typography sx={{ fontSize: 13, pt: 1 }} data-testid="share-refused">{s(answer.refused)}</Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        {link !== undefined && (
          <Button size="small" variant="outlined" onClick={onCopy}>{s('share.copy')}</Button>
        )}
        <Button size="small" onClick={onClose}>{s('common.close')}</Button>
      </DialogActions>
    </Dialog>
  )
}
