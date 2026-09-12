/**
 * The first screen on the desktop: where should your work live?
 *
 * It exists because of what it replaces. A desktop app that keeps documents
 * where a browser tab would keeps them in a leveldb inside `userData` —
 * invisible in a file manager, outside every backup, and gone with the app
 * (ADR-0003). So on the desktop there is no "somewhere in the app" any more:
 * either the user has chosen a folder or the app asks for one, and this is the
 * asking.
 *
 * Not a dialog over the picker. There is nothing behind it to look at, and a
 * dialog would imply there is something to dismiss it back to.
 */
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'

export type ChooseFolderProps = {
  /** Folders this machine has worked in before, most recent first. */
  recent?: readonly { root: string; name: string }[]
  onChoose: () => void
  onOpen: (root: string) => void
  s: Translate
  windowChrome?: WindowChrome
}

export function ChooseFolder({
  recent = [], onChoose, onOpen, s, windowChrome = NO_WINDOW_CHROME,
}: ChooseFolderProps) {
  return (
    <Box
      data-testid="choose-folder"
      sx={{
        height: '100vh', width: '100vw', overflowY: 'auto',
        bgcolor: 'background.default', px: 3, py: 5,
      }}
    >
      {windowChrome.draggable && (
        // The window has no title bar of its own; this padding is what it is
        // dragged by. The same strip the picker lends it.
        <Box
          data-testid="window-drag-strip"
          sx={{
            position: 'fixed', top: 0, left: 0, right: 0, height: 32,
            WebkitAppRegion: 'drag',
          }}
        />
      )}
      <Box sx={{ maxWidth: 560, mx: 'auto', mt: 8 }}>
        <Typography sx={{ fontSize: 24, fontWeight: 700 }}>{s('folder.title')}</Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 1 }}>
          {s('folder.body')}
        </Typography>

        <Button variant="contained" onClick={onChoose} sx={{ mt: 3 }}>
          {s('folder.choose')}
        </Button>

        {recent.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 1 }}>
              {s('folder.recent')}
            </Typography>
            <Stack alignItems="flex-start">
              {recent.map((held) => (
                <Button key={held.root} size="small" onClick={() => onOpen(held.root)}>
                  {held.name}
                </Button>
              ))}
            </Stack>
          </Box>
        )}
      </Box>
    </Box>
  )
}
