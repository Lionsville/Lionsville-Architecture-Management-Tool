/**
 * The folder and its remote have both moved on.
 *
 * `DiskChangeNotice` scaled up from one file to the folder (ADR-0005): there
 * is no merge button because there is no merge, and the two answers are
 * *take theirs* and *keep ours*. Both keep everything — ours goes on a branch
 * in one case and becomes a merge commit whose tree is ours in the other —
 * so neither button needs a warning, only a name.
 *
 * A strip and not a dialog, for the same reason as the other one: the person
 * needs to look at what they have in order to choose.
 */
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import type { Translate } from '../i18n'

export type SyncNoticeProps = {
  open: boolean
  onTakeTheirs: () => void
  onKeepOurs: () => void
  s: Translate
}

export function SyncNotice({ open, onTakeTheirs, onKeepOurs, s }: SyncNoticeProps) {
  if (!open) return null
  return (
    <Alert
      severity="warning"
      square
      sx={{ py: 0.25, fontSize: 13, borderRadius: 0, flex: '0 0 auto' }}
      data-testid="sync-notice"
      action={(
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={onTakeTheirs}>{s('sync.takeTheirs')}</Button>
          <Button size="small" onClick={onKeepOurs}>{s('sync.keepOurs')}</Button>
        </Stack>
      )}
    >
      {s('sync.diverged')}
    </Alert>
  )
}
