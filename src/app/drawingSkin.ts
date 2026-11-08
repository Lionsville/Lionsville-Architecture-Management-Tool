// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * draw.io in the app's clothes: its grounds, lines, accent and face, as CSS the
 * frame is sent when it asks for its configuration.
 *
 * The tokens are the one source, sent for both modes through `light-dark()`, which
 * draw.io itself draws in, so the app's theme changing while the editor is open
 * moves this without sending anything again. The selectors are draw.io's class
 * names, which a new pin may move: the worst that does is a seam showing again.
 */
import { coloursOf, SCALE } from '../widgets/kit/tokens'
import type { AccentShades, ColourToken, Mode } from '../widgets/kit/tokens'

const FACE = SCALE['font-ui']

/** One token as both of its values. */
function both(shades: AccentShades | undefined): (token: ColourToken) => string {
  const of = (mode: Mode) => coloursOf(mode, shades)
  return (token) => `light-dark(${of('light')[token]}, ${of('dark')[token]})`
}

export function drawingSkin(shades?: AccentShades): string {
  const t = both(shades)
  // draw.io's dark look inverts a palette group's title (`filter: invert(1)`), so its chevron shows; the
  // title's colour is sent inverted for that mode, or the dark ink comes out dark on the dark ground.
  const inverted = (token: ColourToken) => invertedHex(coloursOf('dark', shades)[token])
  return `
html, body, .geEditor, .geEditor * { font-family: ${FACE}; }
html body.geEditor, .geEditor > div, .geBackground { background-color: ${t('ground')}; color: ${t('ink')}; }
.geDiagramContainer { background-color: ${t('canvas-ground')}; }
.geMenubarContainer, .geToolbarContainer, .geSidebarContainer, .geFormatContainer, .geFooterContainer,
.geTabContainer, .geTabItem, .geZoomInput, .mxWindow, .mxWindowPane, .geDialog, .mxPopupMenu {
  background-color: ${t('surface')}; color: ${t('ink')}; border-color: ${t('line')};
}
.geSidebar, .geTitle, .geFormatSection, .geFormatTitle { background-color: ${t('surface')}; color: ${t('ink')}; border-color: ${t('line')}; }
.geTitle, .geTitle:hover, .geTitle:focus { font-size: 12px; font-weight: 600; background-color: transparent !important; color: light-dark(${coloursOf('light', shades).ink}, ${inverted('ink')}) !important; }
.geItem div { color: ${t('ink-2')} !important; font-size: 11px !important; line-height: 1.2; }
.geBtn, .gePrimaryBtn { border-radius: 2px; border-color: ${t('line-strong')}; color: ${t('ink')}; background: ${t('surface')}; }
.gePrimaryBtn { background: ${t('accent')}; border-color: ${t('accent')}; color: ${t('on-accent')}; }
.geLabel, .geItem:hover, .geToolbarButton:hover, .mxPopupMenuItem.mxPopupMenuItemHover { background-color: ${t('selected-soft')}; }
.geActiveTab { color: ${t('accent')}; }
input, select, textarea { font-family: ${FACE}; color: ${t('ink')}; background-color: ${t('surface')}; border-color: ${t('line-strong')}; }
a.geStatus, .geTabContainer img[src*="github-logo"], .geTabContainer a[href*="github"] { display: none; }
`
}

/** The ground the dark look's page sits on: the app's, not draw.io's near-black beside it. */
export const DRAWING_DARK_COLOUR = coloursOf('dark')['canvas-ground']

/** A colour as `invert(1)` turns it back into itself. */
function invertedHex(colour: string): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour)?.[1]
  if (!hex) return colour
  return `#${(0xffffff - parseInt(hex, 16)).toString(16).padStart(6, '0')}`
}
