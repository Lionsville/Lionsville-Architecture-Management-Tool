import type { ReactNode } from 'react';
import type { Language } from './i18n/strings';
import type { EditorPreferences } from './model/preferences';

/**
 * Public contract of @lionsville/solution-design.
 *
 * These types mirror the API save contract (see
 * docs/plans/2026-06-10-solution-design/foundation/2026-06-10-solution-design-plan.md, Phase 2b). The host (hal_app)
 * maps its DTOs onto this model; the package never talks to a backend itself.
 */

/** The Lionsville aspect superset; element aspect keys may also be custom slugs. */
export type AspectKey =
  | 'platform'
  | 'cicd'
  | 'dr'
  | 'security'
  | 'monitoring'
  | 'backup'
  | 'compliance'
  | 'cost';
export type AspectStatus = 'managed' | 'partial' | 'none' | 'atRisk';

/** Per-aspect state on an element; `note` is the per-application description. */
export interface AspectEntry {
  status: AspectStatus;
  note?: string;
}

/** One configured aspect column on a layer7 diagram (ordered). */
export interface AspectConfigEntry {
  /**
   * What per-element aspect values are filed under. Stable for the life of the
   * column: renaming a column must not orphan every status already recorded
   * against it, so the label moves and this does not.
   */
  key: string;
  label: string;
  /**
   * What the badge cell shows, when the derived code is wrong. Absent = the
   * curated code for a superset key, else derived from the label.
   */
  code?: string;
}
export type ElementKind =
  | 'actor'
  | 'application'
  | 'externalSystem'
  | 'inputChannel'
  | 'managementTool'
  | 'component';
export type Layer7Zone =
  | 'actors'
  | 'inputChannels'
  | 'externalSystems'
  | 'landscape'
  | 'management';
/** Element lifecycle stage — closed set, defaults to 'live' (see model-mapping). */
export type Lifecycle = 'planned' | 'live' | 'retiring' | 'retired';
/** Server id as string, or temp id 'tmp-…' (see createTempId/isTempId). */
export type ElementId = string;

/**
 * Root-box shape override for a node; absent = each kind's current shape.
 * `figure` is the actor stickman (U7c/D11) — actor-only; other kinds ignore it
 * and fall back to their default shape.
 */
export type NodeShapeVariant = 'rounded' | 'sharp' | 'subtle' | 'figure';

/**
 * How big a node draws its icon; absent = `small`.
 *
 * `small` is the header mark the nodes have always drawn (≈14 px, beside the
 * name). `large` promotes it to a ≈28 px mark leading the body, for a diagram
 * that is read from a distance or across a room — the icon then carries the box
 * and the name annotates it, rather than the other way round.
 */
export type NodeIconSize = 'small' | 'large';

export interface DesignElement {
  id: ElementId;
  kind: ElementKind;
  parentApplicationId?: ElementId;
  name: string;
  category?: string;
  vendor?: string;
  technology?: string;
  description?: string;
  lifecycle: Lifecycle;
  isManaged: boolean;
  /** Keyed by aspect key (superset or custom slug). */
  aspects: Record<string, AspectEntry>;
  parameters: DesignParameters;
  /**
   * Per-element presentation overrides (U6a). Each is absent-means-inherit: the
   * accent falls back to the theme category strip (card) / surface tint (others),
   * the shape to each kind's current radius, and the logo to today's glyph.
   * Only a value the user explicitly set is present.
   */
  accentColor?: string;
  shapeVariant?: NodeShapeVariant;
  /** Curated logo key resolved by the frontend registry (U6b); absent = no logo. */
  iconKey?: string;
  /** See {@link NodeIconSize}; absent = `small` (the header mark). */
  iconSize?: NodeIconSize;
}

export interface DesignParameters {
  complexity?: number;
  maturity?: number;
  cloudNativeness?: number;
  coCreationFactor?: number;
  serviceLevel?: string;
  quantity?: number;
  pricePerItem?: number;
  period?: string;
}

/** Line dash style for a connection; absent = solid. */
export type EdgeLineStyle = 'solid' | 'dashed' | 'dotted';
/** Path shape for a connection; absent = smooth (today's smooth-step default). */
export type EdgeRouting = 'smooth' | 'orthogonal' | 'straight' | 'curved';
/** Per-end arrowhead; absent = derive from `isBidirectional`. */
export type EdgeArrowhead = 'none' | 'arrow';

export interface DesignConnection {
  id: string;
  sourceId: ElementId;
  targetId: ElementId;
  label?: string;
  protocol?: string;
  isBidirectional: boolean;
  /**
   * Per-edge presentation overrides (U4b). Each is absent-means-inherit: the
   * stroke falls back to the theme edge token, the line to solid, the path to
   * smooth-step, and the arrowheads to the `isBidirectional`-derived default.
   * Only a value the user explicitly set is present.
   */
  color?: string;
  lineStyle?: EdgeLineStyle;
  routing?: EdgeRouting;
  sourceArrowhead?: EdgeArrowhead;
  targetArrowhead?: EdgeArrowhead;
}

export interface DiagramPlacement {
  elementId: ElementId;
  zone?: Layer7Zone;
  domainGroup?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/** A point in flow coordinates. */
export interface Point {
  x: number;
  y: number;
}

/** A side of a node rect a line end can be told to attach to. */
export type AttachSide = 'top' | 'right' | 'bottom' | 'left';

/**
 * Per-diagram presentation overrides for one connection: manual routing points
 * (ordered), a custom label anchor and/or the side each end attaches to. In a
 * batch upsert, an entry with no waypoints, no label position, no pin AND no
 * fixed side deletes the stored row — the one definition of "has content" is
 * `hasRouteContent` in `model/routes.ts`.
 */
export interface EdgeRoute {
  connectionId: string;
  waypoints: Point[];
  /** Custom label anchor (flow coords); absent = automatic path midpoint. */
  labelPosition?: Point;
  /**
   * The side of the SOURCE node this line leaves from, and of the TARGET node it
   * arrives at. Per diagram, like everything else on this row; absent = automatic
   * (the closest side, re-chosen whenever a node moves).
   *
   * A side is a CONSTRAINT, not geometry: the router honours it (a pinned end in
   * libavoid), the renderer anchors on it, and a row that carries nothing but a
   * side stays `source: 'auto'` — routable — rather than claiming the line the
   * way a dragged bend does.
   */
  sourceSide?: AttachSide;
  targetSide?: AttachSide;
  /**
   * The user pinned this line explicitly ("Pin route"), as opposed to claiming it
   * by dragging a bend. Presence keeps a row alive that would otherwise be a
   * delete marker: a straight line with no bends and no label anchor has no
   * geometry to store, yet "leave this line alone" is still a fact worth keeping,
   * so it rides on this flag with `source: 'manual'`.
   *
   * Optional, absent means not pinned. Clearing every bend of a pinned route keeps
   * the row (the line stays straight AND stays pinned); clearing the bends of an
   * unpinned hand-drawn route deletes it, which hands the line back to the router.
   */
  pinned?: boolean;
  /**
   * Who produced this geometry. `manual` means a person placed it — a dragged
   * waypoint, an inserted bend, or a chip they moved; `auto` means the router
   * computed it.
   *
   * Optional, and **absent means `manual`**, so nothing downstream has to handle
   * a third state and a route from a client that predates provenance keeps its
   * handles. Read it through {@link routeSource} rather than comparing directly.
   *
   * The rule it carries: an automatic pass may replace an `auto` route and must
   * never replace a `manual` one. Any hand edit rewrites this to `manual` in the
   * same commit, so nudging one line claims it — and one undo gives it back.
   */
  source?: EdgeRouteSource;
}

/** See {@link EdgeRoute.source}. */
export type EdgeRouteSource = 'manual' | 'auto';

/** Resizable band sizes: height for actors/management, width for the side bands. */
export type ResizableZone = 'actors' | 'inputChannels' | 'externalSystems' | 'management';

/** Explicit, movable/resizable domain-group rectangle (landscape). */
export interface DomainGroupRect {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * Group colour as a hex, absent-means-inherit — the same NULL-inherit contract
   * as {@link DesignElement.accentColor}. Absent draws the theme's neutral
   * domain-group tokens; set tints the dashed border, the label and a faint
   * interior wash. Presentation only: nothing reads a group's colour to decide
   * anything, so a group that loses it still groups.
   */
  color?: string;
}

export interface DiagramLayoutConfig {
  zones?: Partial<Record<ResizableZone, { size: number }>>;
  domainGroups?: DomainGroupRect[];
  /**
   * Layer 7 canvas size override for larger landscapes (iteration 3). Absent =
   * the default 1680×1040 board; never smaller than the default.
   */
  canvas?: { width: number; height: number };
}

export interface DesignDiagram {
  id: string;
  kind: 'layer7' | 'container';
  name: string;
  /**
   * Who drew it. Rendered in the exported PNG's title block, and nowhere else —
   * this is a caption on a drawing, not an ownership record.
   */
  author?: string;
  /**
   * Who it was drawn for, when that is not simply the group the project is
   * filed under. Absent = the host's answer (the group name).
   */
  client?: string;
  /**
   * The date the title block carries, as `YYYY-MM-DD`. Absent = the day it was
   * exported, which is right for a working print and wrong for a diagram that
   * goes into a dated report and gets re-exported after a typo fix.
   */
  documentDate?: string;
  /** Whether the exported PNG carries a title block at all. Absent = it does. */
  showTitleBlock?: boolean;
  applicationElementId?: ElementId;
  placements: DiagramPlacement[];
  /** Per-diagram manual edge routes; absence/empty = default floating routing. */
  edgeRoutes?: EdgeRoute[];
  /**
   * Ordered aspect columns (layer7); falls back to the default five when
   * absent. An empty array is a decision, not an absence — see
   * {@link ../model/aspects.aspectConfigFor}.
   */
  aspectConfig?: AspectConfigEntry[];
  /**
   * Whether the maturity badges appear at all (layer7). Absent = they do.
   *
   * Separate from an empty `aspectConfig` on purpose: hiding the row for one
   * audience must not throw away a mapping somebody spent an afternoon on.
   */
  showAspects?: boolean;
  layoutConfig?: DiagramLayoutConfig;
  estimatedMonthlyCost?: number;
  costEstimateNote?: string;
  /**
   * Live auto-routing for this diagram: while on, any geometry or topology change
   * re-routes the whole board. Absent = off, which is the default.
   *
   * Persisted per diagram rather than held in editor state, because it changes
   * behaviour every time the diagram is opened — a session-only flag would
   * silently forget it. Applies to container diagrams as well as layer7.
   */
  autoRoute?: boolean;
  /**
   * A machine wrote this diagram's geometry and no person has accepted it yet, so
   * the editor lays it out once on first open (intent rule 12).
   *
   * Set by whoever WROTE the geometry — the container-diagram seed, an import —
   * and cleared by the host once the settling pass has landed. Never inferred
   * from the coordinates: a hand-built diagram and a machine-seeded one are
   * indistinguishable by shape, and the two obvious heuristics are wrong in the
   * dangerous direction. "Every placement at (0,0)" fires on neither writer,
   * since both seed a real grid; "no layoutConfig, so it was never tidied" is
   * also true of a hand-built landscape whose author never made a domain group,
   * and would rearrange their curated board the first time they opened it.
   *
   * Plain data, no HAL types — the package stays host-agnostic by construction.
   */
  needsLayout?: boolean;
}

/**
 * A diagram's own settings, as the settings dialog hands them over: the whole
 * answer each time, not a patch. An absent field means "unset" — the host
 * should let it fall back rather than keeping a previous value.
 */
export interface DiagramSettings {
  name: string;
  author?: string;
  client?: string;
  documentDate?: string;
  showTitleBlock?: boolean;
  aspectConfig?: AspectConfigEntry[];
  showAspects?: boolean;
}

export interface DesignModel {
  name: string;
  customerName: string;
  diagrams: DesignDiagram[];
  elements: DesignElement[];
  connections: DesignConnection[];
}

/** Mirrors the API save contract (PUT diagrams/{id}/content). */
export interface DiagramContentBatch {
  diagramId: string;
  /** Element upserts touched this editing session (may carry temp ids). */
  elements: DesignElement[];
  deletedElementIds: string[];
  connections: DesignConnection[];
  deletedConnectionIds: string[];
  /** Full placement set for THIS diagram. */
  placements: DiagramPlacement[];
  /** Element ids whose placement was removed from this diagram. */
  removedPlacementElementIds: string[];
  /** Route upserts touched this session; empty waypoints = delete the route. */
  edgeRoutes: EdgeRoute[];
  /** Present only when touched this session; upserted whole. */
  layoutConfig?: DiagramLayoutConfig;
  /**
   * Present only when the auto-route toggle was flipped this session; absent =
   * unchanged. Rides the content batch so the toggle costs no extra round-trip.
   */
  autoRoute?: boolean;
}

export interface ParameterSpec {
  key: keyof DesignParameters;
  label: string;
  input: 'slider' | 'number' | 'select' | 'text';
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

/** One host-computed figure rendered as a small chip on a card. */
export interface DecorationChip {
  label: string;
  value: string;
  title?: string;
}

export interface ElementDecoration {
  linkCount?: number;
  drift?: boolean;
  dangling?: boolean;
  unlinkedWarning?: boolean;
  monthlyPrice?: number;
  /**
   * Derived figures rendered as a compact chip row (iteration 3: applications
   * show combined complexity + averaged maturity/cloud-nativeness from their
   * components). The package renders; the host computes — it stays
   * semantics-agnostic about parameters.
   */
  parameterSummary?: DecorationChip[];
  /** When set: warning icon with this tooltip ("commercial parameters incomplete"). */
  incompleteWarning?: string;
}

/**
 * An entry from the shared uploaded logo library (intent rule 9). The host
 * supplies the URL; the package renders it in an `img` and never fetches or
 * inlines it — an uploaded SVG inlined into the DOM could carry a script.
 */
export interface UploadedLogo {
  key: string;
  label: string;
  url: string;
}

/**
 * What a host's markdown renderer may be told beyond the text.
 *
 * An element link is a link whose href is `element:<id>`. The package writes
 * those (a `[[Name]]` in a description resolves to one); the renderer only has
 * to recognise the scheme and hand the id back, so it stays ignorant of the
 * model and the page stays ignorant of the renderer.
 */
export interface WindowChrome {
  /** Space to keep clear at the start of a top bar, in px. */
  controlsInset: number;
  /** Whether a top bar must also drag the window. */
  draggable: boolean;
}

export interface MarkdownRenderOptions {
  onElementLink?(elementId: string): void;
}

export interface SolutionDesignEditorProps {
  model: DesignModel;
  activeDiagramId: string;
  readOnly?: boolean;
  onActiveDiagramChange(diagramId: string): void;
  /** Debounced by the host; emitted on every local mutation. */
  onChange(batch: DiagramContentBatch): void;
  onCreateContainerDiagram(applicationElementId: ElementId): void;
  onCreateLayer7Diagram(): void;
  /**
   * Diagram management from a Layer 7 tab's right-click menu. Each entry is
   * offered only when its callback is present, so a host that manages diagrams
   * elsewhere sees no half-wired menu.
   *
   * `onRenameDiagram` receives the NEW name: the editor asks for it (a small
   * dialog with the current name preselected) and hands over the trimmed result,
   * so the host has nothing to prompt for. `onDeleteDiagram` is a request — the
   * host confirms in its own way and decides what becomes active; the editor
   * only refuses (disables the entry) for the last remaining landscape.
   */
  onRenameDiagram?(diagramId: string, name: string): void;
  onDuplicateDiagram?(diagramId: string): void;
  onDeleteDiagram?(diagramId: string): void;
  /**
   * Apply a diagram's settings — its name, what the exported title block says,
   * and which maturity columns its applications carry. The editor opens the
   * dialog and hands over the whole answer; wiring this is what puts "Diagram
   * settings…" in a tab's menu.
   *
   * Deliberately not part of `DiagramContentBatch`: that batch is content —
   * elements, connections, placements, routes — and this is the diagram record.
   */
  onDiagramSettingsChange?(diagramId: string, settings: DiagramSettings): void;
  parameterSpecs(element: DesignElement): ParameterSpec[];
  decorations?: Record<ElementId, ElementDecoration>;
  /** CM links + ADR slots, rendered by the host inside the inspector. */
  renderInspectorExtras?(element: DesignElement): ReactNode;
  /** Coverage/ADR panel slot, rendered in the toolbar. */
  renderDesignPanelExtras?(): ReactNode;
  exportTitleBlock?: { client: string; author?: string };
  /**
   * The shared uploaded logo library. The package never fetches it — the host
   * loads it and passes `{ key, label, url }` per entry, the same way the
   * commercial and ADR sections arrive as host-rendered slots. Absent = only the
   * built-in generic marks are offered.
   */
  logoLibrary?: UploadedLogo[];
  /**
   * Opens the host's logo-upload dialog. Absent = no upload affordance, which is
   * the correct state for a host that has no library endpoint.
   */
  onRequestLogoUpload?(): void;
  /**
   * Called after a PNG export that could not embed one or more logo marks, with
   * their labels. The export still produced an image — those elements fall back
   * to their kind glyph — but the host should tell the user, because a diagram
   * that quietly lost its marks looks finished and is not.
   */
  onExportImagesMissing?(labels: string[]): void;
  /**
   * Optional markdown renderer for element descriptions. The package stays
   * dependency-free here: without it, the preview falls back to a plain
   * <pre> block. The host passes its themed renderer.
   *
   * The second argument is what the package knows and the renderer does not:
   * today, what to do with a link to another element. Callers that only need
   * the text still call it with one argument.
   */
  renderMarkdown?(md: string, options?: MarkdownRenderOptions): ReactNode;
  /**
   * Imperative focus request (e.g. the coverage drawer's click-to-focus).
   * When `nonce` changes, the editor selects the element and pans/zooms to
   * it; if it is only placed on another diagram, it first requests a switch
   * via onActiveDiagramChange and completes the focus once the host updates
   * activeDiagramId. Elements placed on no diagram are a no-op.
   */
  focusElement?: { id: ElementId; nonce: number };
  /**
   * Open the documentation page from outside the editor — a host's own menu
   * bar, or its search. Without `elementId` the page opens on the selected
   * element, failing that the first element placed on the active diagram, and
   * failing that the first element in the model; with no elements at all it
   * does nothing. Bump `nonce` to ask again.
   */
  documentationRequest?: { elementId?: ElementId; nonce: number };
  /**
   * Scope-level cost summary, rendered as a corner chip on layer7 diagrams.
   * The host composes it from the diagram's estimate and linked scope T&S
   * line totals.
   */
  scopeSummary?: {
    estimatedMonthlyCost?: number;
    costEstimateNote?: string;
    linkedTasMonthly?: number;
    /**
     * Estimate-vs-linked-T&S delta (B1), composed by the host from its own
     * delta helper. Optional and undefined-means-hide, like the rest of
     * this prop — hosts that don't compute a delta see no change.
     */
    delta?: {
      amount: number;
      percent: number | undefined;
      significant: boolean;
      periodMismatch: boolean;
    };
  };
  /** When provided, the toolbar shows a fullscreen button (host implements the view). */
  onOpenFullscreen?: () => void;
  /**
   * What the host window paints over the top of a full-window view, and
   * whether that view's top bar has to double as the handle that moves the
   * window. A desktop build that hides the macOS title bar leaves the traffic
   * lights over our top-left corner: anything the editor draws across the
   * whole window (the documentation page) must start after them, or its first
   * button sits underneath them and cannot be clicked. Absent = a browser tab,
   * where the page owns every pixel.
   */
  windowChrome?: WindowChrome;
  /**
   * Force-save hook (U4c, DK8). Mod+S always suppresses the browser's save
   * dialog; when this prop is present it also flushes the host's pending saves
   * (e.g. `DiagramSaveQueue.flush(activeDiagramId)`). Absent, Mod+S is a pure
   * preventDefault no-op so the package still works standalone.
   */
  onForceSave?: () => void;
  /**
   * A layout action (Tidy, route-only) failed. The edge router is WebAssembly
   * fetched at runtime, so it can fail for reasons the user can act on: the
   * `.wasm` 404s behind a CDN rule or a stale build, or the module aborts and
   * stays down until the page reloads. Without this the whole failure is a
   * console rejection, and the button just looks dead.
   *
   * `message` is ready to show as-is. The host is expected to surface it (hal_app
   * uses `useNotify().error`). The editor always logs the failure to the console as
   * well, wired or not, so the cause stays available for debugging.
   */
  onLayoutError?(message: string): void;
  /**
   * Diagrams whose geometry THIS SESSION created, so the editor lays them out on
   * open even without the persisted flag — a container diagram the user just
   * created by double-clicking an application, or an import applied in this tab.
   *
   * The session half of the "unclaimed geometry" signal. It costs no migration
   * and covers the case that ships first; the persisted flag covers the one this
   * session cannot know about, such as a diagram an agent created hours ago.
   */
  layoutOnOpenDiagramIds?: string[];
  /**
   * An automatic layout has landed on this diagram. Fires exactly once per
   * diagram per session, and only when the pass produced placements.
   *
   * The host clears the persisted `needsLayout` flag from here. Deliberately the
   * host's job and not the content-save endpoint's: having a save clear it
   * whenever it receives placements is tempting and wrong, because an ordinary
   * node drag would then clear it before the layout ever ran, and a flag that
   * clears itself for reasons the editor cannot see is a flag nobody can reason
   * about.
   *
   * The editor says nothing itself. It has one message channel, `onLayoutError`,
   * and that one is for failures — making it carry good news too would be the
   * first step toward a layout that narrates itself.
   */
  onLayoutSettled?(diagramId: string): void;
  /**
   * Authoritative tempId → real-id maps, accumulated by the host from its
   * save responses. Reconciliation resolves temp ids from these first and
   * only falls back to heuristic matching (kind/name/placement) for ids the
   * maps don't cover — heuristics alone cannot tell identical twins apart
   * (two default-named elements, two identical parallel connections).
   *
   * The host MUST hand over a NEW object whenever it learns an alias — never
   * mutate the maps in place. Aliases routinely land in a later commit than the
   * model swap of the same save (the host fills them once its save call
   * resolves, while the mutation's success handler already pushed the new
   * content), and reconciliation re-runs on this prop's identity. An in-place
   * mutation is invisible to that effect and strands the tempId (see the
   * undo/redo remap in useEditorState).
   */
  idAliases?: {
    elements: ReadonlyMap<ElementId, ElementId>;
    connections: ReadonlyMap<string, string>;
  };
  /**
   * View settings to start with — snap, grid, lifecycle badges, panel collapse
   * and the two Tidy option sets (see `EditorPreferences`). Read ONCE, on mount:
   * they seed the editor's own state rather than controlling it, so a host that
   * persists them cannot fight the user's next click. Missing or unreadable
   * fields fall back one by one to the package defaults.
   */
  initialPreferences?: unknown;
  /**
   * Those settings changed. Fires only on a real change (value equality, not
   * identity), so a host may write straight to storage from here.
   *
   * The package deliberately owns no storage: hosts differ on where a
   * preference belongs — this browser, a user profile, or nowhere — and a
   * package that picked one would be wrong for the other two.
   */
  onPreferencesChange?(preferences: EditorPreferences): void;
  /**
   * Bump this when the host replaces the DOCUMENT under the same diagram ids —
   * opening a file, or reverting to a shipped one.
   *
   * It clears the undo/redo stacks and any pending local overlay, which is
   * exactly what a remount used to do and the only part of a remount that was
   * ever load-bearing here. Without it a host that stops remounting on file open
   * (to keep the viewport, the selection and the panel state) leaves ⌘Z able to
   * restore content from the PREVIOUS document — undo steps are diffs, and the
   * model they were diffed against is gone.
   *
   * Not needed when the diagram ids themselves change: a host swapping those
   * must still remount, because the editor's once-per-session settling pass is
   * keyed by diagram id.
   */
  historyResetToken?: number | string;
  /**
   * The UI language. Default `'en'`.
   *
   * A prop and not a preference: an embedded editor has to speak whatever the
   * page around it speaks, and a host that already knows its user's language
   * (a profile, a URL segment, an app-wide setting) must not have to teach the
   * editor a second time. The editor never changes it by itself.
   */
  language?: Language;
  /**
   * The user asked for the other language, from the toolbar's NL/EN toggle.
   *
   * Its presence is what puts that toggle in the toolbar: an editor whose host
   * owns the language elsewhere should not offer a control that fights it. Wire
   * it, persist the value, and hand it back through `language`.
   */
  onLanguageChange?(language: Language): void;
}

/** Axis-aligned rectangle in flow coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExportTitleBlock {
  /**
   * The row captions, in the UI language. Optional and English by default, so a
   * host calling `exportDiagramPng` directly keeps the block it always got; the
   * editor passes the translated set (4B) because the block is a caption on a
   * picture for a reader, not a field name in a file format.
   */
  labels?: {
    client: string;
    title: string;
    author: string;
    date: string;
    legend: string;
  };
  client: string;
  title: string;
  author?: string;
  /** ISO date (yyyy-mm-dd); defaults to today. */
  date?: string;
  /** Legend line (e.g. the configured aspect labels), drawn as an extra row. */
  legend?: string;
}

export interface ExportDiagramPngOptions {
  /** Element containing the rendered React Flow canvas. */
  container: HTMLElement;
  /** Flow-coordinate region to capture; defaults to the measured node bounds. */
  bounds?: Rect;
  /** Drawn bottom-right on the exported image only — never on the canvas. */
  titleBlock?: ExportTitleBlock;
  /**
   * Image pixels per CSS pixel of the board. Left out, the export picks one:
   * enough that type survives a large-format print, and never more than a
   * canvas will hold (`exportPixelRatio`). Passing one overrides that choice,
   * and is still held to what the canvas can take.
   */
  pixelRatio?: number;
  /** Padding around the captured bounds, in flow pixels. Default 48. */
  padding?: number;
  /** Default '#ffffff' so exports drop cleanly onto documents. */
  background?: string;
  /**
   * Called when one or more logo marks could not be embedded in the bitmap, with
   * their labels. The export still succeeds — those elements fall back to their
   * kind glyph — but the host should say so, because a PNG that quietly lost its
   * marks looks finished and is not.
   */
  onImagesMissing?(labels: string[]): void;
}
