// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import type { StringKey } from '../../i18n'
import type { SourceWayIn } from '../../platform/sourceProvider'

export type ChooseFolderProps = {
  /** Folders this machine has worked in before, most recent first. */
  recent?: readonly { root: string; name: string }[]
  onChoose: () => void
  onOpen: (root: string) => void
  /**
   * The other places this build can work from, one button each.
   *
   * Empty for every build in this repository — a folder is the only way in core
   * registers — and then this screen reads exactly as it always has. A build
   * that registered a provider of its own asks the same question here as it
   * does on the organisation screen: this is the screen where there is no
   * answer yet, and offering only a folder on it would be offering a person
   * the one thing their build was composed not to use.
   */
  waysIn?: readonly SourceWayIn[]
  s: Translate
  windowChrome?: WindowChrome
}

export function ChooseFolder({
  recent = [], onChoose, onOpen, waysIn = [], s, windowChrome = NO_WINDOW_CHROME,
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

        <Stack direction="row" spacing={1} sx={{ mt: 3 }} flexWrap="wrap">
          <Button variant="contained" onClick={onChoose}>
            {s('folder.choose')}
          </Button>
          {waysIn.map((way) => (
            <Button
              key={way.kind}
              variant="outlined"
              data-testid={`connect-source-${way.kind}`}
              onClick={way.onConnect}
            >
              {/* The provider's key, from its own table or from this one's
                  (`i18n/registerStrings`); the shell only renders it. */}
              {s(way.labelKey as StringKey)}
            </Button>
          ))}
        </Stack>

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
