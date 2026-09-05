import { DEFAULT_TIDY_OPTIONS, type TidyOptions } from '../layout/tidy';
import { PANEL_LIMITS, panelWidth } from './panels';

/**
 * The editor's view settings — everything the toolbar and the panels remember
 * ABOUT LOOKING at a board, and nothing about the board itself.
 *
 * They were all session state (`useState` in `SolutionDesignEditor`, reset on
 * remount) because the package has no storage of its own and must not grow one:
 * a package that wrote to `localStorage` would fight a host that already stores
 * per-user settings server-side. So the package keeps owning the state and
 * gains one seam instead — `initialPreferences` in, `onPreferencesChange` out —
 * and the host decides whether that goes to `localStorage`, to a profile, or
 * nowhere at all.
 *
 * Deliberately NOT in here: anything the model already carries (a diagram's
 * `autoRoute` and `layoutConfig` are content and travel with the document), and
 * anything per-diagram — these are one set for the editor, exactly as the
 * session state they replace was.
 */
export interface EditorPreferences {
  /** Grid snapping while dragging (U4a). */
  snapToGrid: boolean;
  /** The visible dot grid (QF3). */
  showGrid: boolean;
  /** Lifecycle badges on nodes (U5). */
  showLifecycle: boolean;
  /** Left palette collapsed (U7b). */
  paletteCollapsed: boolean;
  /** Right inspector collapsed (U7b). */
  inspectorCollapsed: boolean;
  /** Left palette width in px when expanded (4B, drag handle). */
  paletteWidth: number;
  /** Right inspector width in px when expanded (4B, drag handle). */
  inspectorWidth: number;
  /** The React Flow minimap (4B): off by default — it costs board area. */
  showMinimap: boolean;
  /**
   * Board-level Tidy settings (the toolbar's caret popover).
   *
   * Defaults to hybrid + compact rather than to {@link DEFAULT_TIDY_OPTIONS} —
   * see {@link BOARD_TIDY_DEFAULTS}.
   */
  tidyOptions: TidyOptions;
  /** Per-group Tidy settings — deliberately separate from the board's. */
  groupTidyOptions: TidyOptions;
}

/**
 * What the board's Tidy does before anybody opens its settings.
 *
 * Hybrid, not `auto`: this is a domain-partitioned landscape, and hybrid is the
 * mode that reads as one — group boxes flow across, applications flow down
 * inside each box, so a domain is a column you can follow. `auto` picks an axis
 * from the shape of the space, which is a reasonable guess for an arbitrary
 * graph and the wrong one for a board whose whole structure is its groups.
 *
 * Compact, not `normal`: a landscape is looked at whole, on a screen, and the
 * air `normal` leaves is bought by making people zoom out until the labels stop
 * being readable.
 *
 * Deliberately NOT a change to {@link DEFAULT_TIDY_OPTIONS}. That constant is
 * the neutral default for a caller of `tidyLayer7` that omits options, and it
 * is shared with the per-group Tidy — where `hybrid` would be meaningless,
 * because there are no group boxes to flow across when you are laying out the
 * inside of one group. Two defaults because there are genuinely two decisions.
 */
export const BOARD_TIDY_DEFAULTS: TidyOptions = {
  ...DEFAULT_TIDY_OPTIONS,
  direction: 'hybrid',
  density: 'compact',
};

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  snapToGrid: false,
  showGrid: true,
  showLifecycle: true,
  paletteCollapsed: false,
  inspectorCollapsed: false,
  paletteWidth: PANEL_LIMITS.palette.default,
  inspectorWidth: PANEL_LIMITS.inspector.default,
  showMinimap: false,
  tidyOptions: BOARD_TIDY_DEFAULTS,
  groupTidyOptions: DEFAULT_TIDY_OPTIONS,
};

const DIRECTIONS: readonly string[] = ['horizontal', 'vertical', 'auto', 'hybrid'];
const DENSITIES: readonly string[] = ['compact', 'normal', 'spacious'];

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function tidyOptions(value: unknown, fallback: TidyOptions): TidyOptions {
  if (!value || typeof value !== 'object') return fallback;
  const raw = value as Record<string, unknown>;
  return {
    direction: DIRECTIONS.includes(raw.direction as string)
      ? (raw.direction as TidyOptions['direction'])
      : fallback.direction,
    density: DENSITIES.includes(raw.density as string)
      ? (raw.density as TidyOptions['density'])
      : fallback.density,
    pinAnchorPoints: bool(raw.pinAnchorPoints, fallback.pinAnchorPoints),
    pinGroups: bool(raw.pinGroups, fallback.pinGroups),
    pinGroupContents: bool(raw.pinGroupContents, fallback.pinGroupContents),
  };
}

/**
 * Fill the gaps in whatever the host handed over, field by field.
 *
 * `unknown` rather than `Partial<EditorPreferences>` because the realistic
 * source is a JSON blob from browser storage: written by an older version of
 * this tool, edited by hand, or truncated by a quota error mid-write. A settings
 * blob is never worth a broken editor, so every field falls back on its own —
 * one unreadable value costs that value and not the rest.
 */
export function mergePreferences(stored: unknown): EditorPreferences {
  if (!stored || typeof stored !== 'object') return DEFAULT_EDITOR_PREFERENCES;
  const raw = stored as Record<string, unknown>;
  const defaults = DEFAULT_EDITOR_PREFERENCES;
  return {
    snapToGrid: bool(raw.snapToGrid, defaults.snapToGrid),
    showGrid: bool(raw.showGrid, defaults.showGrid),
    showLifecycle: bool(raw.showLifecycle, defaults.showLifecycle),
    paletteCollapsed: bool(raw.paletteCollapsed, defaults.paletteCollapsed),
    inspectorCollapsed: bool(raw.inspectorCollapsed, defaults.inspectorCollapsed),
    // Widths go through the panel clamp rather than a type check: a stored 9000
    // is as real as a stored string, and a panel wider than the window is worse
    // than a forgotten preference.
    paletteWidth: panelWidth('palette', raw.paletteWidth),
    inspectorWidth: panelWidth('inspector', raw.inspectorWidth),
    showMinimap: bool(raw.showMinimap, defaults.showMinimap),
    tidyOptions: tidyOptions(raw.tidyOptions, defaults.tidyOptions),
    groupTidyOptions: tidyOptions(raw.groupTidyOptions, defaults.groupTidyOptions),
  };
}

function tidyEqual(a: TidyOptions, b: TidyOptions): boolean {
  return (
    a.direction === b.direction &&
    a.density === b.density &&
    a.pinAnchorPoints === b.pinAnchorPoints &&
    a.pinGroups === b.pinGroups &&
    a.pinGroupContents === b.pinGroupContents
  );
}

/**
 * Value equality, so the editor can stay quiet when nothing actually changed.
 * The emit runs from an effect over seven pieces of state; without this every
 * unrelated re-render would hand the host a fresh object and a host that writes
 * to storage on every call would write on every render.
 */
export function preferencesEqual(a: EditorPreferences, b: EditorPreferences): boolean {
  return (
    a.snapToGrid === b.snapToGrid &&
    a.showGrid === b.showGrid &&
    a.showLifecycle === b.showLifecycle &&
    a.paletteCollapsed === b.paletteCollapsed &&
    a.inspectorCollapsed === b.inspectorCollapsed &&
    a.paletteWidth === b.paletteWidth &&
    a.inspectorWidth === b.inspectorWidth &&
    a.showMinimap === b.showMinimap &&
    tidyEqual(a.tidyOptions, b.tidyOptions) &&
    tidyEqual(a.groupTidyOptions, b.groupTidyOptions)
  );
}
