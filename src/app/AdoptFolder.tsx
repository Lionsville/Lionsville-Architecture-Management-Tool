/**
 * The question a folder pick asks when there is work in the app to bring along.
 *
 * Choosing a folder used to copy whatever browser storage held into it, once
 * per folder and without a word. That is right exactly once — the first time
 * somebody moves their work out of the app and into files — and wrong every
 * time after it: a folder made to start something new arrived with somebody
 * else's landscape already in it.
 *
 * So the copy became an answer rather than a side effect. Rendered by the
 * composition root the way {@link BootFailure} is, on its own and not over the
 * app, because the app is about to be mounted again against whichever store the
 * answer picks — and because a question behind a backdrop is a question that
 * gets clicked away.
 *
 * Both answers are safe, and the text says so: nothing is deleted either way,
 * and the work stays in the app until somebody moves it on purpose.
 */
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import type { Translate } from '../i18n'

export type AdoptFolderProps = {
  s: Translate
  /** The folder as the picker named it, shown so the answer is about a place. */
  folderName: string
  onCopy: () => void
  onSkip: () => void
}

export function AdoptFolder({ s, folderName, onCopy, onSkip }: AdoptFolderProps) {
  return (
    <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
      <Paper sx={{ maxWidth: 640, width: '100%', p: 3 }} data-testid="adopt-folder">
        <Typography sx={{ fontSize: 16, fontWeight: 600 }}>{s('folder.adoptTitle')}</Typography>
        <Typography sx={{ fontSize: 13, mt: 1 }}>
          {s('folder.adoptBody', { name: folderName })}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button size="small" variant="contained" onClick={onCopy} data-testid="adopt-copy">
            {s('folder.adoptCopy')}
          </Button>
          <Button size="small" onClick={onSkip} data-testid="adopt-skip">
            {s('folder.adoptSkip')}
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}
