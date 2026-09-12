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
 * with other tools rather than branding. They do not get renamed — with the
 * one exception ADR-0012 §5 makes: `connections` became `relations`, because
 * the list stopped being only connections. The interchange document keeps the
 * old name — `fromInterchange.ts` owns its own shapes — and the working format
 * followed the model at version 4.
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
/**
 * What a thing IS (ADR-0012 §4) — which stopped being the same question as how
 * it is drawn.
 *
 * Six words, four of them the business layer's. Three kinds left: an
 * `externalSystem` was an `application` somebody else owns (`outside`), and an
 * `inputChannel` and a `managementTool` were an `application` in a band of the
 * board (`DiagramMember.zone`). Each was a drawing decision or a category
 * wearing a kind's clothes, and each had a second meaning it could not carry —
 * the same portal is a channel on one board and a system on another, and
 * "external" meant both *outside this organisation* and *not the subject of
 * this board*. What they drew as is {@link ./kinds.NodeFigure}, derived.
 *
 * `actor`, `step`, `function` and `process` are trees: `parentId` and `order`
 * make the depth, and depth is what the sheet draws from — an area, a
 * grouping, a capability; a journey, a phase, a step. The model does not know
 * those words.
 */
export type ElementKind =
  /** A party, stakeholder, role, team, or a group of them. */
  | 'actor'
  /** A journey, its phases and its steps. Ordered: a journey reads left to right. */
  | 'step'
  /** A responsibility area, a grouping, a capability. */
  | 'function'
  /** A business process; its page holds the ```bpmn fence. */
  | 'process'
  | 'application'
  /** A container inside an application (C4). */
  | 'component';
export type Layer7Zone =
  | 'actors'
  | 'inputChannels'
  | 'externalSystems'
  | 'landscape'
  | 'management';
/** Element lifecycle stage — closed set, defaults to 'live' (see model-mapping). */
export type Lifecycle = 'planned' | 'live' | 'retiring' | 'retired';
/**
 * When each phase begins. Declared here rather than imported, because this file
 * imports nothing at all — it is the bottom of the model and stays there.
 * `lifecycle.ts` re-exports the same shape and owns the arithmetic over it.
 */
export type LifecycleDates = Partial<Record<'live' | 'retiring' | 'retired', string>>;
/** The key this element has in the file — see `keys.ts` for where it comes from. */
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
  /**
   * The one thing this sits inside (ADR-0012 §3).
   *
   * It was `parentApplicationId` while a component inside an application was
   * the only containment there was. The business layer needs the same field to
   * say a function's area, a step's phase and an actor's group of actors, and
   * one parent is what a tree wants — so the field lost the word that named
   * only one of its uses. Format 3 still writes the old spelling
   * (`projects/folderFormat.ts`), and stops at format 4.
   */
  parentId?: ElementId;
  /**
   * Where this sits among its siblings, low first (ADR-0012 §3).
   *
   * Only where order is a DECISION — a journey reads left to right, and the
   * phases of one are not alphabetical. Absent everywhere else, because a list
   * that carries an order nobody chose is a list two people renumber for
   * nothing. Ties fall back to the order the list already has.
   */
  order?: number;
  /**
   * A `step` only: the actor whose own path this step is (ADR-0012 §4).
   *
   * One journey is rarely one path — a key account runs differently from a
   * customer who orders directly — so the sheet draws a row per lane under the
   * same phases. Absent means the common row, which is the one every lane
   * shares. Everything else about a lane is derived from where it has steps;
   * see `business/lanes.ts`.
   */
  lane?: ElementId;
  name: string;
  category?: string;
  vendor?: string;
  technology?: string;
  description?: string;
  /**
   * Nobody in this organisation owns it (ADR-0012 §3).
   *
   * A fact about the world, and one of the three separate things "external"
   * used to mean at once. `true` or absent — never `false`, so nothing has to
   * write down that a thing is ours.
   */
  outside?: true;
  /** Which {@link ElementKind} `actor` it belongs to, when that has been said. */
  partyId?: ElementId;
  /**
   * A `function` only: which domains the organisation has assigned it to
   * (ADR-0012 §3) — the *top-down* half of who owns a capability.
   *
   * A path per domain, as a plain string until scopes are a type of their own.
   * The other half is *claimed* — a domain holding a stand-in of it — which is
   * derived from the tree and arrives with scopes; until then this is the only
   * half there is, and a function with none is what the sheet's *not yet
   * mapped* band is made of (§9).
   */
  scopes?: string[];
  /**
   * Which phase it is in, and — with {@link DesignElement.lifecycleDates} — when
   * (ADR-0009). Meaningful on a function and an actor as well as an application
   * since ADR-0012 §8: a capability can be being built, and a partner can be
   * being onboarded.
   */
  lifecycle: Lifecycle;
  /**
   * When each phase begins, `yyyy-mm-dd` (ADR-0009). Absent throughout — which
   * is the default and stays the default — means this element answers the same
   * phase on every day, exactly as it did before dates existed. See
   * {@link ./lifecycle}.
   */
  lifecycleDates?: LifecycleDates;
  /** What replaces this when it retires. Feeds the roadmap's checks. */
  successorId?: ElementId;
  /**
   * Who answers for this application.
   *
   * A field rather than a row in the documentation template, for the reason
   * that template's own comment gives: a question with two places to answer it
   * has two answers. The row left the template when this arrived.
   */
  owner?: string;
  isManaged: boolean;
  /** Keyed by aspect key (superset or custom slug). */
  aspects: Record<string, AspectEntry>;
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

/** Line dash style for a relation; absent = solid. */
export type EdgeLineStyle = 'solid' | 'dashed' | 'dotted';
/** Path shape for a relation; absent = smooth (today's smooth-step default). */
export type EdgeRouting = 'smooth' | 'orthogonal' | 'straight' | 'curved';
/** Per-end arrowhead; absent = derive from `isBidirectional`. */
export type EdgeArrowhead = 'none' | 'arrow';

/**
 * What one row joining two elements MEANS (ADR-0012 §5).
 *
 * A closed set, and deliberately a short one: five words carry the business
 * layer and the application layer both, where a relation per pair of kinds
 * would carry neither. `flow` is the line this tool has always drawn — an
 * interface between two applications — and every other member is a statement
 * about coverage rather than about traffic.
 */
export type RelationType = 'flow' | 'supports' | 'serves' | 'realises' | 'assigned';

/**
 * A line's own fields, with nothing said about what it means.
 *
 * The shape the interchange format calls a connection, and — because only a
 * `flow` is ever drawn on a canvas — the shape `layout/` routes. A
 * {@link Relation} is one of these with its type said out loud; the working
 * format writes the type, and the interchange, which is a contract with other
 * tools, exports the flows alone (ADR-0012 §11).
 */
export interface DesignConnection {
  id: string;
  sourceId: ElementId;
  targetId: ElementId;
  label?: string;
  /** `flow` only: what travels over the line. Ignored on any other type. */
  protocol?: string;
  /**
   * The days this line is there, `yyyy-mm-dd` and inclusive (ADR-0009, and on
   * every relation type since ADR-0012 §5).
   *
   * Absent means it follows the elements it joins, which is what keeps a
   * landscape where every line needs two dates from being a landscape nobody
   * dates. The temporary lines of a hybrid phase — a sync, a façade, a double
   * write — are what these are for, and so is "the WMS supports fulfilment
   * from March".
   */
  validFrom?: string;
  validUntil?: string;
  /**
   * `flow` only: the interface runs both ways. Absent means it does not, which
   * is why nothing has to write `false` on a relation that could not be
   * bidirectional if it wanted to be.
   */
  isBidirectional?: boolean;
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

/**
 * One row of the model's `relations` list: two ends, a type, and — on any type
 * — the days it holds (ADR-0012 §5).
 *
 * Written as an intersection rather than restated, so a field added to a line
 * is added once and `layout/`, the file format and the interchange all keep
 * agreeing with it by construction.
 */
export type Relation = DesignConnection & { type: RelationType };

/**
 * One row of a view's membership: this element is ON it, and what that means
 * from here (ADR-0012 §6).
 *
 * Present is the whole statement — an element is on a view because this row
 * says so, not because a coordinate exists for it, which is why a view whose
 * geometry file is deleted can be laid out again from a complete list.
 */
export interface DiagramMember {
  id: ElementId;
  zone?: Layer7Zone;
  /** Which dashed group it sits in, by {@link DiagramGroup.id}; absent = open landscape. */
  group?: string;
}

/** Where one node ended up. Numbers, and the id they are about. */
export interface NodeGeometry {
  id: ElementId;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/**
 * A member and its geometry, joined — what a canvas draws and a router routes
 * against, and what every caller that needs both at once asks for
 * (`model/placement.placedNodes`). Nothing stores one.
 */
export type PlacedNode = DiagramMember & Omit<NodeGeometry, 'id'>;

/** A point in flow coordinates. */
export interface Point {
  x: number;
  y: number;
}

/** A side of a node rect a line end can be told to attach to. */
export type AttachSide = 'top' | 'right' | 'bottom' | 'left';

/**
 * What a view asks of the router for one relation: which side each end
 * attaches to, whether the line is left alone, and who drew what is stored
 * (ADR-0012 §6).
 *
 * A CONSTRAINT, not geometry — which is why it lives in the definition and the
 * waypoints live in {@link Geometry.routes}. Renaming nothing, moving nothing:
 * a review can skip the geometry file and still read what a person asked for.
 */
export interface DiagramLine {
  relationId: string;
  sourceSide?: AttachSide;
  targetSide?: AttachSide;
  pinned?: boolean;
  source?: EdgeRouteSource;
}

/**
 * Per-diagram presentation overrides for one relation: manual routing points
 * (ordered), a custom label anchor and/or the side each end attaches to.
 *
 * **Nothing stores one.** It is the two halves — a {@link DiagramLine} in the
 * definition and a {@link RouteGeometry} in the geometry — joined, because
 * every caller that reads or writes a route wants both at once;
 * `model/routes.ts` owns the join and the split. In a batch upsert, an entry
 * with no waypoints, no label position, no pin AND no fixed side deletes the
 * stored row — the one definition of "has content" is `hasRouteContent`.
 */
export interface EdgeRoute {
  /**
   * The relation this row is about. Named for the list it points into
   * (`DesignModel.relations`, ADR-0012 §5) rather than for the one kind of
   * relation that can be drawn today, which is what ADR-0012 §6's
   * `Geometry.routes` calls it.
   */
  relationId: string;
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

/**
 * A dashed group on a view: an id of its own, a name and a colour (ADR-0012 §6).
 *
 * The id is what a member points at, so **renaming a group is one line** —
 * before this the name WAS the key, and changing it rewrote every placement
 * that named it as well as the rectangle. Minted from the name the first time
 * a group is made ({@link ../model/keys.claimKey}), and never rewritten after.
 *
 * A group is per diagram, so the id has only to be unique on the diagram it is
 * drawn on; it shares no namespace with elements.
 */
export interface DiagramGroup {
  id: string;
  name: string;
  /**
   * Group colour as a hex, absent-means-inherit — the same NULL-inherit contract
   * as {@link DesignElement.accentColor}. Absent draws the theme's neutral
   * domain-group tokens; set tints the dashed border, the label and a faint
   * interior wash. Presentation only: nothing reads a group's colour to decide
   * anything, so a group that loses it still groups.
   */
  color?: string;
}

/**
 * Where a dashed group's box IS: numbers, and the id of the group they are
 * about. What it is CALLED is {@link DiagramGroup}, one file over — resize it
 * and the geometry changes, rename it and the geometry does not.
 */
export interface DomainGroupRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The stored half of a route: where the line was drawn to go. */
export interface RouteGeometry {
  relationId: string;
  waypoints: Point[];
  /** Custom label anchor (flow coords); absent = automatic path midpoint. */
  labelPosition?: Point;
}

/**
 * Where a view ended up (ADR-0012 §6): numbers, and the ids they are about.
 *
 * Regenerable, deletable, and — the point of the split — meaningless on its
 * own. A diff of the definition says what changed on the drawing; a diff of
 * this says how much moved, which `model/diff.ts` reduces to a count. Nothing
 * here decides anything: what is on the view is {@link DesignDiagram.members},
 * and what the router is told to honour is {@link DesignDiagram.lines}.
 */
export interface Geometry {
  /**
   * A machine wrote this and no person has accepted it yet, so the editor lays
   * the view out once on first open (intent rule 12).
   *
   * Set by whoever WROTE the geometry — the container-diagram seed, an import —
   * and cleared by the host once the settling pass has landed. Never inferred
   * from the coordinates: a hand-built diagram and a machine-seeded one are
   * indistinguishable by shape, and the two obvious heuristics are wrong in the
   * dangerous direction. "Every node at (0,0)" fires on neither writer, since
   * both seed a real grid; "no group boxes, so it was never tidied" is also
   * true of a hand-built landscape whose author never made a domain group, and
   * would rearrange their curated board the first time they opened it.
   */
  needsLayout?: boolean;
  /**
   * Layer 7 canvas size override for larger landscapes (iteration 3). Absent =
   * the default 1680×1040 board; never smaller than the default.
   */
  canvas?: { width: number; height: number };
  zones?: Partial<Record<ResizableZone, { size: number }>>;
  nodes: NodeGeometry[];
  groups?: DomainGroupRect[];
  routes?: RouteGeometry[];
}

export interface DesignDiagram {
  id: string;
  /**
   * What kind of view this is (ADR-0012 §6).
   *
   * `layer7` and `container` are drawn on a canvas and have geometry. A
   * `sheet` is **laid out**: the business architecture on one page, computed
   * from the trees and their order, so it has no coordinates at all and
   * {@link DesignDiagram.geometry} stays empty on one. Nothing drags, nothing
   * routes, and a deleted geometry file would change nothing about it.
   */
  kind: 'layer7' | 'container' | 'sheet';
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
  /**
   * The day this diagram shows (ADR-0009).
   *
   * Absent means today, and moves with the calendar. A date means the same
   * single model as it stood then: elements drawn in the phase they were in,
   * and the temporary lines of a hybrid phase present or gone according to
   * their own windows. It is not in {@link DiagramSettings} on purpose — a
   * date control on the bar changes it, and one mechanism cannot disagree
   * with itself.
   */
  asOf?: string;
  /** Whether the exported PNG carries a title block at all. Absent = it does. */
  showTitleBlock?: boolean;
  applicationElementId?: ElementId;
  /**
   * A sheet: the journey drawn across the top — the `step` at the root of the
   * tree whose phases become the header row (ADR-0012 §6). Absent draws no
   * journey band at all, which is what a sheet about areas alone is.
   */
  journeyId?: ElementId;
  /**
   * A sheet: which actors get a lane of their own under the phases, and in
   * which order (ADR-0012 §4). The common path is always the first row and is
   * never named here; a lane a step names and this list does not still gets a
   * row, after the named ones, because a step that names a lane is a fact.
   */
  lanes?: ElementId[];
  /**
   * A sheet: which function roots are drawn as areas, and in which order.
   * Absent draws every root the scope holds, in the model's own order — a
   * sheet nobody has curated shows everything rather than nothing.
   */
  areas?: ElementId[];
  /** A sheet: whether the stakeholder rail is drawn. Absent = it is. */
  showActors?: boolean;
  /**
   * What is ON this view (ADR-0012 §6), and what that means from here: which
   * band an element sits in, and which dashed group it belongs to.
   */
  members: DiagramMember[];
  /**
   * The dashed groups this view draws, by id (ADR-0012 §6). What they are
   * called and what colour they are; where their boxes sit is geometry, in
   * {@link Geometry.groups}.
   */
  groups?: DiagramGroup[];
  /**
   * What the router is told to honour, per relation: fixed sides, a pin, and
   * whose the stored route is. Absent = every line is the router's.
   */
  lines?: DiagramLine[];
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
  /**
   * Live auto-routing for this diagram: while on, any geometry or topology change
   * re-routes the whole board. Absent = off, which is the default.
   *
   * Persisted per diagram rather than held in editor state, because it changes
   * behaviour every time the diagram is opened — a session-only flag would
   * silently forget it. Applies to container diagrams as well as layer7.
   */
  autoRoute?: boolean;
  /** Where it all ended up. A separate file, and a separate question (§6). */
  geometry: Geometry;
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
  /**
   * What this scope's document is called — and, since ADR-0012 §1, what the
   * scope is called: one name per scope, written into its `scope.json`.
   *
   * The organisation's name used to ride here too, as `customerName`, on every
   * project in a group; it is the root scope's `name` now, and
   * `projects/scopeLabel.ts` is what walks up the tree for it.
   */
  name: string;
  diagrams: DesignDiagram[];
  elements: DesignElement[];
  /**
   * Every row that joins two elements, of whatever type (ADR-0012 §5). The
   * file still calls the flows among them `connections`, and does so until
   * format 4 — `projects/folderFormat.ts` is where the two names meet.
   */
  relations: Relation[];
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
 * A picture a document holds (ADR-0009).
 *
 * Addressed by its file name and nothing else — `images/<file>` in the project
 * folder, `![](../images/<file>)` in the markdown — so the reference means the
 * same thing to this app and to every other markdown reader. See
 * {@link ./documentImage}.
 */
export interface DocumentImage {
  /** The name inside `images/`, extension included. Unique in a project. */
  file: string;
  /** The bytes, as a data URL. The app never fetches one over the network. */
  url: string;
}

/** Axis-aligned rectangle in flow coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

