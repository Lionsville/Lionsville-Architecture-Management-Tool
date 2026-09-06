/**
 * What a landscape is made of.
 *
 * The domain half of what used to be one 720-line contract file shared by a
 * package and its host. The other half — the editor's props, its export
 * options, the decorations a caller could hand it — was never the model and is
 * in `editor/props.ts`; the markdown render options are in `documentation/`,
 * and `WindowChrome` had a twin in `platform/windowChrome.ts` that survived.
 *
 * What is left imports nothing, which is the point: every module may read these
 * types, and none of them drags React in by doing so.
 *
 * The field names here are also the interchange format's, which is a contract
 * with other tools rather than branding. They do not get renamed.
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

/** Axis-aligned rectangle in flow coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

