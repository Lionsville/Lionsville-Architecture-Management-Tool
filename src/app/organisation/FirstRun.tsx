// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The first screen where work has nowhere to be kept yet: where should it
 * live?
 *
 * It exists because of what it replaces. A desktop app that keeps documents
 * where a browser tab would keeps them somewhere invisible in a file manager,
 * outside every backup, and gone with the app (ADR-0003). So where a way in
 * says it is needed (`SourceConnect.required`) there is no "somewhere in the
 * app": either the person has chosen where work lives or the app asks, and
 * this is the asking — in the words of the way in it asks for, and with the
 * places this machine worked from lately one click away.
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

export type FirstRunProps = {
  /**
   * Every way in this build offers, in the order they registered: the one the
   * screen asks for first and filled, the rest beside it — a build that
   * registered a provider of its own asks the same question here as it does
   * on the organisation screen.
   */
  waysIn: readonly SourceWayIn[]
  s: Translate
  windowChrome?: WindowChrome
}

export function FirstRun({ waysIn, s, windowChrome = NO_WINDOW_CHROME }: FirstRunProps) {
  const asked = waysIn.find((way) => way.required)
  const others = waysIn.filter((way) => way !== asked)
  const recent = asked?.recent ?? []
  const said = (key: StringKey | (string & {})) => s(key as StringKey)
  return (
    <Box
      data-testid="first-run"
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
        <Typography sx={{ fontSize: 24, fontWeight: 700 }}>{s('source.firstTitle')}</Typography>
        {asked?.introKey && (
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 1 }}>{said(asked.introKey)}</Typography>
        )}

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 3 }}>
          {asked && (
            <Button variant="contained" data-testid={`connect-source-${asked.kind}`} onClick={asked.onConnect}>
              {said(asked.firstLabelKey ?? asked.labelKey)}
            </Button>
          )}
          {others.map((way) => (
            <Button
              key={way.kind}
              variant="outlined"
              data-testid={`connect-source-${way.kind}`}
              onClick={way.onConnect}
            >
              {/* The provider's key, from its own table or from this one's
                  (`i18n/registerStrings`); the shell only renders it. */}
              {said(way.labelKey)}
            </Button>
          ))}
        </Stack>

        {recent.length > 0 && asked?.onReopen && (
          <Box sx={{ mt: 4 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 1 }}>
              {s('source.recent')}
            </Typography>
            <Stack sx={{ alignItems: 'flex-start' }}>
              {recent.map((held) => (
                <Button key={held.key} size="small" onClick={() => asked.onReopen?.(held.key)}>
                  {held.label}
                </Button>
              ))}
            </Stack>
          </Box>
        )}
      </Box>
    </Box>
  )
}
