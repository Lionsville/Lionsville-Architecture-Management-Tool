import { alpha, type Theme } from '@mui/material/styles';
import type { AspectStatus, Layer7Zone, Lifecycle } from '../types';

/**
 * Visual tokens for canvas chrome and nodes, derived entirely from the host's
 * MUI theme so light and dark mode both look intentional. No hardcoded hex
 * here. The package has exactly one documented exception, for identity that a
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
     * Keyboard focus ring on a node (4B). Deliberately a DIFFERENT hue from
     * `selectedRing`: focus and selection are different states and routinely
     * disagree — you can tab past a node without selecting it — so drawing both
     * in the primary colour would make "where am I" unanswerable.
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

const cache = new WeakMap<Theme, NodeTokens>();

export function getNodeTokens(theme: Theme): NodeTokens {
  const cached = cache.get(theme);
  if (cached) return cached;
  const tokens = buildTokens(theme);
  cache.set(theme, tokens);
  return tokens;
}

function statusToken(theme: Theme, color: 'success' | 'warning' | 'error' | 'info'): AspectToken {
  const dark = theme.palette.mode === 'dark';
  const main = theme.palette[color].main;
  return {
    bg: alpha(main, dark ? 0.28 : 0.14),
    fg: dark ? theme.palette[color].light : theme.palette[color].dark,
    border: alpha(main, dark ? 0.5 : 0.35),
  };
}

function surfaceToken(theme: Theme, main: string): SurfaceToken {
  const dark = theme.palette.mode === 'dark';
  return {
    bg: alpha(main, dark ? 0.16 : 0.07),
    border: alpha(main, dark ? 0.55 : 0.4),
    fg: theme.palette.text.primary,
  };
}

function buildTokens(theme: Theme): NodeTokens {
  const { palette } = theme;
  const dark = palette.mode === 'dark';
  const text = palette.text.primary;

  return {
    mode: palette.mode,
    canvas: {
      dot: alpha(text, dark ? 0.16 : 0.14),
      outline: alpha(text, 0.12),
    },
    zone: {
      // Subtle per-zone identity tints; landscape stays paper.
      fill: {
        actors: alpha(palette.primary.main, dark ? 0.07 : 0.045),
        inputChannels: alpha(palette.info.main, dark ? 0.07 : 0.045),
        externalSystems: alpha(palette.secondary.main, dark ? 0.08 : 0.05),
        management: alpha(palette.warning.main, dark ? 0.07 : 0.05),
        landscape: 'transparent',
      },
      label: alpha(text, 0.45),
    },
    domainGroup: {
      border: alpha(text, 0.35),
      fill: alpha(text, dark ? 0.04 : 0.02),
      label: palette.text.secondary,
    },
    card: {
      bg: palette.background.paper,
      border: palette.divider,
      headerBg: alpha(text, dark ? 0.06 : 0.035),
      title: text,
      subtitle: palette.text.secondary,
      description: palette.text.secondary,
      selectedRing: palette.primary.main,
      focusRing: palette.info.main,
      warningBorder: palette.warning.main,
      // `common.white` rather than a literal — this file keeps its no-hex rule.
      logoPlate: alpha(palette.common.white, dark ? 0.92 : 0),
    },
    aspects: {
      managed: statusToken(theme, 'success'),
      partial: statusToken(theme, 'warning'),
      atRisk: statusToken(theme, 'error'),
      none: {
        bg: 'transparent',
        fg: palette.text.disabled,
        border: palette.divider,
      },
      unset: {
        bg: 'transparent',
        fg: alpha(palette.text.disabled, 0.6),
        border: alpha(palette.divider, 0.6),
      },
    },
    lifecycle: {
      // Semantic mapping (plan D2): upcoming → info, healthy → success,
      // sunsetting → warning, decommissioned → neutral/disabled (not an alert).
      planned: statusToken(theme, 'info'),
      live: statusToken(theme, 'success'),
      retiring: statusToken(theme, 'warning'),
      retired: {
        bg: alpha(palette.text.disabled, dark ? 0.18 : 0.1),
        fg: palette.text.disabled,
        border: palette.divider,
      },
    },
    actor: surfaceToken(theme, palette.primary.main),
    externalSystem: {
      bg: alpha(text, dark ? 0.08 : 0.04),
      border: alpha(text, 0.3),
      fg: text,
    },
    inputChannel: surfaceToken(theme, palette.info.main),
    managementTool: surfaceToken(theme, palette.secondary.main),
    component: surfaceToken(theme, palette.primary.main),
    boundary: {
      bg: alpha(text, dark ? 0.03 : 0.015),
      border: alpha(text, 0.35),
      fg: palette.text.secondary,
    },
    edge: {
      stroke: alpha(text, dark ? 0.55 : 0.45),
      strokeSelected: palette.primary.main,
      labelBg: palette.background.paper,
      labelFg: palette.text.secondary,
      labelBorder: palette.divider,
    },
    chips: {
      priceBg: alpha(palette.success.main, dark ? 0.25 : 0.12),
      priceFg: dark ? palette.success.light : palette.success.dark,
      driftBg: alpha(palette.warning.main, dark ? 0.3 : 0.15),
      driftFg: dark ? palette.warning.light : palette.warning.dark,
      danglingBg: alpha(palette.error.main, dark ? 0.3 : 0.12),
      danglingFg: dark ? palette.error.light : palette.error.dark,
    },
    handle: {
      bg: alpha(palette.primary.main, 0.9),
      border: palette.background.paper,
    },
    minimap: {
      bg: palette.background.paper,
      mask: alpha(text, dark ? 0.5 : 0.12),
      node: alpha(text, dark ? 0.35 : 0.22),
      nodeBorder: palette.divider,
    },
  };
}
