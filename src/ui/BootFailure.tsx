/**
 * The screen when the app could not start at all.
 *
 * Everything else in this shell assumes there is an app around it. This one
 * does not: it is rendered by the composition root when the promise that reads
 * the preferences and the last project rejects, at which point there is no
 * theme, no language setting and no toast bar — only what the browser reports
 * and what `translator()` can do with it.
 *
 * The button is the point. A `lastProject` that this build cannot open is
 * reopened on every boot, so the app fails the same way every time and the only
 * way back is to know how to clear browser storage by hand. "Start without the
 * last project" drops that one field and carries on; nothing is deleted.
 */
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import type { Translate } from '@lionsville/solution-design'
import { describeCause } from '../core/diagnostics'

export type BootFailureProps = {
  s: Translate
  /** Whatever the boot chain rejected with. Shown, so a report can quote it. */
  error: unknown
  onStartFresh: () => void
  onReload: () => void
}

export function BootFailure({ s, error, onStartFresh, onReload }: BootFailureProps) {
  return (
    <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
      <Alert severity="error" sx={{ maxWidth: 640, width: '100%' }} data-testid="boot-failure">
        <AlertTitle>{s('shell.bootFailed')}</AlertTitle>
        <Typography sx={{ fontSize: 13 }}>{s('shell.bootFailedNote')}</Typography>
        <Typography sx={{ fontSize: 12, mt: 1, color: 'text.secondary' }}>
          {describeCause(error)}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button size="small" variant="contained" onClick={onStartFresh}>
            {s('shell.startFresh')}
          </Button>
          <Button size="small" onClick={onReload}>{s('shell.reload')}</Button>
        </Box>
      </Alert>
    </Box>
  )
}
