// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import { alpha, createTheme } from '@mui/material/styles'
import type { Theme, ThemeOptions } from '@mui/material/styles'
import { deDE, nlNL } from '@mui/material/locale'
import type { Language } from '../i18n'

/**
 * MUI's own words — an autocomplete's clear, open and close buttons and what
 * its list says when it is empty, a toast's close button — in the language
 * that is on. MUI ships a locale for each language the app speaks but its own
 * English, which is MUI's default and needs none.
 */
const MUI_LOCALE: Partial<Record<Language, ThemeOptions>> = { nl: nlNL, de: deDE }

/**
 * The outline of a field at rest (1.4.11). MUI draws it at 23 % of the ink,
 * which is 1.6:1 on paper: a box you have to know is there. This is the
 * lightest that still says where the field is, at 3:1 on either ground.
 */
export function fieldOutline(theme: Theme): string {
  return outlineOver(theme.palette.text.primary, theme.palette.mode)
}

function outlineOver(ink: string, mode: 'light' | 'dark'): string {
  return alpha(ink, mode === 'dark' ? 0.42 : 0.46)
}

export function shellTheme(mode: 'light' | 'dark', language: Language = 'en'): Theme {
  const dark = mode === 'dark'
  // Material's ink in the light mode, said so the field outline can be read off it.
  const ink = dark ? '#e4e7ee' : 'rgba(0, 0, 0, 0.87)'
  const outline = outlineOver(ink, mode)
  return createTheme({
    palette: {
      mode,
      // The ink MUI picks for a button or a filled alert is whichever of black
      // and white reaches this against the fill; its default, 3, is the
      // threshold for large text, and a button's label is not large.
      contrastThreshold: 4.5,
      primary: { main: dark ? '#8e96f2' : '#4f5bd5' },
      // The status colours MUI ships that are below 4.5:1 as text on these
      // grounds: orange and light blue on paper in the light mode, red on the
      // dark paper. Darker steps of the same hues in the light mode; in the
      // dark, Material's red a step lighter all through — 400 for the text,
      // 200 for a badge's letters on its own tint, 600 under a filled alert,
      // which MUI letters in black because that is what the 400 takes.
      ...(dark
        ? { error: { main: '#ef5350', light: '#ef9a9a', dark: '#e53935' } }
        : { warning: { main: '#b45309' }, info: { main: '#0271b3' } }),
      background: dark
        ? { default: '#15171b', paper: '#1e2126' }
        : { default: '#f4f5f7', paper: '#ffffff' },
      divider: dark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.10)',
      text: { primary: ink },
    },
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiOutlinedInput: { styleOverrides: { notchedOutline: { borderColor: outline } } },
      MuiInput: { styleOverrides: { underline: { '&::before': { borderBottomColor: outline } } } },
    },
    // MUI's own keyboard ring on every control it draws — a 2px outline in the
    // accent, inset where a parent clips (a tab, a menu item) — in place of the
    // faint tint a focused button gets by default, which nobody could find.
    focusVisible: true,
  }, MUI_LOCALE[language] ?? {})
}
