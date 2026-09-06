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
