// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Stroke icons, drawn from nothing.
 *
 * No `@mui/icons-material`: these are a handful of 24×24 `currentColor` paths,
 * and the dependency is a megabyte. They live in `widgets/` rather than in the
 * editor because the documentation page and the decisions page draw the same
 * arrows and pencils, and neither may import the editor.
 */

interface IconProps {
  size?: number;
}

export function TidyIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <path d="M17.5 14v7M14 17.5h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Split-button caret: "this control has more behind it". */
export function CaretIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Live auto-routing: the route-only glyph with a motion arc over it, so the pair
 * reads as "route once" beside "keep routing".
 */
export function AutoRouteIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="6" width="6" height="5" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="16" y="16" width="6" height="5" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 11v5h14v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 6a6 6 0 0 1 8-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M20 3l-2.4 0.2M20 3l-0.4 2.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Route connections only: two fixed nodes with an orthogonal line stepping between them. */
export function RouteIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="3" width="6" height="5" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="16" y="16" width="6" height="5" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 8v4h14v4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FullscreenIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FitIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ExportIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TrashIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HelpIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M9.5 9.2a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1.1.9-1.1 1.6v.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="16.5" r="1" fill="currentColor" />
    </svg>
  );
}

/** As of: a calendar leaf, for the day a board shows (ADR-0009). */
export function AsOfIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3.5" y="5" width="17" height="15" rx="2"
        stroke="currentColor" strokeWidth="2"
      />
      <path d="M3.5 10h17M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Lifecycle: stages along a line (planned → live → retiring → retired). */
export function LifecycleIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="5" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="19" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

export function AddIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function BackIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UndoIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RedoIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EyeIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function PencilIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Visible dot-grid toggle: a 3×3 lattice of dots (distinct from SnapGridIcon). */
export function GridIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {[6, 12, 18].map((cy) =>
        [6, 12, 18].map((cx) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.4" fill="currentColor" />
        )),
      )}
    </svg>
  );
}

/** Three tracks with a handle on each: what a page is made to show. */
export function SlidersIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {[[9, 7], [15, 12], [7, 17]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.2" fill="currentColor" />
      ))}
    </svg>
  );
}

export function SnapGridIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 9h16M4 15h16M9 4v16M15 4v16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Align icons: a guide line with two blocks snapped to it. */
export function AlignLeftIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 4v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="5" y="6" width="12" height="4" rx="1" fill="currentColor" />
      <rect x="5" y="14" width="8" height="4" rx="1" fill="currentColor" />
    </svg>
  );
}

export function AlignCenterXIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="4" y="6" width="16" height="4" rx="1" fill="currentColor" />
      <rect x="7" y="14" width="10" height="4" rx="1" fill="currentColor" />
    </svg>
  );
}

export function AlignRightIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M21 4v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="7" y="6" width="12" height="4" rx="1" fill="currentColor" />
      <rect x="11" y="14" width="8" height="4" rx="1" fill="currentColor" />
    </svg>
  );
}

export function AlignTopIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 3h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="6" y="5" width="4" height="12" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="8" rx="1" fill="currentColor" />
    </svg>
  );
}

export function AlignCenterYIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" />
      <rect x="14" y="7" width="4" height="10" rx="1" fill="currentColor" />
    </svg>
  );
}

export function AlignBottomIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 21h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="6" y="7" width="4" height="12" rx="1" fill="currentColor" />
      <rect x="14" y="11" width="4" height="8" rx="1" fill="currentColor" />
    </svg>
  );
}

export function DistributeHorizontalIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="6" width="4" height="12" rx="1" fill="currentColor" />
      <rect x="10" y="6" width="4" height="12" rx="1" fill="currentColor" />
      <rect x="18" y="6" width="4" height="12" rx="1" fill="currentColor" />
    </svg>
  );
}

export function DistributeVerticalIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="6" y="2" width="12" height="4" rx="1" fill="currentColor" />
      <rect x="6" y="10" width="12" height="4" rx="1" fill="currentColor" />
      <rect x="6" y="18" width="12" height="4" rx="1" fill="currentColor" />
    </svg>
  );
}

/** ⌘F: find an element by name (4B). */
export function SearchIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" />
      <path d="M15.5 15.5 20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** The line-label toggle: a line with a label chip sitting on it. */
export function LabelIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 12h4M17 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="7" y="8" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M10 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** The minimap toggle (4B): a board with a viewport rectangle on it. */
export function MinimapIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="6" y="8" width="7" height="6" rx="1" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

/**
 * Maturity: concentric rings with a sweep and a blip on it.
 *
 * The diagram's settings are, in practice, the maturity columns — so the tab
 * carries the radar rather than a gear, which would promise "everything about
 * this diagram" and be one more anonymous cog in a bar that has enough of them.
 */
export function RadarIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M12 12l6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="15.5" cy="8.5" r="1.7" fill="currentColor" />
    </svg>
  );
}

/** A page with lines on it: this element has documentation worth opening. */
export function DocGlyph({ size = 12, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 3h8l5 5v13H6z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h7M9 17h7" />
    </svg>
  );
}

/**
 * An agent beside the app: a rounded head with two eyes and an antenna.
 * Outline when nothing is connected, filled when something is — the glyph
 * carries the state, and the tooltip names it.
 */
export function AgentIcon({ size = 18, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3v3M9 6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect
        x="4" y="8" width="16" height="12" rx="3"
        stroke="currentColor" strokeWidth="2" fill={filled ? 'currentColor' : 'none'}
      />
      <circle cx="9" cy="14" r="1.5" fill={filled ? 'var(--agent-eye, #fff)' : 'currentColor'} />
      <circle cx="15" cy="14" r="1.5" fill={filled ? 'var(--agent-eye, #fff)' : 'currentColor'} />
    </svg>
  );
}

/**
 * The organisation screen's four cards. Each says what its page is made of
 * rather than being a generic document: a journey band over columns, a record
 * with a verdict on it, spans on an axis, and rows in a list.
 */
export function SheetIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 9h18" stroke="currentColor" strokeWidth="2" />
      <path d="M9 9v11M15 9v11" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** An eye over a line of marks: what was seen, and the trail behind it (ADR-0021). */
export function ObservationIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function DecisionIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 3h8l4 4v14H6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 13.5l2 2 4-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TimelineIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 5h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="4" y="9" width="10" height="4" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="10" y="16" width="10" height="4" rx="1.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** A grid with a mark in it: functions against applications, the map. */
export function MapIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 9.5h18M3 15h18M9 4v16M15 4v16" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12.25" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function RegisterIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M7 9h10M7 12.5h10M7 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * A landscape's home's two cards beside those: boxes with a line between
 * them for the views, and lines of text under a heading for the pages.
 */
export function LandscapeIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="7" height="6" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="14" width="7" height="6" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <path d="M10 7h4v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DocumentIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 3h8l4 4v14H6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 11h6M9 15h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Boxes inside boxes: the deployment view (ADR-0013). */
export function DeploymentIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="3" width="20" height="18" rx="2" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2.5" />
      <rect x="6" y="7" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2.5" />
      <rect x="9" y="10.5" width="6" height="3.5" rx="1" fill="currentColor" />
    </svg>
  );
}

/** Swatches: the landscape's colour-by overlay (ADR-0013). */
export function PaletteIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.85" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.3" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** A key: three swatches with a line beside each, for "what the badges mean". */
export function LegendIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="4" height="4" rx="1" fill="currentColor" />
      <rect x="4" y="10.5" width="4" height="4" rx="1" fill="currentColor" opacity="0.6" />
      <rect x="4" y="16" width="4" height="4" rx="1" fill="currentColor" opacity="0.3" />
      <path d="M11 7h9M11 12.5h9M11 18h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// --- the observations page's actions (ADR-0032 §7) ------------------------------------------

/** Two links of a chain: link this to a cause. */
export function LinkIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M10 14l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M11 6.5l1.5-1.5a4.2 4.2 0 0 1 6 6L17 12.5M13 17.5L11.5 19a4.2 4.2 0 0 1-6-6L7 11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The chain broken: this no longer explains that. */
export function UnlinkIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M11 6.5l1.5-1.5a4.2 4.2 0 0 1 6 6L17 12.5M13 17.5L11.5 19a4.2 4.2 0 0 1-6-6L7 11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** An arrow turning in and down: ask why again. */
export function DeeperIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 4v8a5 5 0 0 0 5 5h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 13.5l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A target: where the chain ends, a root cause. */
export function RootCauseIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** Up, in a ring: a cause made a root cause. */
export function MakeRootIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 16.5v-9M8.5 11L12 7.5l3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Down, in a ring: a root cause made a cause again. */
export function MakeCauseIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7.5v9M8.5 13L12 16.5l3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A tick: verified, or confirmed. */
export function CheckIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4.5 12.5l4.8 4.5L19.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A bulb: a solution. */
export function SolutionIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 18.5h6M10 21.5h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 2.8a6.2 6.2 0 0 0-3.7 11.2c.7.6 1.2 1.4 1.2 2.3v.5h5v-.5c0-.9.5-1.7 1.2-2.3A6.2 6.2 0 0 0 12 2.8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** Two lines becoming one: merge. */
export function MergeIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 4l6 7.5L18 4M12 11.5V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A box with its lid: archived, kept. */
export function ArchiveIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4.5" width="18" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="2" />
      <path d="M4.5 9v10h15V9M10 13h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A globe: the organisation's own analysis, above the scopes below it. */
export function GlobeIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** A dashed boundary: a scope below, and what is local to it. */
export function ScopeIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3.5" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
}

/** A flask: an experiment. */
export function ExperimentIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 3h6M10 3v6l-5.2 9.6A1.6 1.6 0 0 0 6.2 21h11.6a1.6 1.6 0 0 0 1.4-2.4L14 9V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 15h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** A cross: take this off, or refuted. */
export function CloseIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** A level line: neither way, inconclusive. */
export function MinusIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// --- the observations page's filters (ADR-0032 §8) ------------------------------------------

/** A funnel: the filters that narrow a picture or a list (ADR-0032 §8). */
export function FilterIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 4.5h18l-6.75 8.25v6.75l-4.5-2.25v-4.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** A bookmark: filters kept under a name. */
export function BookmarkIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 3h12v18l-6-4.5L6 21z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
