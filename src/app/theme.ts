// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The one MUI theme, in both modes, made from the design system's tokens
 * (`widgets/kit/tokens.ts`, ADR-0045).
 *
 * MUI gets the tokens as its palette and hands them to its components as CSS
 * variables, so a screen drawn before the kit existed wears the same paper, ink
 * and accent as one drawn on it. The palette stays in values rather than
 * `var()`s because the screens do sums on it in JavaScript: `alpha`, `darken`,
 * a contrast measured while drawing. The token variables themselves are set on
 * the root here too, through the baseline, for what is styled statically.
 *
 * `secondary` is an ink and not a hue. MUI's default purple would be a second
 * accent nobody picked; there is one accent, and nothing else wears it. The
 * overlay MUI lays over a `Paper` by its elevation is off, so that what the
 * tokens say is what is drawn.
 *
 * One function, used by the shell and by the test harness, so the tests run
 * on the palette production runs on rather than on a default that only
 * resembles it.
 */
import { alpha, createTheme, darken, lighten } from '@mui/material/styles'
import type { CSSObject, Theme, ThemeOptions } from '@mui/material/styles'
import type { AlertColor } from '@mui/material/Alert'
import { deDE, nlNL } from '@mui/material/locale'
import type { Language } from '../i18n'
import { dangerInk } from '../widgets'
import { coloursOf, SCALE, tokensOf, tokenVariables } from '../widgets/kit/tokens'
import type { AccentShades } from '../widgets/kit/tokens'

/**
 * MUI's own words — an autocomplete's clear, open and close buttons and what
 * its list says when it is empty, a toast's close button — in the language
 * that is on. MUI ships a locale for each language the app speaks but its own
 * English, which is MUI's default and needs none.
 */
const MUI_LOCALE: Partial<Record<Language, ThemeOptions>> = { nl: nlNL, de: deDE }

/**
 * The outline of a field at rest (1.4.11). MUI draws it at 23 % of the ink,
 * which is 1.6:1 on paper: a box you have to know is there.
 */
export function fieldOutline(theme: Theme): string {
  return tokensOf(theme)['line-strong']
}

/**
 * The fill a filled alert — every toast — is drawn on in the dark mode, where
 * the status's own colour is not the one to read: it is pale, made to be words
 * on the night blue, and a word on it would be black on a bright red. The light
 * theme's colour of the same status is the deep one, where white reaches 4.5:1.
 * Warning keeps its amber and its dark ink: no amber takes white.
 */
const DARK_ALERT_FILL: Partial<Record<AlertColor, string>> = {
  error: coloursOf('light').bad, info: coloursOf('light').info, success: coloursOf('light').ok,
}

/** A fill, and the ink measured against that fill. */
export type Filled = { fill: string; ink: string }

/** What a filled alert is drawn with: its fill, and the ink measured against that fill. */
export function filledAlert(theme: Theme, colour: AlertColor): Filled {
  const { palette } = theme
  const fill = palette.mode === 'dark'
    ? DARK_ALERT_FILL[colour] ?? palette[colour].dark
    : palette[colour].main
  return { fill, ink: palette.getContrastText(fill) }
}

/**
 * The three colours a reporting line takes on the organisation chart for the
 * person picked (ADR-0039, amended 17 October 2026): the lines they report
 * along in the accent; the lines reporting into them in the darker line ink;
 * and any line that is an exception to the model — a unit's own, a holder's
 * own — in the exception's magenta, whichever way it runs, which the chip of a
 * role held outside a unit's slots wears too. Each away from the warning and
 * error tones a vacant line and a loop keep, and each at 3:1 on both grounds in
 * both modes (`theme.contrast.test`).
 */
export type ReportingLineColours = { reportsTo: string; reportedBy: string; override: string }

export function reportingLineColours(theme: Theme): ReportingLineColours {
  const colours = tokensOf(theme)
  return {
    reportsTo: colours['line-reports-to'],
    reportedBy: colours['line-reports-from'],
    override: colours['line-exception'],
  }
}

/** The palette colours a contained button or a filled chip can be drawn in. */
export const FILLED_COLOURS = ['primary', 'secondary', 'error', 'warning', 'info', 'success'] as const
export type FilledColour = (typeof FILLED_COLOURS)[number]

const isAlertColour = (colour: FilledColour): colour is AlertColor => colour !== 'primary' && colour !== 'secondary'
const isFilledColour = (colour: unknown): colour is FilledColour => FILLED_COLOURS.includes(colour as FilledColour)

/**
 * What a contained button or a filled chip is drawn with, at rest and under
 * the pointer. MUI paints the rest on `main` and the hover on `dark`, and
 * letters both in the one ink it picked against `main` — so in the dark mode a
 * primary button went from 6.8:1 to 3.8:1 under the pointer, and an error one
 * was lettered in black on the bright red a toast had just been taken off.
 *
 * Here each state's ink is measured against that state's fill. In the dark
 * mode error, info and success rest on the deeper fill a toast has
 * (`DARK_ALERT_FILL`), so a red button, a red chip and a red toast are the one
 * red, in white; under the pointer they go a step deeper still. Everything
 * else keeps MUI's `main` and `dark`, and the dark mode's `primary.dark` is the
 * lighter step (`shellTheme`), so the hover keeps its black ink rather than
 * swapping it for white halfway through a click.
 */
export function filledControl(theme: Theme, colour: FilledColour): { rest: Filled; hover: Filled } {
  const { palette } = theme
  const deeper = palette.mode === 'dark' && isAlertColour(colour) ? DARK_ALERT_FILL[colour] : undefined
  const restFill = deeper ?? palette[colour].main
  const hoverFill = deeper !== undefined ? darken(deeper, 0.2) : palette[colour].dark
  return {
    rest: { fill: restFill, ink: palette.getContrastText(restFill) },
    hover: { fill: hoverFill, ink: palette.getContrastText(hoverFill) },
  }
}

/** The contained button's two states, said through the variables MUI's own rules read. */
function containedButton(theme: Theme, colour: FilledColour): CSSObject {
  const { rest, hover } = filledControl(theme, colour)
  return {
    '--variant-containedBg': rest.fill,
    '--variant-containedColor': rest.ink,
    '@media (hover: hover)': {
      '&:hover': { '--variant-containedBg': hover.fill, '--variant-containedColor': hover.ink },
    },
  }
}

/** A filled chip in a status colour, and its hover when it can be pressed. */
function filledChip(theme: Theme, colour: FilledColour): CSSObject {
  const { rest, hover } = filledControl(theme, colour)
  return {
    backgroundColor: rest.fill,
    color: rest.ink,
    '&.MuiChip-clickable:hover': { backgroundColor: hover.fill, color: hover.ink },
    '& .MuiChip-deleteIcon': { color: alpha(rest.ink, 0.7), '&:hover, &:active': { color: rest.ink } },
  }
}

/**
 * What a theme is made from beyond its mode and language. `cssVariables` is off
 * for a theme drawn inside another in a different mode, a picture exported in
 * the other theme: MUI's variables sit on the page's root, one set per page, and
 * the inner one must carry values instead.
 */
export type ShellThemeOptions = { accent?: AccentShades; cssVariables?: boolean }

export function shellTheme(mode: 'light' | 'dark', language: Language = 'en', options: ShellThemeOptions = {}): Theme {
  const dark = mode === 'dark'
  const { accent: shades, cssVariables = true } = options
  const colours = coloursOf(mode, shades)
  const outline = colours['line-strong']
  const line = { tight: Number(SCALE['lh-tight']), body: Number(SCALE['lh-body']) }
  const weight = { regular: Number(SCALE['fw-regular']), medium: Number(SCALE['fw-medium']), strong: Number(SCALE['fw-strong']) }
  const heading = (fontSize: string) => ({ fontSize, fontWeight: weight.strong, lineHeight: line.tight })
  return createTheme({
    cssVariables,
    tokens: { colours, ...(shades ? { shades } : {}) },
    palette: {
      mode,
      // The ink MUI picks for a button or a filled alert is whichever of black
      // and white reaches this against the fill; its default, 3, is the
      // threshold for large text, and a button's label is not large.
      contrastThreshold: 4.5,
      // In the dark mode the hover step is lighter than the accent rather than
      // darker: a darker shade under the button's dark ink fell under the line,
      // and a lighter one keeps the ink and still says the pointer is there.
      primary: {
        main: colours.accent,
        contrastText: colours['on-accent'],
        ...(dark ? { dark: lighten(colours.accent, 0.15) } : {}),
      },
      secondary: { main: colours['ink-2'] },
      error: { main: colours.bad },
      warning: { main: colours.warn },
      info: { main: colours.info },
      success: { main: colours.ok },
      background: { default: colours.ground, paper: colours.surface },
      divider: colours.line,
      text: { primary: colours.ink, secondary: colours['ink-2'] },
    },
    typography: {
      fontFamily: SCALE['font-ui'],
      fontWeightRegular: weight.regular,
      fontWeightMedium: weight.medium,
      fontWeightBold: weight.strong,
      h1: heading(SCALE['t-page']), h2: heading(SCALE['t-page']), h3: heading(SCALE['t-page']), h4: heading(SCALE['t-page']),
      h5: heading(SCALE['t-title']), h6: heading(SCALE['t-large']),
      subtitle1: { fontSize: SCALE['t-body'], fontWeight: weight.strong, lineHeight: line.body },
      subtitle2: { fontSize: SCALE['t-small'], fontWeight: weight.strong, lineHeight: line.body },
      body1: { fontSize: SCALE['t-body'], lineHeight: line.body },
      body2: { fontSize: SCALE['t-body'], lineHeight: line.body },
      caption: { fontSize: SCALE['t-small'], lineHeight: line.body },
      overline: { fontSize: SCALE['t-small'], fontWeight: weight.medium, lineHeight: line.body, letterSpacing: '0.04em' },
      button: { fontSize: SCALE['t-body'], fontWeight: weight.medium, lineHeight: line.body, textTransform: 'none' },
    },
    // Square drafting corners: `sx`'s `borderRadius: 1` is this many pixels.
    shape: { borderRadius: Number.parseFloat(SCALE['r-2']) },
    components: {
      // The tokens as variables on the root, for what is styled statically, and
      // the browser's own controls and scrollbars in the same mode.
      MuiCssBaseline: {
        styleOverrides: {
          ':root': { ...tokenVariables(mode, shades), colorScheme: mode },
          body: { fontSize: SCALE['t-body'], lineHeight: line.body },
          'code, kbd, pre, samp': { fontFamily: SCALE['font-mono'] },
          // A bare `button` is the one element that does not inherit the page's
          // typeface: a link drawn as one came out in the system's.
          'button, input, select, textarea': { fontFamily: 'inherit' },
        },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      // What MUI sizes for itself, below the scale or beside it: a tip of 11 px, a chip of 13, a cell of 14.
      MuiTooltip: { styleOverrides: { tooltip: { fontSize: SCALE['t-small'] } } },
      MuiTableCell: { styleOverrides: { root: { fontSize: SCALE['t-body'] }, head: { fontSize: SCALE['t-small'] } } },
      MuiBadge: { styleOverrides: { badge: { fontSize: SCALE['t-small'] } } },
      MuiOutlinedInput: { styleOverrides: { notchedOutline: { borderColor: outline } } },
      MuiInput: { styleOverrides: { underline: { '&::before': { borderBottomColor: outline } } } },
      // MUI's own −11 px start margin on a switch or checkbox label, meant to
      // align the control with text above it, instead pushes the control past
      // a panel's own left edge. −4 px keeps the alignment close without the
      // overhang.
      MuiFormControlLabel: { styleOverrides: { root: { marginLeft: -4 } } },
      MuiButton: {
        styleOverrides: {
          sizeSmall: { fontSize: SCALE['t-body'] },
          sizeLarge: { fontSize: SCALE['t-body'] },
          root: ({ ownerState, theme }) => {
            const colour = ownerState.color
            if (!isFilledColour(colour)) return {}
            if (ownerState.variant === 'contained') return containedButton(theme, colour)
            // A red text or outlined button's hover tint is red too, and lifts
            // the ground under the red words: 4.25:1 on the dark paper. The
            // danger ink is the red that clears it (`dangerInk`).
            if (colour !== 'error') return {}
            const ink = dangerInk(theme)
            return { '--variant-textColor': ink, '--variant-outlinedColor': ink }
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: ({ ownerState, theme }) => ({
            // A chip's own 13 px, and a height that lets its words grow.
            fontSize: SCALE['t-small'],
            height: 'auto',
            minHeight: SCALE['row-h-dense'],
            ...(ownerState.variant !== 'outlined' && isFilledColour(ownerState.color) ? filledChip(theme, ownerState.color) : {}),
          }),
        },
      },
      // An unselected toggle is lettered in `action.active`, 54 % of the ink,
      // which is 4.496:1 on the light ground — under the line by a rounding,
      // and further under once the hover tint is over it. `text.secondary` is
      // the page's own second ink and clears both.
      MuiToggleButton: { styleOverrides: { root: ({ theme }) => ({ color: theme.palette.text.secondary, fontSize: SCALE['t-body'] }) } },
      MuiAlert: {
        styleOverrides: {
          root: ({ ownerState, theme }) => {
            if (ownerState.variant !== 'filled') return {}
            // `success` is MUI's own default when neither is given.
            const { fill, ink } = filledAlert(theme, ownerState.color ?? ownerState.severity ?? 'success')
            return { backgroundColor: fill, color: ink }
          },
        },
      },
    },
    // MUI's own keyboard ring on every control it draws — the one focus ring
    // token, inset where a parent clips (a tab, a menu item) — in place of the
    // faint tint a focused button gets by default, which nobody could find.
    focusVisible: { outlineColor: colours['focus-ring'] },
  }, MUI_LOCALE[language] ?? {})
}
