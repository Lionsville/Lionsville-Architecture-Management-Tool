/**
 * The one MUI theme, in both modes.
 *
 * MUI's dark palette out of the box is one near-black for every surface, and
 * then lightens a `Paper` by its elevation with a white overlay — which is
 * why a full-window dialog, at elevation 24, came out a washed grey that no
 * palette named. The surfaces are said here instead: a cool near-black ground
 * and a paper one step above it, so a column, a sheet and a toolbar are told
 * apart by colour rather than by a gradient nobody chose. The overlay is off
 * so that what the palette says is what is drawn.
 *
 * One function, used by the shell and by the test harness, so the tests run
 * on the palette production runs on rather than on a default that only
 * resembles it.
 */
import { createTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'

export function shellTheme(mode: 'light' | 'dark'): Theme {
  const dark = mode === 'dark'
  return createTheme({
    palette: {
      mode,
      background: dark
        ? { default: '#15171b', paper: '#1e2126' }
        : { default: '#f4f5f7', paper: '#ffffff' },
      divider: dark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.10)',
    },
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    },
  })
}
