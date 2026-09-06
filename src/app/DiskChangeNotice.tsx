/**
 * Somebody else changed this project.
 *
 * A working directory has other authors — a sync client, a colleague's
 * checkout, the same person on another machine — and the two states this strip
 * appears in are the only two the app cannot decide on its own.
 *
 * `external-changed` is the cheap one: nothing here is unsaved, so taking their
 * version costs nothing and is offered first. `conflict` is the expensive one,
 * and it is deliberately the only state in this app that requires a human.
 * There is no "merge" button because there is no merge: the choice is which
 * version survives, and pretending otherwise would be the one place this tool
 * lied about what it had done.
 *
 * A strip and not a dialog. A dialog would interrupt an edit that is perfectly
 * safe to finish, and would have to be dismissed before the person could look
 * at what they have — which is exactly what they need to look at in order to
 * choose.
 */
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import type { Translate } from '../i18n'
import type { DocumentStatus } from '../projects/documentSession'

export type DiskChangeNoticeProps = {
  status: DocumentStatus
  /** Read what is on disk and put it on screen. */
  onTakeTheirs: () => void
  /** Ours stands, and the next save writes over theirs. */
  onKeepMine: () => void
  /**
   * Neither: put ours somewhere else and decide later. The working file, which
   * is the same act the Save menu offers and is why there is no third store
   * operation behind this button.
   */
  onSaveCopy: () => void
  s: Translate
}

export function DiskChangeNotice({
  status, onTakeTheirs, onKeepMine, onSaveCopy, s,
}: DiskChangeNoticeProps) {
  if (status !== 'external-changed' && status !== 'conflict') return null
  const conflict = status === 'conflict'

  return (
    <Alert
      severity={conflict ? 'warning' : 'info'}
      square
      sx={{ py: 0.25, fontSize: 13, borderRadius: 0 }}
      data-testid="disk-change-notice"
      action={(
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={onTakeTheirs}>{s('shell.takeTheirs')}</Button>
          <Button size="small" onClick={onKeepMine}>{s('shell.keepMine')}</Button>
          {conflict && (
            <Button size="small" onClick={onSaveCopy}>{s('shell.saveACopy')}</Button>
          )}
        </Stack>
      )}
    >
      {s(conflict ? 'shell.diskConflict' : 'shell.diskChanged')}
    </Alert>
  )
}
