// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { alpha, type Theme } from '@mui/material/styles';
import type { AspectStatus, Layer7Zone, Lifecycle } from '../../model/types';
import { tokensOf } from '../../widgets/kit/tokens';

/**
 * Visual tokens for canvas chrome and nodes, read from the design system's
 * tokens through the host's theme (`widgets/kit/tokens.ts`), so the board wears
 * the paper, ink and accent the screens around it wear. No hardcoded hex here. The package has exactly one documented exception, for identity that a
 * MUI palette cannot supply enough distinct hues for, carrying its rationale in
 * the file: `categoryColors.ts` — deterministic per-category strip hues (nodes).
 *
 * There was briefly a second, `kindColors.ts`, giving every palette entry its
 * own hue. The palette redesign removed it: seven hues in a six-row list turned
 * out to be the loudest thing in the panel, and a list that short is scanned by
 * label anyway. The waiver it needed is withdrawn with it.
 */

export interface AspectToken {
  bg: string;
  fg: string;
  border: string;
}

export interface SurfaceToken {
  bg: string;
  border: string;
  fg: string;
}

export interface NodeTokens {
  mode: 'light' | 'dark';
  canvas: {
    dot: string;
    outline: string;
  };
  zone: {
    fill: Record<Layer7Zone, string>;
    label: string;
  };
  domainGroup: {
    border: string;
    fill: string;
    label: string;
  };
  card: {
    bg: string;
    border: string;
    headerBg: string;
    title: string;
    subtitle: string;
    description: string;
    selectedRing: string;
    /**
     * Keyboard focus ring on a node (4B): the one focus ring there is. Focus and
     * selection routinely disagree — you can tab past a node without selecting
     * it — so the two are told apart by where they are drawn as well as by this
     * token.
     */
    focusRing: string;
    warningBorder: string;
    /**
     * Backing plate behind a FULL-COLOUR uploaded logo (never behind a built-in
     * `currentColor` mark). Brand marks are drawn for white paper, so on a dark
     * card header a dark-ink logo vanishes into it. Transparent in light mode,
     * where the paper already is the plate.
     */
    logoPlate: string;
  };
  aspects: Record<AspectStatus | 'unset', AspectToken>;
  /** Lifecycle badge palette (planned/live/retiring/retired), theme-derived. */
  lifecycle: Record<Lifecycle, AspectToken>;
  actor: SurfaceToken;
  externalSystem: SurfaceToken;
  inputChannel: SurfaceToken;
  managementTool: SurfaceToken;
  component: SurfaceToken;
  boundary: SurfaceToken;
  edge: {
    stroke: string;
    strokeSelected: string;
    labelBg: string;
    labelFg: string;
    labelBorder: string;
  };
  chips: {
    priceBg: string;
    priceFg: string;
    driftBg: string;
    driftFg: string;
    danglingBg: string;
    danglingFg: string;
  };
  handle: {
    bg: string;
    border: string;
  };
  /** The minimap's own surface (4B); off by default, toggled from the toolbar. */
  minimap: {
    bg: string;
    mask: string;
    node: string;
    nodeBorder: string;
  };
}

/**
 * What the export draws with, beside the captured board: the footer strip and
 * the C4 corner. Six colours, read off the theme the picture is made in, so a
 * dark export gets a dark strip rather than a white card floating on a black
 * sheet — which is what a fixed ink-on-white block was.
 */
export interface ExportTokens {
  background: string;
  panel: string;
  ink: string;
  inkMuted: string;
  border: string;
  accent: string;
}

export function getExportTokens(theme: Theme): ExportTokens {
  const dark = theme.palette.mode === 'dark';
  return {
    background: theme.palette.background.default,
    panel: theme.palette.background.paper,
    ink: theme.palette.text.primary,
    inkMuted: theme.palette.text.secondary,
    border: dark ? alpha(theme.palette.common.white, 0.24) : alpha(theme.palette.common.black, 0.28),
    accent: theme.palette.primary.main,
  };
}

const cache = new WeakMap<Theme, NodeTokens>();

export function getNodeTokens(theme: Theme): NodeTokens {
  const cached = cache.get(theme);
  if (cached) return cached;
  const tokens = buildTokens(theme);
  cache.set(theme, tokens);
  return tokens;
}

type Colours = ReturnType<typeof tokensOf>;

/** A status drawn as a badge: its soft ground, its own ink, and its ink as the edge. */
function statusToken(soft: string, ink: string): AspectToken {
  return { bg: soft, fg: ink, border: ink };
}

/** A shape on the board: neutral, told from a card by its form and not by a hue. */
function surfaceToken(colours: Colours, bg: string, border = colours['card-edge']): SurfaceToken {
  return { bg, border, fg: colours.ink };
}

function buildTokens(theme: Theme): NodeTokens {
  const { palette } = theme;
  const dark = palette.mode === 'dark';
  const colours = tokensOf(theme);
  const text = colours.ink;

  return {
    mode: palette.mode,
    canvas: {
      dot: colours['grid-line'],
      outline: colours.line,
    },
    zone: {
      // A zone is told by its frame and its name, not by a hue: a tint per zone
      // was four more colours on a drawing where colour answers one question at
      // a time. The landscape stays the board's own ground.
      fill: {
        actors: colours['zone-fill'],
        inputChannels: colours['zone-fill'],
        externalSystems: colours['zone-fill'],
        management: colours['zone-fill'],
        landscape: 'transparent',
      },
      // A band's name is words at 11px: the second ink, not a fainter one.
      label: colours['ink-2'],
    },
    domainGroup: {
      border: colours['zone-edge'],
      fill: 'transparent',
      label: colours['ink-2'],
    },
    card: {
      bg: colours['card-surface'],
      border: colours['card-edge'],
      headerBg: 'transparent',
      title: text,
      subtitle: colours['ink-2'],
      description: colours['ink-3'],
      selectedRing: colours['selected-edge'],
      focusRing: colours['focus-ring'],
      warningBorder: colours['state-attention-border'],
      // `common.white` rather than a literal — this file keeps its no-hex rule.
      logoPlate: alpha(palette.common.white, dark ? 0.92 : 0),
    },
    aspects: {
      managed: statusToken(colours['ok-soft'], colours['status-managed']),
      partial: statusToken(colours['warn-soft'], colours['status-partial']),
      atRisk: statusToken(colours['bad-soft'], colours['status-risk']),
      // A badge's letters are words, 8px of them, so both quiet states are
      // drawn in a measured ink and told apart by their border.
      none: {
        bg: 'transparent',
        fg: colours['status-none'],
        border: colours.line,
      },
      unset: {
        bg: 'transparent',
        fg: colours['status-unset'],
        border: alpha(colours.line, 0.6),
      },
    },
    lifecycle: {
      // Semantic mapping (plan D2): upcoming → info, healthy → success,
      // sunsetting → warning, decommissioned → neutral (not an alert).
      planned: statusToken(colours['life-planned-soft'], colours['life-planned']),
      live: statusToken(colours['life-live-soft'], colours['life-live']),
      // The warning's soft ground: a badge carries words, and the timeline's
      // deeper `life-retiring-soft` is for a bar, at 3:1 with this ink.
      retiring: statusToken(colours['warn-soft'], colours['life-retiring']),
      retired: statusToken(colours['life-gone-soft'], colours['life-gone']),
    },
    actor: surfaceToken(colours, colours['card-surface']),
    externalSystem: surfaceToken(colours, colours['surface-2']),
    inputChannel: surfaceToken(colours, colours['card-surface']),
    managementTool: surfaceToken(colours, colours['surface-2']),
    component: surfaceToken(colours, colours['c4-container-fill'], colours['c4-container-line']),
    boundary: {
      bg: colours['c4-context-fill'],
      border: colours['line-strong'],
      fg: colours['ink-2'],
    },
    edge: {
      stroke: colours['line-uses'],
      strokeSelected: colours['selected-edge'],
      labelBg: colours['card-surface'],
      labelFg: colours['ink-2'],
      labelBorder: colours.line,
    },
    chips: {
      priceBg: colours['ok-soft'],
      priceFg: colours.ok,
      driftBg: colours['warn-soft'],
      driftFg: colours.warn,
      danglingBg: colours['bad-soft'],
      danglingFg: colours.bad,
    },
    handle: {
      bg: colours.accent,
      border: colours.surface,
    },
    minimap: {
      bg: colours.surface,
      mask: alpha(text, dark ? 0.5 : 0.12),
      node: alpha(text, dark ? 0.35 : 0.22),
      nodeBorder: colours.line,
    },
  };
}
