// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The design system's values: the one place a colour, a type size or a frame
 * measure is written (ADR-0045).
 *
 * The light theme is a survey sheet (warm paper, blue-black ink), the dark one
 * a blueprint (night blue, pale drafting lines), and there is one accent,
 * petrol, that no status uses. Every value was picked in OKLCH and is written
 * here as the sRGB it comes to, so a picture, a canvas and a contrast
 * measurement can all read it. Where a token only names another
 * (`var(--ink-3)`), the meaning has its own name and the colour stays in one
 * place: renaming what `--line-uses` is drawn in touches this line alone.
 *
 * Three readers, one table: the page reads these as CSS custom properties, set
 * on the root by the theme (`tokenVariables`, `app/theme.ts`); MUI gets them as
 * its palette, and hands them on as its own CSS variables; and what has to do
 * sums or draw outside the page — the canvas's tokens, an export, the contrast
 * test — reads the resolved values (`coloursOf`, `tokensOf`).
 *
 * React-free and MUI-free but for one type, so the arithmetic beside it can be
 * tested in node.
 */
import type { Theme } from '@mui/material/styles'

export type Mode = 'light' | 'dark'

export const LIGHT = {
  ground: '#f6f3ef', surface: '#fefdfb', 'surface-2': '#ece9e4', 'surface-raised': '#ffffff', 'press-hover': '#e7e3dc',
  line: '#dcd9d3', 'line-strong': '#89847a', ink: '#171f28', 'ink-2': '#3d444e', 'ink-3': '#565d66',
  accent: '#015d74', 'accent-soft': '#d4edf5', 'on-accent': '#fefdfb', ok: '#1e6534',
  'ok-soft': '#d8f2dc', warn: '#7e4f04', 'warn-soft': '#f7e8c4', bad: '#a52520', 'bad-soft': '#fde3de',
  info: '#31559a', 'info-soft': '#e1eafb', 'cat-1': '#234baa', 'cat-2': '#a85242', 'cat-3': '#3e9086',
  'cat-4': '#4e2b46', 'cat-5': '#a67f02', 'cat-6': '#280775', 'cat-1-soft': '#dce7fb',
  'cat-2-soft': '#fadfda', 'cat-3-soft': '#d3efea', 'cat-4-soft': '#efe1eb', 'cat-5-soft': '#f6e9c4',
  'cat-6-soft': '#e0e1f7', 'canvas-ground': '#f9f8f4', 'zone-fill': '#f1eee9', 'zone-edge': '#86837b',
  'card-surface': '#fffefd', 'card-edge': '#848077', 'grid-line': '#e5e3dd', skeleton: '#e4e1db',
  'focus-ring': '#015d74', 'selected-soft': '#d0ecf5', 'selected-edge': '#015d74', crosshair: '#e5f3f8',
  'editing-bar': '#d4edf5', 'line-quiet': '#777e87', 'line-ink': '#464e58', 'line-focus': '#171f28',
  'line-signal': '#a52520', exception: '#8a235e', 'exception-soft': '#f8e3ec', agent: '#643a8d',
  'agent-soft': '#ede6f7', looking: '#4b4290', 'looking-soft': '#e5e6fc', 'heat-1': '#dbebf2',
  'heat-2': '#a2ccdd', 'heat-3': '#61a6c1', 'heat-4': '#1b7390', 'heat-5': '#09465c',
  'on-heat-1': '#171f28', 'on-heat-2': '#171f28', 'on-heat-3': '#0f1720', 'on-heat-4': '#fefdfb',
  'on-heat-5': '#fefdfb', 'life-planned': '#31559a', 'life-planned-soft': '#eaf0fd',
  'life-live': '#1e6534', 'life-live-soft': '#c4e7ca', 'life-retiring': '#7e4f04',
  'life-retiring-soft': '#e6cc97', 'life-gone': '#565d66', 'life-gone-soft': '#e4e6ea',
  'cov-apps': '#1b558a', 'cov-apps-soft': '#d8ebfb', 'cov-moving': '#723480',
  'cov-moving-soft': '#f1e2f5', 'cov-people': '#0d6a58', 'cov-people-soft': '#d1f0e6',
  'raci-a': '#171f28', 'raci-a-ink': '#fefdfb', 'raci-r': '#c0dde9', 'progress-track': '#89847a',
  'progress-fill': '#015d74', 'diff-before': '#a52520', 'diff-before-soft': '#fde3de',
  'diff-after': '#1e6534', 'diff-after-soft': '#d8f2dc', 'axis-today': '#171f28', 'axis-day': '#4b4290',
  'poster-title': '#27313c', 'on-poster-title': '#fefdfb',
  'cov-none': 'var(--ink-3)', 'cov-none-soft': 'var(--surface-2)', 'status-managed': 'var(--ok)',
  'status-partial': 'var(--warn)', 'status-risk': 'var(--bad)', 'status-none': 'var(--ink-2)',
  'status-unset': 'var(--ink-2)', 'weight-fix': 'var(--bad)', 'weight-fix-soft': 'var(--bad-soft)',
  'weight-review': 'var(--warn)', 'weight-review-soft': 'var(--warn-soft)',
  'weight-note': 'var(--ink-3)', 'weight-note-soft': 'var(--surface-2)',
  'status-offline': 'var(--ink-2)', 'status-offline-soft': 'var(--surface-2)', 'ink-dim': 'var(--ink-3)',
  'ink-empty': 'var(--ink-3)', 'line-structure': 'var(--line-quiet)', 'line-reports-to': 'var(--accent)',
  'line-reports-from': 'var(--line-ink)', 'line-exception': 'var(--exception)',
  'line-uses': 'var(--line-ink)', 'line-implied': 'var(--line-quiet)', 'line-runs': 'var(--cat-3)',
  'line-delivered': 'var(--cat-1)', 'line-issue': 'var(--line-signal)',
  'c4-container-fill': 'var(--card-surface)', 'c4-container-line': 'var(--line-ink)',
  'c4-context-fill': 'var(--zone-fill)', 'state-attention-border': 'var(--warn)',
  'drop-ok': 'var(--selected-soft)', 'drop-warn': 'var(--warn-soft)',
  'link-outline': 'var(--focus-ring)', 'guide-ring': 'var(--focus-ring)',
  'field-focus': 'var(--focus-ring)', leaves: 'var(--surface-2)', 'harvey-need': 'var(--ink-2)',
  'chain-root': 'var(--exception)', 'lens-1': 'var(--cat-1)', 'lens-1-soft': 'var(--cat-1-soft)',
  'lens-2': 'var(--cat-2)', 'lens-2-soft': 'var(--cat-2-soft)', 'lens-3': 'var(--cat-3)',
  'lens-3-soft': 'var(--cat-3-soft)', 'lens-4': 'var(--cat-4)', 'lens-4-soft': 'var(--cat-4-soft)',
  'lens-5': 'var(--cat-5)', 'lens-5-soft': 'var(--cat-5-soft)', 'lens-6': 'var(--cat-6)',
  'lens-6-soft': 'var(--cat-6-soft)',
  shadow: '0 1px 1px rgb(28 34 48 / .07),0 3px 10px rgb(28 34 48 / .09)', scrim: 'rgb(28 34 48 / .36)',
  'scrim-solid': '#e3e2dc',
  // A row's start, where its kind is the point: quieter than the status inks beside the words, 3:1 on any ground a row takes.
  'rail-good': '#3d8754', 'rail-bad': '#c04b42', 'rail-neutral': 'var(--line-quiet)',
} as const

export const DARK: Record<ColourToken, string> = {
  ground: '#0c151d', surface: '#141e29', 'surface-2': '#1e2833', 'surface-raised': '#242f3b', 'press-hover': '#2f3b49',
  line: '#2d3843', 'line-strong': '#6f7e8d', ink: '#e8eef2', 'ink-2': '#bfc9d1', 'ink-3': '#9ea9b4',
  accent: '#6fcee4', 'accent-soft': '#153c4a', 'on-accent': '#0c151d', ok: '#82d79a',
  'ok-soft': '#1e3a26', warn: '#edc06b', 'warn-soft': '#43341a', bad: '#f69088', 'bad-soft': '#512927',
  info: '#99bdf1', 'info-soft': '#263750', 'cat-1': '#9ab7f2', 'cat-2': '#e07937', 'cat-3': '#80f1c8',
  'cat-4': '#dd96bb', 'cat-5': '#e8d762', 'cat-6': '#8d8af1', 'cat-1-soft': '#273750',
  'cat-2-soft': '#4a2d1d', 'cat-3-soft': '#1d4035', 'cat-4-soft': '#4a2c3c', 'cat-5-soft': '#3f3a19',
  'cat-6-soft': '#313153', 'canvas-ground': '#0f1822', 'zone-fill': '#17212c', 'zone-edge': '#7b8a9a',
  'card-surface': '#212c38', 'card-edge': '#798898', 'grid-line': '#1d2732', skeleton: '#242f3a',
  'focus-ring': '#63d6f1', 'selected-soft': '#183f4d', 'selected-edge': '#6fcee4', crosshair: '#1a2d38',
  'editing-bar': '#153c4a', 'line-quiet': '#798898', 'line-ink': '#a6b3c1', 'line-focus': '#e8eef2',
  'line-signal': '#f69088', exception: '#ef98c2', 'exception-soft': '#4a2c3a', agent: '#c9aaee',
  'agent-soft': '#3d2f4d', looking: '#b4b2f6', 'looking-soft': '#343254', 'heat-1': '#15323d',
  'heat-2': '#235466', 'heat-3': '#3f8197', 'heat-4': '#5cb2ca', 'heat-5': '#98e6f6',
  'on-heat-1': '#e8eef2', 'on-heat-2': '#e8eef2', 'on-heat-3': '#03080f', 'on-heat-4': '#03080f',
  'on-heat-5': '#03080f', 'life-planned': '#99bdf1', 'life-planned-soft': '#1e2b3e',
  'life-live': '#82d79a', 'life-live-soft': '#23462d', 'life-retiring': '#edc06b',
  'life-retiring-soft': '#61481b', 'life-gone': '#9ea9b4', 'life-gone-soft': '#25292f',
  'cov-apps': '#8cc4f4', 'cov-apps-soft': '#1f394f', 'cov-moving': '#d9a5e5',
  'cov-moving-soft': '#432d48', 'cov-people': '#82d8c1', 'cov-people-soft': '#1e3d35',
  'raci-a': '#e8eef2', 'raci-a-ink': '#0c151d', 'raci-r': '#1f4554', 'progress-track': '#6f7e8d',
  'progress-fill': '#6fcee4', 'diff-before': '#f69088', 'diff-before-soft': '#512927',
  'diff-after': '#82d79a', 'diff-after-soft': '#1e3a26', 'axis-today': '#e8eef2', 'axis-day': '#b4b2f6',
  'poster-title': '#2f3e4d', 'on-poster-title': '#e8eef2',
  'cov-none': 'var(--ink-3)', 'cov-none-soft': 'var(--surface-2)', 'status-managed': 'var(--ok)',
  'status-partial': 'var(--warn)', 'status-risk': 'var(--bad)', 'status-none': 'var(--ink-2)',
  'status-unset': 'var(--ink-2)', 'weight-fix': 'var(--bad)', 'weight-fix-soft': 'var(--bad-soft)',
  'weight-review': 'var(--warn)', 'weight-review-soft': 'var(--warn-soft)',
  'weight-note': 'var(--ink-3)', 'weight-note-soft': 'var(--surface-2)',
  'status-offline': 'var(--ink-2)', 'status-offline-soft': 'var(--surface-2)', 'ink-dim': 'var(--ink-3)',
  'ink-empty': 'var(--ink-3)', 'line-structure': 'var(--line-quiet)', 'line-reports-to': 'var(--accent)',
  'line-reports-from': 'var(--line-ink)', 'line-exception': 'var(--exception)',
  'line-uses': 'var(--line-ink)', 'line-implied': 'var(--line-quiet)', 'line-runs': 'var(--cat-3)',
  'line-delivered': 'var(--cat-1)', 'line-issue': 'var(--line-signal)',
  'c4-container-fill': 'var(--card-surface)', 'c4-container-line': 'var(--line-ink)',
  'c4-context-fill': 'var(--canvas-ground)', 'state-attention-border': 'var(--warn)',
  'drop-ok': 'var(--selected-soft)', 'drop-warn': 'var(--warn-soft)',
  'link-outline': 'var(--focus-ring)', 'guide-ring': 'var(--focus-ring)',
  'field-focus': 'var(--focus-ring)', leaves: 'var(--surface-2)', 'harvey-need': 'var(--ink-2)',
  'chain-root': 'var(--exception)', 'lens-1': 'var(--cat-1)', 'lens-1-soft': 'var(--cat-1-soft)',
  'lens-2': 'var(--cat-2)', 'lens-2-soft': 'var(--cat-2-soft)', 'lens-3': 'var(--cat-3)',
  'lens-3-soft': 'var(--cat-3-soft)', 'lens-4': 'var(--cat-4)', 'lens-4-soft': 'var(--cat-4-soft)',
  'lens-5': 'var(--cat-5)', 'lens-5-soft': 'var(--cat-5-soft)', 'lens-6': 'var(--cat-6)',
  'lens-6-soft': 'var(--cat-6-soft)', shadow: '0 0 0 1px rgb(0 0 0 / .25),0 3px 12px rgb(0 0 0 / .42)',
  scrim: 'rgb(6 10 16 / .62)', 'scrim-solid': '#0e141c',
  'rail-good': '#56a06c', 'rail-bad': '#cf6a63', 'rail-neutral': 'var(--line-quiet)',
}

export const SCALE = {
  'font-ui': '"Source Sans 3","Source Sans Pro","Segoe UI",system-ui,-apple-system,sans-serif',
  'font-mono': '"Source Code Pro",ui-monospace,Menlo,Consolas,monospace',
  // The five sizes a screen uses, in rem so that a browser's text size and the top bar's follow them.
  't-small': '0.8125rem', 't-body': '0.9375rem', 't-large': '1.0625rem', 't-title': '1.25rem', 't-page': '1.625rem',
  // Branches still landing say the older names. Each is the size that took its place.
  't-xs': 'var(--t-small)', 't-sm': 'var(--t-body)', 't-md': 'var(--t-body)', 't-lg': 'var(--t-large)', 't-xl': 'var(--t-title)',
  't-2xl': 'var(--t-page)', 't-label': 'var(--t-small)',
  // A canvas's type, in pixels, so its words keep the proportions of the boxes they sit in, which its layout is
  // worked out in: the person's text size reaches a canvas as a scale on the whole drawing (`canvasZoomProps`),
  // and the zoom makes it larger from 100% up. In rem, the words grew at 150% and the boxes did not.
  'canvas-t-xs': '12px', 'canvas-t-sm': '13px', 'canvas-t-md': '14px', 'canvas-t-lg': '16px', 'canvas-t-label': '11px', 'canvas-t-near': '9.5px', 'canvas-mark': '10px', 'canvas-target': '24px',
  't-canvas-name': '13px', 'fw-regular': '400', 'fw-medium': '500', 'fw-strong': '600',
  // A short card's two lines of name, set close so both fit its box at the floor.
  'lh-close': '1.1', 'lh-tight': '1.25', 'lh-body': '1.45', 'measure-reader': '68ch', 's-1': '4px', 's-2': '8px',
  's-3': '12px', 's-4': '16px', 's-5': '24px', 's-6': '32px', 'r-1': '2px', 'r-2': '3px', 'r-3': '6px',
  // What holds text grows with it. A panel stops growing before it leaves the work no room.
  'ctl-h': '1.875rem', 'bar-h': '2.75rem', 'tabs-h': '2.25rem', 'viewbar-h': '2.25rem', 'band-h': '2rem',
  'panel-w-tree': '18.75rem', 'panel-w': 'min(22rem, 42vw)', 'panel-w-l': 'min(34rem, 60vw)', 'rail-w': '5.25rem',
  'pane-list': 'min(28rem, 50vw)', 'w-dialog-s': '30rem', 'w-dialog-m': '37.5rem', 'w-dialog-l': '68rem', 'w-document': '48rem',
  'row-h': '1.875rem', 'row-h-dense': '1.5rem', 'row-h-loose': '2.25rem', 'row-prop': '1.5rem',
  'label-col': '7.5rem', 'value-col-min': '8rem', 'clamp-lines': '3', 'cell-size': '1.75rem', 'mark-size': '0.625rem',
  'target-min': '1.5rem', 'line-width-structure': '1px', 'line-width-emphasis': '2px',
  'line-dash-functional': '4 3', 'line-dash-implied': '1 3', 'line-dash-planned': '7 4',
  'focus-ring-width': '2px', 'focus-ring-offset': '1px', 'dim-opacity': '.45',
  'canvas-frame-width': '3px',
} as const

export type ColourToken = keyof typeof LIGHT
export type ScaleToken = keyof typeof SCALE
export type Token = ColourToken | ScaleToken

/** Colours with every alias followed to the value it names. */
export type Colours = Record<ColourToken, string>

/** A token as CSS reads it: `var(--ink)`. The way static styles and `sx` name a token, typed. */
export function tokenVar(token: Token): string {
  return `var(--${token})`
}

const ALIAS = /^var\(--([a-z0-9-]+)\)$/

function resolved(table: Record<ColourToken, string>): Colours {
  const follow = (value: string): string => {
    const named = ALIAS.exec(value)?.[1]
    return named ? follow(table[named as ColourToken]) : value
  }
  return Object.fromEntries(Object.entries(table).map(([token, value]) => [token, follow(value)])) as Colours
}

const TABLE: Record<Mode, Record<ColourToken, string>> = { light: LIGHT, dark: DARK }
const RESOLVED: Record<Mode, Colours> = { light: resolved(LIGHT), dark: resolved(DARK) }

/**
 * What an environment's accent changes, per mode (`accent.ts`). Only the
 * accent's own family: a status, an ink or a ground is never anybody's to set.
 */
export type AccentShades = Record<Mode, Partial<Record<ColourToken, string>>>

/** Every colour of a mode as a value, with the accent's shades where there are any. */
export function coloursOf(mode: Mode, shades?: AccentShades): Colours {
  return shades ? resolved({ ...TABLE[mode], ...shades[mode] }) : RESOLVED[mode]
}

/**
 * The tokens as custom properties, aliases kept as aliases so an override of
 * the accent reaches what names it. A subtree drawn in the other mode — a
 * picture exported from the dark window in the light theme — sets these on its
 * own root.
 */
export function tokenVariables(mode: Mode, shades?: AccentShades): Record<string, string> {
  const table = shades ? { ...TABLE[mode], ...shades[mode] } : TABLE[mode]
  const variables = [...Object.entries(SCALE), ...Object.entries(table)].map(([token, value]) => [`--${token}`, value])
  return Object.fromEntries(variables)
}

/** What a theme built by `shellTheme` carries beside MUI's own keys. */
export type ThemeTokens = { colours: Colours; shades?: AccentShades }

declare module '@mui/material/styles' {
  interface Theme { tokens?: ThemeTokens }
  interface ThemeOptions { tokens?: ThemeTokens }
}

/**
 * The colours of a theme, accent included. A theme no shell made, which is what
 * a canvas mounted alone in a test is handed, gets the mode's own.
 */
export function tokensOf(theme: Theme): Colours {
  return theme.tokens?.colours ?? RESOLVED[theme.palette.mode]
}

/** A measure as a number, for the few places that do sums with one, at the browser's own 16 px to the rem: `px('row-h-dense')` is 24. */
export function px(token: ScaleToken): number {
  const value: string = SCALE[token]
  const named = ALIAS.exec(value)?.[1]
  if (named) return px(named as ScaleToken)
  return Number.parseFloat(value) * (value.endsWith('rem') ? 16 : 1)
}

/** How many times the browser's own rem the person's text size is, as `platform/textSize` writes it on the root: for the few widths a script works out. */
export function textScale(): number {
  const raw = Number(document.documentElement.dataset.textSize)
  return Number.isFinite(raw) && raw > 0 ? raw / 100 : 1
}
