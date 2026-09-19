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
 * The accent is said here too. Until it was, `primary` was Material Blue by
 * omission, and everything that reads `primary` — the selected ring and its
 * handles, the tab underline, the buttons, the actor and component surfaces —
 * wore a colour nobody had picked. Indigo is picked: cool enough to sit on
 * these grounds, and far enough from the category-strip and status hues that
 * a selected card is never mistaken for a blue-category or informational one.
 * One value per mode; the light and dark steps derive from it.
 *
 * The dark ink is a cool off-white rather than Material's pure white: the
 * grounds are cool-toned, and pure white on them glares in a screen this
 * dense. Light mode keeps Material's inks, which already suit paper.
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
      primary: { main: dark ? '#8e96f2' : '#4f5bd5' },
      background: dark
        ? { default: '#15171b', paper: '#1e2126' }
        : { default: '#f4f5f7', paper: '#ffffff' },
      divider: dark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.10)',
      ...(dark ? { text: { primary: '#e4e7ee' } } : {}),
    },
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    },
  })
}
