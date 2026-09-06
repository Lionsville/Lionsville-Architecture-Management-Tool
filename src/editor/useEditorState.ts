import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DesignConnection, DesignDiagram, DesignElement, DesignModel, DiagramLayoutConfig, DiagramPlacement, DomainGroupRect, EdgeRoute, EdgeRouteSource, ElementId, ElementKind, Layer7Zone, NodeIconSize, NodeShapeVariant, Point, Rect, ResizableZone } from '../model/types';
import type { SolutionDesignEditorProps } from './props';
import { DEFAULT_TRANSLATE, translator, type StringKey, type Translate } from '../i18n/strings';
import type { TidyResult } from '../layout/tidy';
import { remapClipboard, type ClipboardPayload } from '../model/clipboard';
import { idPolicy, idsIn } from '../model/keys';
import type { IdPolicy } from '../model/keys';
import { transaction } from '../model/commands';
import type { Command } from '../model/commands';
import {
  clampPlacementIntoZone,
  defaultContainerPosition,
  defaultZonePosition,
  placementRect,
} from '../model/placement';
import { edgeRoutesEqual } from '../model/equality';
import {
  followNodeMove,
  hasFixedSide,
  hasPlacedContent,
  hasRouteContent,
  isAutoRoute,
  routeFor,
  routeSides,
  routeWithSides,
  type AttachSidesPatch,
  type RouteSides,
} from '../model/routes';
import { clampCanvasSize, clampZoneSize, HOME_ZONE, RESIZABLE_ZONES } from '../model/zones';
import { canChangeKind, placementForKind } from '../model/kindChange';

/**
 * A set of selected canvas items. Elements, connections and domain groups live
 * in separate id spaces, so they're kept as three arrays rather than one
 * kind-tagged list (domain groups are keyed by NAME — they are layout rects in
 * `layoutConfig`, not model rows). Empty selection is `EMPTY_SELECTION` (never
 * `undefined`) — one less nullable to thread. Arrays (not Sets) keep
 * referential comparison cheap for memo deps; `graph.ts` derives Sets locally
 * for O(1) membership.
 */
export interface Selection {
  elementIds: ElementId[];
  connectionIds: string[];
  /** Domain-group names (layer7 only); selected exactly like a node. */
  domainGroups: string[];
}

export const EMPTY_SELECTION: Selection = {
  elementIds: [],
  connectionIds: [],
  domainGroups: [],
};

export function selectionCount(selection: Selection): number {
  return (
    selection.elementIds.length + selection.connectionIds.length + selection.domainGroups.length
  );
}

export function isSelectionEmpty(selection: Selection): boolean {
  return selectionCount(selection) === 0;
}

function sameMembers(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((id) => set.has(id));
}

/**
 * Order-independent set equality. React Flow re-fires `onSelectionChange` with
 * the *same* selection on many renders (including empty); mirroring each fire
 * into fresh state would feed a re-render → re-fire loop ("Maximum update depth
 * exceeded"). The canvas guards its emit with this.
 */
export function selectionEquals(a: Selection, b: Selection): boolean {
  return (
    sameMembers(a.elementIds, b.elementIds) &&
    sameMembers(a.connectionIds, b.connectionIds) &&
    sameMembers(a.domainGroups, b.domainGroups)
  );
}

/** Selection holding exactly one element (programmatic select: add, focus). */
export function selectElement(id: ElementId): Selection {
  return { elementIds: [id], connectionIds: [], domainGroups: [] };
}

/** Selection holding exactly one connection. */
export function selectConnection(id: string): Selection {
  return { elementIds: [], connectionIds: [id], domainGroups: [] };
}

/** Selection holding exactly one domain group (click a group box or its label). */
export function selectDomainGroup(name: string): Selection {
  return { elementIds: [], connectionIds: [], domainGroups: [name] };
}

/**
 * Select-all covers the diagram's CONTENT — elements and the connections
 * between them. Domain groups are deliberately left out: they are layout, and
 * sweeping them in would make Mod+A → Delete quietly dismantle the board's
 * structure as well as its contents. Shared by the keymap and the pane menu.
 */
export function selectAllContent(
  model: Pick<DesignModel, 'connections'>,
  diagram: Pick<DesignDiagram, 'placements'>,
): Selection {
  const elementIds = diagram.placements.map((p) => p.elementId);
  const placed = new Set(elementIds);
  const connectionIds = model.connections
    .filter((c) => placed.has(c.sourceId) && placed.has(c.targetId))
    .map((c) => c.id);
  return { elementIds, connectionIds, domainGroups: [] };
}

/**
 * Fold React Flow's own selection (nodes + edges) into ours. RF knows nothing
 * about domain groups, so picking a node or an edge clears them — but an EMPTY
 * fire must PRESERVE them: RF resets its selection right after every pane click,
 * and treating that as "deselect everything" would wipe the group the click had
 * just selected, one tick later.
 */
export function mirrorGraphSelection(
  current: Selection,
  nodeIds: ElementId[],
  edgeIds: string[],
): Selection {
  const picked = nodeIds.length > 0 || edgeIds.length > 0;
  return {
    elementIds: nodeIds,
    connectionIds: edgeIds,
    domainGroups: picked ? [] : current.domainGroups,
  };
}

export interface ElementSeed {
  kind: ElementKind;
  position?: { x: number; y: number };
  zone?: Layer7Zone;
  domainGroup?: string;
  // Optional pre-seed style (U7c/D10 quick-style-from-palette). Absent = inherit,
  // exactly as before. These are the SAME fields the inspector Appearance tab
  // edits — one source of truth, no new columns, no migration.
  accentColor?: string;
  iconKey?: string;
  /** Header mark or body mark; absent = header, the size every node drew before. */
  iconSize?: NodeIconSize;
  shapeVariant?: NodeShapeVariant;
  /**
   * Optional name from the palette tray. Blank or absent falls through to
   * `DEFAULT_NAMES`, so every path that never supplied one is unchanged.
   */
  name?: string;
}

/**
 * What a palette gesture can pre-seed on a new element. `accentColor` and
 * `shapeVariant` are still accepted because a drag payload from a tab opened
 * before the palette recut may carry them; the palette itself now sends only
 * `iconKey` and `name`, and the inspector Appearance tab owns the rest.
 */
export type ElementSeedPatch = Pick<
  ElementSeed,
  'accentColor' | 'iconKey' | 'iconSize' | 'shapeVariant' | 'name'
>;

export interface PlacementMove {
  elementId: ElementId;
  x: number;
  y: number;
  zone?: Layer7Zone;
  domainGroup?: string;
}

export interface EditorActions {
  addElement(seed: ElementSeed): void;
  updateElement(id: ElementId, patch: Partial<Omit<DesignElement, 'id' | 'kind'>>): void;
  /**
   * The same patch onto several elements in ONE step — the selection menu's
   * Lifecycle. One undo step for one gesture, exactly like a multi-node drag.
   */
  updateElements(ids: readonly ElementId[], patch: Partial<Omit<DesignElement, 'id' | 'kind'>>): void;
  /**
   * Change WHAT an element is, after it exists — the one edit `updateElement`
   * deliberately cannot make, since every other patch keeps `kind` fixed.
   *
   * It is its own action rather than a wider patch type because it is not a
   * field write: the rules live in `model/kindChange.ts` (an application with a
   * container diagram and a parented component are refused), and the placement
   * has to follow the new kind — its home band and its size limits both change.
   * Both land in ONE step, so it is one undo step. A refused change changes
   * nothing.
   */
  changeElementKind(id: ElementId, kind: ElementKind): void;
  movePlacements(moves: PlacementMove[]): void;
  setPlacements(placements: DiagramPlacement[]): void;
  /**
   * Commit a Tidy run in ONE step: element positions plus, for layer7, the
   * re-sized landscape domain-group rects. Rects are merged into
   * `layoutConfig.domainGroups` BY NAME — create-or-resize: an existing rect is
   * resized in place, a tidy rect with a new name is appended (Tidy emits one
   * per group with members) — and rects Tidy didn't touch (e.g. member-less
   * groups) are preserved.
   */
  applyTidyResult(result: TidyResult, amend?: CommitToken): CommitToken;
  setDomainGroup(elementId: ElementId, domainGroup: string | undefined): void;
  /**
   * The same, for a whole selection, in ONE step — so bulk-assigning a domain
   * group is one undo step rather than one per element. Elements with no
   * placement on the active diagram are skipped.
   */
  setDomainGroups(elementIds: readonly ElementId[], domainGroup: string | undefined): void;
  /**
   * Draw a new connection. With `sides` (an Alt-connect from or to a specific
   * side handle) the attach sides land in the SAME step as the line, as a
   * bend-less `auto` route row, so one undo removes both. Returns the new
   * connection's id; `undefined` for a refused self-connection.
   */
  connect(sourceId: ElementId, targetId: ElementId, sides?: RouteSides): string | undefined;
  /**
   * Repoint an existing connection — a reconnect drag — optionally fixing the
   * end(s) the user dragged to a specific side handle with Alt held, in ONE
   * geometry step: a reconnect changes topology, so the live pass follows.
   */
  reconnect(id: string, endpoints: { sourceId: ElementId; targetId: ElementId }, sides?: RouteSides): void;
  /**
   * Paste a clipboard snapshot onto the active diagram: mints the keys the
   * copies will have in the file, remaps references (parent, endpoints),
   * offsets placements, then selects the pasted set.
   */
  pasteClipboard(payload: ClipboardPayload, offset: Point): void;
  updateConnection(id: string, patch: Partial<Omit<DesignConnection, 'id'>>): void;
  deleteConnection(id: string): void;
  /**
   * Delete a whole selection (elements + connections + domain groups) in ONE
   * step — the destructive half of Mod+X cut. Element deletes cascade to their
   * connections and placements; the explicit connection ids are removed too,
   * and selected domain groups lose their rect (members survive, they just
   * stop belonging to a group).
   */
  deleteSelection(selection: Selection): void;
  removeFromDiagram(elementId: ElementId): void;
  deleteFromModel(elementId: ElementId): void;
  /**
   * Replace a connection's waypoints on the active diagram (label anchor and pin
   * kept). A hand edit, so the route becomes `manual`. Clearing the last bend of
   * a route that has no label anchor and no pin forgets the row instead, which
   * hands the line back to the router — "remove all bend points" must not leave
   * behind an empty row that every automatic pass then steps around.
   */
  setEdgeRoute(connectionId: string, waypoints: Point[]): void;
  /** Move (or reset, with undefined) a connection's label anchor on the active diagram. */
  setEdgeLabelPosition(connectionId: string, position: Point | undefined): void;
  /**
   * Pin (`manual`) or unpin (`auto`) a connection's route without touching its
   * geometry — one step, one undo step. Pinning a line that has no stored row
   * writes a bend-less row carrying `pinned: true`, so the fact survives; unpinning
   * such a row forgets it. Nothing is re-routed here: Unpin only hands the line
   * to the next automatic pass, and `resetEdgeRoute` is the action that asks for one.
   */
  setRouteSource(connectionId: string, source: EdgeRouteSource): void;
  /**
   * Forget everything stored for a connection's route on the active diagram —
   * bends, label anchor, pin, provenance, attach sides — so the router gets it
   * back. With live auto-routing on this is a GEOMETRY change, so the live pass
   * follows and folds its routes into the same undo step through the returned
   * token; with it off, the caller runs the routing pass itself and passes the
   * token to `applyTidyResult`, to the same effect: one undo puts the old route back.
   */
  resetEdgeRoute(connectionId: string): CommitToken;
  /**
   * Tell one or both ends of a connection's route which side of its node to
   * attach to on the active diagram (`EdgeRoute.sourceSide`); a key present with
   * `undefined` puts that end back to Automatic. Merged into the stored row —
   * bends, label, pin and provenance untouched — or, with nothing stored, written
   * as a fresh bend-less `auto` row: sides are constraints, not geometry, so a row
   * that exists only for them stays the router's and the next pass honours them.
   *
   * The same two roads as `resetEdgeRoute` bring the line back routed: a geometry
   * change with live routing on, a plain one plus a caller-run pass with it
   * off, one undo step either way. Returns `undefined` when nothing changed, so
   * the caller runs no pass for a no-op.
   */
  setRouteSides(connectionId: string, sides: AttachSidesPatch): CommitToken | undefined;
  /** Resize one zone band (persists via layoutConfig). */
  setZoneSize(zone: ResizableZone, size: number): void;
  /** Grow/shrink the Layer 7 board (persists via layoutConfig, clamped). */
  setCanvasSize(size: { width: number; height: number }): void;
  /** Commit a card resize (NodeResizer end): position + explicit size on the placement. */
  resizePlacement(elementId: ElementId, rect: { x: number; y: number; width: number; height: number }): void;
  /**
   * Create or update a domain-group rectangle. With `memberIds`, those
   * placements join the group in the same step — how "Group into new domain
   * group" makes one undo step out of a box and its membership.
   */
  upsertDomainGroup(rect: DomainGroupRect, memberIds?: readonly ElementId[]): void;
  /**
   * Rigid-move a domain group: translate its box rect AND every member
   * placement by (dx, dy) in ONE step (one undo step). Membership is
   * preserved — no `domainGroup` value changes.
   */
  moveDomainGroup(name: string, dx: number, dy: number): void;
  /** Rename a group; member placements follow. */
  renameDomainGroup(oldName: string, newName: string): void;
  /** Remove a group rect; member placements lose their domainGroup. */
  removeDomainGroup(name: string): void;
  /**
   * Turn live auto-routing on or off for the active diagram.
   *
   * Deliberately NOT undoable. It is a mode, like snap-to-grid, and folding it
   * into the undo stack would mean Cmd+Z after a node move could silently switch
   * routing off — a mode the user chose disappearing as a side effect of undoing
   * something else. It persists (the flag is a column), it just does not travel
   * with content history.
   */
  setAutoRoute(on: boolean): void;
}

export interface EditorState {
  /** The document, as the host holds it. There is no second copy (ADR-0002). */
  model: DesignModel;
  selection: Selection;
  setSelection(selection: Selection): void;
  selectedElement?: DesignElement;
  selectedConnection?: DesignConnection;
  /** Name of the sole selected domain group (layer7), if that's the selection. */
  selectedDomainGroup?: string;
  actions: EditorActions;
  /**
   * Bumped by every change that moved geometry or changed topology. Live routing
   * debounces a whole-board reroute on it.
   */
  geometryVersion: number;
  /**
   * The step the last change made — the token a caller passes back to
   * `applyTidyResult` to fold a follow-up into the step it already made.
   * Read it BEFORE an async pass; anything that changes the model meanwhile
   * makes it stale, which is exactly what should invalidate the fold.
   */
  commitToken: CommitToken;
  /** The host's undo stack (ADR-0002); the toolbar buttons and ⌘Z call these. */
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * The name a new element gets when the palette's field was left blank.
 *
 * A function of the language rather than a constant, because this string does
 * not stay in the UI: it is written into the model, drawn on the card, and
 * carried into the interchange document and the PNG export. An editor set to
 * Dutch that quietly creates elements called "New application" is not a
 * translation gap, it is wrong data.
 *
 * `DEFAULT_TRANSLATE` (English) is the default so every pure caller and every
 * test that never passes a language keeps the exact words it had.
 */
export const DEFAULT_NAME_KEYS: Record<ElementKind, StringKey> = {
  actor: 'newName.actor',
  application: 'newName.application',
  externalSystem: 'newName.externalSystem',
  inputChannel: 'newName.inputChannel',
  managementTool: 'newName.managementTool',
  component: 'newName.component',
};

export function defaultElementName(
  kind: ElementKind,
  translate: Translate = DEFAULT_TRANSLATE,
): string {
  return translate(DEFAULT_NAME_KEYS[kind]);
}

/** The whole table at once — the palette shows it as placeholder text. */
export function defaultElementNames(
  translate: Translate = DEFAULT_TRANSLATE,
): Record<ElementKind, string> {
  return {
    actor: defaultElementName('actor', translate),
    application: defaultElementName('application', translate),
    externalSystem: defaultElementName('externalSystem', translate),
    inputChannel: defaultElementName('inputChannel', translate),
    managementTool: defaultElementName('managementTool', translate),
    component: defaultElementName('component', translate),
  };
}

/**
 * UX defaults only (the DB default is `true` across the board): elements we
 * operate default to managed; actors, external systems and input channels are
 * outside Lionsville's operational scope by definition, so they start
 * unmanaged and never produce false "unlinked" coverage warnings.
 */
const DEFAULT_MANAGED: Record<ElementKind, boolean> = {
  actor: false,
  application: true,
  externalSystem: false,
  inputChannel: false,
  managementTool: true,
  component: true,
};

/**
 * What a change hands back so a follow-up can be folded INTO it rather than
 * pushed after it — see `dispatch`'s amend mode.
 *
 * It names one step of the host's undo stack, and the naming is load-bearing:
 * the token a change returns is the `coalesce` key it dispatched under, so the
 * host folds a follow-up carrying it into that step and nothing else. Anything
 * that lands in between takes the top of the stack with it, which makes the
 * token stale — exactly when it should be.
 */
export type CommitToken = string;

/**
 * The editing session, as the canvas and its panels see it.
 *
 * There is no model here. Every action builds a command and dispatches it at
 * the host, which applies it through the one reducer and hands the result
 * straight back (ADR-0002); what is left in this hook is the selection, the
 * geometry counter live routing debounces on, and the arithmetic that turns a
 * gesture into a command.
 *
 * The model is read through a ref rather than off the props, because a gesture
 * that makes two changes has to see the first before React has rendered it. The
 * ref runs ahead of the prop for exactly as long as that takes, and the two are
 * the same object again by the next render.
 */
export function useEditorState(props: SolutionDesignEditorProps): EditorState {
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);

  const propsRef = useRef(props);
  propsRef.current = props;

  const modelRef = useRef(props.model);
  const seenRef = useRef(props.model);
  if (seenRef.current !== props.model) {
    seenRef.current = props.model;
    modelRef.current = props.model;
  }

  /**
   * Bumped by every change that moves geometry or changes topology. Live routing
   * debounces on it.
   *
   * Deliberately NOT bumped by `applyTidyResult`: a tidy routes as its own final
   * step, so re-routing after it would fight the `'clear'` policy it just ran
   * under. That exclusion is also what keeps an auto-layout from triggering a
   * second pass — an auto-layout IS an `applyTidyResult`.
   *
   * Nor by undo or redo, and that is a change from the days of two stacks. A
   * step now carries the routes that were folded into it, so putting the step
   * back puts the routes back with it; a reroute here would recompute what was
   * just restored, and land it outside the step it belongs to.
   */
  const [geometryVersion, setGeometryVersion] = useState(0);
  const bumpGeometry = useCallback(() => setGeometryVersion((v) => v + 1), []);

  /**
   * The host's policy when it has one, otherwise one over the model as this
   * editor sees it. Either answers the same thing — a change lands before the
   * next id is asked for — but a host's policy also remembers across a remount.
   */
  const ownIds = useRef<IdPolicy | null>(null);
  ownIds.current ??= idPolicy(() => idsIn(modelRef.current));
  const ids = props.ids ?? ownIds.current;

  // The step the last change made, and the counter that names the next one.
  // Refs, because a change happens in an event handler and returns its token
  // synchronously, long before React re-renders.
  const tokenRef = useRef<CommitToken>('');
  const stepsRef = useRef(0);

  /**
   * Send one change to the host, and answer with the step it landed in.
   *
   * `amend` is the live-routing case: fold this change into the step the caller
   * already made rather than pushing a second one. A node drag lands on
   * drag-stop and its routes arrive milliseconds later; two undo entries for one
   * gesture would mean Cmd+Z put the routes back where they were and left the
   * node where it is. A stale token falls back to a step of its own, which is
   * correct rather than clever: the routes get their own undo entry instead of
   * being folded into the wrong one.
   */
  const dispatch = useCallback(
    (command: Command, options?: { amend?: CommitToken; geometry?: boolean }): CommitToken => {
      if (propsRef.current.readOnly) return tokenRef.current;
      const amending = options?.amend !== undefined && options.amend === tokenRef.current;
      const coalesce = command.coalesce
        ?? (amending ? tokenRef.current : `step-${(stepsRef.current += 1)}`);
      const before = modelRef.current;
      const next = propsRef.current.dispatch({ ...command, coalesce });
      // Refused, or a change that changed nothing: no step was made, so the
      // token still names whatever was on top before.
      if (next === undefined || next === before) return tokenRef.current;
      modelRef.current = next;
      tokenRef.current = coalesce;
      if (options?.geometry) bumpGeometry();
      return coalesce;
    },
    [bumpGeometry],
  );

  const model = props.model;

  const actions = useMemo<EditorActions>(() => {
    /**
     * Which actions ask for a geometry bump IS the specification of when live
     * routing re-runs, so it is worth reading as one: every placement move,
     * resize, group move or group rect change; every connect, delete or paste;
     * every add or removal from the diagram. Not style edits, not renames, not
     * zone/canvas resizes — those change nothing the router measures.
     *
     * `applyTidyResult` is the deliberate omission (see `geometryVersion`).
     */
    const geometry = (command: Command, amend?: CommitToken): CommitToken =>
      dispatch(command, { geometry: true, amend });
    const diagramId = () => propsRef.current.activeDiagramId;
    const currentModel = () => modelRef.current;
    const currentDiagram = () => currentModel().diagrams.find((d) => d.id === diagramId());

    return {
      addElement(seed) {
        const diagram = currentDiagram();
        if (!diagram) return;
        // The name first, because the id is derived from it: an element gets the
        // key the file would have given it, at the moment it is drawn.
        const name =
          seed.name?.trim() ||
          defaultElementName(seed.kind, translator(propsRef.current.language ?? 'en'));
        const id = ids.element(name);
        const element: DesignElement = {
          id,
          kind: seed.kind,
          name,
          lifecycle: 'live',
          isManaged: DEFAULT_MANAGED[seed.kind],
          aspects: {},
          parameters: {},
          parentApplicationId:
            seed.kind === 'component' && diagram.kind === 'container'
              ? diagram.applicationElementId
              : undefined,
          // Pre-seed style (U7c/D10) — undefined when the palette tray was empty,
          // identical to the pre-D10 default (inherit). Fully editable afterwards
          // in the inspector Appearance tab (one source of truth).
          accentColor: seed.accentColor,
          iconKey: seed.iconKey,
          iconSize: seed.iconSize,
          shapeVariant: seed.shapeVariant,
        };
        const placement = seedPlacement(seed, diagram, id);
        geometry(transaction([
          { type: 'element.create', element },
          { type: 'placement.set', diagramId: diagram.id, placements: [placement] },
        ]));
        setSelection(selectElement(id));
      },

      updateElement(id, patch) {
        if (!currentModel().elements.some((e) => e.id === id)) return;
        dispatch({ type: 'element.update', id, patch });
      },

      updateElements(ids, patch) {
        const held = new Set(currentModel().elements.map((e) => e.id));
        const targets = ids.filter((id) => held.has(id));
        if (targets.length === 0) return;
        dispatch(transaction(
          targets.map((id) => ({ type: 'element.update' as const, id, patch })),
        ));
      },

      changeElementKind(id, kind) {
        const diagram = currentDiagram();
        if (!diagram) return;
        const model = currentModel();
        if (!canChangeKind(model, diagram, id, kind).ok) return;
        const element = model.elements.find((e) => e.id === id);
        const placement = diagram.placements.find((p) => p.elementId === id);
        if (!element || !placement) return;
        const next = placementForKind(placement, kind, diagram);
        dispatch(transaction([
          { type: 'element.update', id, patch: { kind } },
          { type: 'placement.set', diagramId: diagram.id, placements: [next] },
        ]));
      },

      movePlacements(moves) {
        const diagram = currentDiagram();
        if (!diagram || moves.length === 0) return;
        const model = currentModel();
        const elementsById = new Map(model.elements.map((e) => [e.id, e]));
        // Rects before and after, for the hand-drawn routes that hang off a moved
        // node (below). Size never changes in a move, so both come from the kind.
        const rects = new Map<ElementId, { before: Rect; after: Rect }>();
        const placements: DiagramPlacement[] = [];
        for (const move of moves) {
          const placement = diagram.placements.find((p) => p.elementId === move.elementId);
          if (!placement) continue;
          const element = elementsById.get(move.elementId);
          if (element) {
            rects.set(move.elementId, {
              before: placementRect(element.kind, placement),
              after: placementRect(element.kind, { ...placement, x: move.x, y: move.y }),
            });
          }
          placements.push({
            ...placement,
            x: move.x,
            y: move.y,
            zone: diagram.kind === 'layer7' ? move.zone : placement.zone,
            domainGroup: diagram.kind === 'layer7' ? move.domainGroup : placement.domainGroup,
          });
        }
        // Hand-drawn routes follow their nodes (Phase 2e): the bend next to a
        // moved node slides along its end leg's axis by the node's delta, in the
        // SAME step as the move, so one undo takes both back. Auto routes are
        // left alone — live routing recomputes them, and without live routing
        // they were never the user's geometry to keep attached.
        const followed: EdgeRoute[] = [];
        for (const route of diagram.edgeRoutes ?? []) {
          if (isAutoRoute(route)) continue;
          const connection = model.connections.find((c) => c.id === route.connectionId);
          if (!connection) continue;
          let next = route;
          const source = rects.get(connection.sourceId);
          if (source) next = followNodeMove(next, source.before, source.after, true);
          const target = rects.get(connection.targetId);
          if (target) next = followNodeMove(next, target.before, target.after, false);
          if (next !== route) followed.push(next);
        }
        if (placements.length === 0 && followed.length === 0) return;
        geometry(transaction([
          ...(placements.length ? [{ type: 'placement.set' as const, diagramId: diagram.id, placements }] : []),
          ...routeCommands(diagram.id, followed),
        ]));
      },

      setPlacements(placements) {
        const diagram = currentDiagram();
        if (!diagram) return;
        geometry({ type: 'placement.set', diagramId: diagram.id, placements });
      },

      applyTidyResult(
        { placements, domainGroups, canvas, edgeRoutes, partial, routingError },
        amend,
      ) {
        const diagram = currentDiagram();
        if (!diagram) return tokenRef.current;
        const commands: Command[] = [];
        if (placements.length > 0) {
          commands.push({ type: 'placement.set', diagramId: diagram.id, placements });
        }
        // Layer7 only: write the group rects AND the grown canvas in ONE
        // layoutConfig object so they land in a single undo step. Group rects
        // merge by name — create-OR-resize: a tidy rect whose name already
        // exists resizes that rect in place; a tidy rect with a new name is
        // appended (Tidy emits a rect for every group with members). Rects Tidy
        // did NOT produce (member-less / other groups) are preserved untouched.
        // The canvas is written even when there are no domainGroups, so a
        // landscape with only loose apps still resizes/shrinks the board.
        if (diagram.kind === 'layer7') {
          const current = diagram.layoutConfig ?? {};
          let nextConfig = current;
          if (domainGroups && domainGroups.length > 0) {
            const tidyByName = new Map(domainGroups.map((g) => [g.name, g]));
            const existing = current.domainGroups ?? [];
            const existingNames = new Set(existing.map((g) => g.name));
            const groups = [
              ...existing.map((g) => tidyByName.get(g.name) ?? g),
              ...domainGroups.filter((g) => !existingNames.has(g.name)),
            ];
            nextConfig = { ...nextConfig, domainGroups: groups };
          }
          if (canvas) {
            nextConfig = { ...nextConfig, canvas };
          }
          if (nextConfig !== current) {
            commands.push({ type: 'layout.set', diagramId: diagram.id, layoutConfig: nextConfig });
          }
        }
        // U-edge-2: Tidy carries ELK's computed orthogonal edge routes, so
        // tidied edges route AROUND the relaid-out nodes instead of cutting
        // through them. For every edge ELK routed with bends, PERSIST those
        // waypoints (resetting the label anchor so the chip re-centres on the
        // new polyline). Every OTHER manual route on the diagram — an edge ELK
        // routed straight, or a cross-zone/unrouted edge ELK never touched — is
        // CLEARED back to default floating routing (U1 behaviour), since Tidy
        // reflowed the nodes under it. All folded into THIS step so the whole
        // Tidy stays one undo step.
        const rows: EdgeRoute[] = [];
        if (edgeRoutes) {
          const routeById = new Map(edgeRoutes.map((r) => [r.connectionId, r]));
          // An entry SETS content when it has waypoints, a pinned label — which
          // covers a straight (waypoint-less) cross-zone edge whose chip must
          // clear a group box — or an explicit pin re-emitted by the pass.
          // Everything else is a straight reflow to clear.
          const sets = hasRouteContent;
          // There is no second "keep the manual ones" filter here any more, and
          // its absence is the point. `pinAnchorPoints` is enforced inside the
          // routing pass, which re-emits a preserved route verbatim — so by the
          // time the result reaches this step it already carries the right
          // geometry and writing it back is a no-op. Two mechanisms for one rule
          // is how the label-only gap survived as long as it did; this step now
          // just persists whatever the pass decided.
          for (const r of edgeRoutes) {
            if (!sets(r)) continue;
            rows.push({
              connectionId: r.connectionId,
              waypoints: r.waypoints,
              // Tidy may pin a routed edge's label clear of a group box; otherwise
              // reset (undefined) so the chip re-centres on the new polyline.
              labelPosition: r.labelPosition,
              // Whatever the routing pass said. It is `auto` for geometry the
              // router computed and the STORED value for a route re-emitted
              // verbatim, so a preserved manual route stays manual through here.
              source: r.source,
              pinned: r.pinned,
              // The sides the pass routed under, carried back so the next one
              // routes under them too.
              ...routeSides(r),
            });
          }
          for (const route of diagram.edgeRoutes ?? []) {
            const r = routeById.get(route.connectionId);
            if (r && sets(r)) continue; // already set above
            // A PARTIAL result (one group) reflowed only its own members, so
            // it may only clear the routes it explicitly listed — every other
            // manual route on the board is still valid and stays.
            if (partial && !r) continue;
            rows.push(clearedRoute(route));
          }
        } else if (!partial && routingError === undefined) {
          // No routes supplied by a pass that did not FAIL to produce them —
          // a direct call. The board was reflowed, so every stored route is
          // geometry measured against positions that no longer exist and is
          // cleared back to default floating routing.
          //
          // The `routingError` guard is the load-bearing half. When the router
          // threw, `routeOrDegrade` drops the routes and keeps the placements,
          // and this branch used to clear the board's stored routes anyway —
          // contradicting what both `TidyResult.routingError` and
          // `tidy.routingFailure.test.ts` say happens. That is the worst moment
          // to discard someone's bends: we could not compute a replacement, so
          // destroying what is there trades "routes are stale" for "routes are
          // gone", and pinning them would not have saved them either, since a
          // pass that produced nothing preserved nothing.
          for (const route of diagram.edgeRoutes ?? []) rows.push(clearedRoute(route));
        }
        commands.push(...routeCommands(diagram.id, rows));
        if (commands.length === 0) return tokenRef.current;
        // `dispatch`, never `geometry`: a tidy — and an auto-layout, which is
        // one — routes as its own final step, so bumping here would queue a
        // second pass to fight the 'clear' policy it just ran under.
        return dispatch(transaction(commands), amend === undefined ? undefined : { amend });
      },

      setDomainGroup(elementId, domainGroup) {
        const diagram = currentDiagram();
        const placement = diagram?.placements.find((p) => p.elementId === elementId);
        if (!diagram || !placement) return;
        dispatch({
          type: 'placement.set',
          diagramId: diagram.id,
          placements: [{ ...placement, domainGroup }],
        });
      },

      setDomainGroups(elementIds, domainGroup) {
        const diagram = currentDiagram();
        if (!diagram) return;
        const placements = elementIds
          .map((id) => diagram.placements.find((p) => p.elementId === id))
          .filter((p): p is DiagramPlacement => Boolean(p))
          .map((p) => ({ ...p, domainGroup }));
        if (placements.length === 0) return;
        dispatch({ type: 'placement.set', diagramId: diagram.id, placements });
      },

      connect(sourceId, targetId, sides) {
        if (sourceId === targetId) return undefined;
        const model = currentModel();
        const placed = (id: string) => model.elements.some((e) => e.id === id);
        if (!placed(sourceId) || !placed(targetId)) return undefined;
        const diagram = currentDiagram();
        const connection: DesignConnection = {
          id: ids.connection(),
          sourceId,
          targetId,
          isBidirectional: false,
        };
        geometry(transaction([
          { type: 'connection.create', connection },
          // Alt-connect: the side(s) dragged from/to, in the SAME step as the
          // line. A bend-less `auto` row — the router's to fill in, under the sides.
          ...(diagram && sides && hasFixedSide(sides)
            ? routeCommands(diagram.id, [{
              connectionId: connection.id,
              waypoints: [],
              source: 'auto',
              ...routeSides(sides),
            }])
            : []),
        ]));
        setSelection(selectConnection(connection.id));
        return connection.id;
      },

      reconnect(id, endpoints, sides) {
        if (endpoints.sourceId === endpoints.targetId) return;
        const diagram = currentDiagram();
        const connection = currentModel().connections.find((c) => c.id === id);
        if (!connection) return;
        const stored = diagram ? routeFor(diagram, id) : undefined;
        geometry(transaction([
          { type: 'connection.update', id, patch: endpoints },
          // Only the end(s) the drag fixed change; the other keeps whatever it had.
          ...(diagram && sides && hasFixedSide(sides)
            ? routeCommands(diagram.id, [routeWithSides(stored, id, routeSides(sides))])
            : []),
        ]));
      },

      pasteClipboard(payload, offset) {
        if (propsRef.current.readOnly) return;
        const diagram = currentDiagram();
        if (!diagram || payload.elements.length === 0) return;
        const remapped = remapClipboard(payload, {
          mintElementId: (name) => ids.element(name),
          mintConnectionId: () => ids.connection(),
          offset,
          target: {
            kind: diagram.kind,
            applicationElementId: diagram.applicationElementId,
            domainGroupNames: new Set(
              (diagram.layoutConfig?.domainGroups ?? []).map((g) => g.name),
            ),
          },
        });
        geometry(transaction([
          ...remapped.elements.map((element) => ({ type: 'element.create' as const, element })),
          { type: 'placement.set', diagramId: diagram.id, placements: remapped.placements },
          ...remapped.connections.map((connection) => ({
            type: 'connection.create' as const, connection,
          })),
        ]));
        setSelection({
          elementIds: remapped.elements.map((e) => e.id),
          connectionIds: remapped.connections.map((c) => c.id),
          domainGroups: [],
        });
      },

      updateConnection(id, patch) {
        if (!currentModel().connections.some((c) => c.id === id)) return;
        dispatch({ type: 'connection.update', id, patch });
      },

      deleteConnection(id) {
        if (!currentModel().connections.some((c) => c.id === id)) return;
        geometry({ type: 'connection.delete', id });
        setSelection(EMPTY_SELECTION);
      },

      deleteSelection(selection) {
        if (isSelectionEmpty(selection)) return;
        const model = currentModel();
        const diagram = currentDiagram();
        const held = new Set(model.elements.map((e) => e.id));
        const doomed = selection.elementIds.filter((id) => held.has(id));
        const gone = new Set(doomed);
        const commands: Command[] = doomed.map((id) => ({ type: 'element.delete' as const, id }));
        for (const id of selection.connectionIds) {
          const connection = model.connections.find((c) => c.id === id);
          // A line whose endpoint is on its way out goes with the endpoint.
          // Asking for it twice would refuse, and one refusal takes the whole
          // gesture with it.
          if (!connection || gone.has(connection.sourceId) || gone.has(connection.targetId)) continue;
          commands.push({ type: 'connection.delete', id });
        }
        // Groups ride along in the SAME step, so Delete over a mixed selection
        // stays one undo step. A layer7 diagram is never one of the diagrams an
        // element delete takes with it, so its layout is still there to write.
        if (diagram && diagram.kind === 'layer7' && selection.domainGroups.length > 0) {
          commands.push(...groupRemovalCommands(diagram, new Set(selection.domainGroups)));
        }
        if (commands.length === 0) return;
        geometry(transaction(commands));
        setSelection(EMPTY_SELECTION);
      },

      removeFromDiagram(elementId) {
        const diagram = currentDiagram();
        if (!diagram) return;
        geometry({ type: 'placement.remove', diagramId: diagram.id, elementIds: [elementId] });
        setSelection(EMPTY_SELECTION);
      },

      deleteFromModel(elementId) {
        if (!currentModel().elements.some((e) => e.id === elementId)) return;
        geometry({ type: 'element.delete', id: elementId });
        setSelection(EMPTY_SELECTION);
      },

      setEdgeRoute(connectionId, waypoints) {
        const diagram = currentDiagram();
        if (!diagram) return;
        // Waypoints, the label anchor, the pin and the attach sides live on the
        // same route row; changing one must not clobber the others.
        const stored = routeFor(diagram, connectionId);
        const labelPosition = stored?.labelPosition;
        const pinned = stored?.pinned;
        const sides = routeSides(stored);
        const row: EdgeRoute = hasPlacedContent({ waypoints, labelPosition, pinned })
          ? // A hand edit CLAIMS the route (intent rule 10). Written in the same
            // step as the waypoints, so nudging one auto line and keeping it is
            // a single undo step in either direction — and from here on no
            // automatic pass may replace it.
            { connectionId, waypoints, labelPosition, source: 'manual', pinned, ...sides }
          : hasFixedSide(sides)
            ? // Nothing a person PLACED is left, only where the line attaches. The
              // row stays for its sides, but as the router's: a manual side-only
              // row would be preserved straight by every pass, for ever.
              { connectionId, waypoints: [], labelPosition: undefined, source: 'auto', ...sides }
            : // The last bend went and nothing else was ever stored: the row is
              // forgotten, so the line is a plain floating edge again and the
              // router may have it. Stamping THIS `manual` would leave a
              // label-less, bend-less row that every automatic pass preserves.
              { connectionId, waypoints: [], labelPosition: undefined };
        dispatch(transaction(routeCommands(diagram.id, [row])));
      },

      setEdgeLabelPosition(connectionId, position) {
        const diagram = currentDiagram();
        if (!diagram) return;
        const stored = routeFor(diagram, connectionId);
        const waypoints = stored?.waypoints ?? [];
        const pinned = stored?.pinned;
        const sides = routeSides(stored);
        // A dragged chip claims the route exactly as a dragged bend does. This
        // is the case the old waypoint-presence heuristic could not see at all:
        // a label-only route carries no waypoints, so it looked like nothing.
        // Resetting the chip of a row that then holds only its sides hands the
        // line back to the router (see `setEdgeRoute`).
        dispatch(transaction(routeCommands(diagram.id, [{
          connectionId,
          waypoints,
          labelPosition: position,
          source:
            hasPlacedContent({ waypoints, labelPosition: position, pinned }) || !hasFixedSide(sides)
              ? 'manual'
              : 'auto',
          pinned,
          ...sides,
        }])));
      },

      setRouteSource(connectionId, source) {
        const diagram = currentDiagram();
        if (!diagram) return;
        const stored = routeFor(diagram, connectionId);
        if (!stored) {
          // Nothing stored and nothing to unpin.
          if (source === 'auto') return;
          dispatch({
            type: 'route.set',
            diagramId: diagram.id,
            routes: [{
              connectionId, waypoints: [], labelPosition: undefined, source: 'manual', pinned: true,
            }],
          });
          return;
        }
        const next: EdgeRoute =
          source === 'manual'
            ? { ...stored, source: 'manual', pinned: true }
            : // Dropping the pin may leave the row without content, in which case
              // the row is forgotten — a straight line that is no longer pinned
              // has nothing left to say.
              {
                connectionId,
                waypoints: stored.waypoints,
                labelPosition: stored.labelPosition,
                source: 'auto',
                // The sides stay: unpinning gives the geometry back, not the constraints.
                ...routeSides(stored),
              };
        dispatch(transaction(routeCommands(diagram.id, [next])));
      },

      setRouteSides(connectionId, sides) {
        const diagram = currentDiagram();
        if (!diagram) return undefined;
        const stored = routeFor(diagram, connectionId);
        const row = routeWithSides(stored, connectionId, sides);
        // A no-op — the side it already had, or Automatic on a line with no row —
        // changes nothing, so it costs no undo step and queues no pass.
        if (stored ? edgeRoutesEqual(stored, row) : !hasRouteContent(row)) return undefined;
        const command = transaction(routeCommands(diagram.id, [row]));
        // The same two roads as `resetEdgeRoute`: live routing follows a geometry
        // bump by itself; otherwise the caller runs the pass and folds it into
        // the token.
        return diagram.autoRoute ? geometry(command) : dispatch(command);
      },

      resetEdgeRoute(connectionId) {
        const diagram = currentDiagram();
        if (!diagram) return tokenRef.current;
        const command: Command = {
          type: 'route.clear', diagramId: diagram.id, connectionIds: [connectionId],
        };
        // With live routing on, the geometry bump is what queues the reroute that
        // brings the line back routed; off, the caller runs that pass itself and
        // the plain change hands it the token to fold into.
        return diagram.autoRoute ? geometry(command) : dispatch(command);
      },

      setZoneSize(zone, size) {
        const diagram = currentDiagram();
        if (!diagram || diagram.kind !== 'layer7') return;
        const current = diagram.layoutConfig ?? {};
        const next: DiagramLayoutConfig = {
          ...current,
          zones: { ...current.zones, [zone]: { size: clampZoneSize(zone, size, current) } },
        };
        dispatch({ type: 'layout.set', diagramId: diagram.id, layoutConfig: next });
      },

      setCanvasSize(size) {
        const diagram = currentDiagram();
        if (!diagram || diagram.kind !== 'layer7') return;
        const current = diagram.layoutConfig ?? {};
        const canvas = clampCanvasSize(size);
        // Band maxima are fractions of the board, so a smaller board means
        // shallower bands. Leaving the stored sizes alone and clamping them only
        // at render time stranded their nodes: the second row of a deep actors
        // band drew inside the landscape while the placement still said
        // `actors`. Write the bands the new board allows, then bring their
        // members back inside — one step, one undo step.
        const zones = { ...current.zones };
        for (const zone of RESIZABLE_ZONES) {
          const stored = current.zones?.[zone]?.size;
          if (stored === undefined) continue;
          zones[zone] = { size: clampZoneSize(zone, stored, { ...current, canvas }) };
        }
        const next: DiagramLayoutConfig = { ...current, canvas, zones };
        const elementsById = new Map(currentModel().elements.map((e) => [e.id, e]));
        const placements: DiagramPlacement[] = [];
        for (const placement of diagram.placements) {
          const element = elementsById.get(placement.elementId);
          if (!element || !placement.zone || placement.zone === 'landscape') continue;
          const moved = clampPlacementIntoZone(placement, element.kind, next);
          if (moved) placements.push(moved);
        }
        dispatch(transaction([
          { type: 'layout.set', diagramId: diagram.id, layoutConfig: next },
          ...(placements.length ? [{ type: 'placement.set' as const, diagramId: diagram.id, placements }] : []),
        ]));
      },

      resizePlacement(elementId, rect) {
        const diagram = currentDiagram();
        const placement = diagram?.placements.find((p) => p.elementId === elementId);
        if (!diagram || !placement) return;
        geometry({
          type: 'placement.set',
          diagramId: diagram.id,
          placements: [{
            ...placement, x: rect.x, y: rect.y, width: rect.width, height: rect.height,
          }],
        });
      },

      upsertDomainGroup(rect, memberIds) {
        const diagram = currentDiagram();
        if (!diagram || diagram.kind !== 'layer7') return;
        const current = diagram.layoutConfig ?? {};
        const groups = [...(current.domainGroups ?? [])];
        const index = groups.findIndex((g) => g.name === rect.name);
        if (index >= 0) groups[index] = rect;
        else groups.push(rect);
        const members = new Set(memberIds ?? []);
        const placements = diagram.placements
          .filter((p) => members.has(p.elementId) && p.domainGroup !== rect.name)
          .map((p) => ({ ...p, domainGroup: rect.name }));
        geometry(transaction([
          { type: 'layout.set', diagramId: diagram.id, layoutConfig: { ...current, domainGroups: groups } },
          ...(placements.length ? [{ type: 'placement.set' as const, diagramId: diagram.id, placements }] : []),
        ]));
      },

      moveDomainGroup(name, dx, dy) {
        const diagram = currentDiagram();
        if (!diagram || diagram.kind !== 'layer7' || (dx === 0 && dy === 0)) return;
        const current = diagram.layoutConfig ?? {};
        const groups = [...(current.domainGroups ?? [])];
        const index = groups.findIndex((g) => g.name === name);
        if (index < 0) return; // no such group — nothing to move
        const group = groups[index];
        // Rigid move: the box and its members share one absolute frame, so the
        // same (dx, dy) applies to both. Membership is untouched.
        groups[index] = { ...group, x: group.x + dx, y: group.y + dy };
        const placements = diagram.placements
          .filter((p) => p.domainGroup === name)
          .map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
        geometry(transaction([
          ...(placements.length ? [{ type: 'placement.set' as const, diagramId: diagram.id, placements }] : []),
          { type: 'layout.set', diagramId: diagram.id, layoutConfig: { ...current, domainGroups: groups } },
        ]));
      },

      renameDomainGroup(oldName, newName) {
        const diagram = currentDiagram();
        const trimmed = newName.trim();
        if (!diagram || diagram.kind !== 'layer7' || !trimmed || trimmed === oldName) return;
        const current = diagram.layoutConfig ?? {};
        if (current.domainGroups?.some((g) => g.name === trimmed)) return; // names are keys
        const groups = (current.domainGroups ?? []).map((g) =>
          g.name === oldName ? { ...g, name: trimmed } : g,
        );
        // A selected group is selected BY NAME, so the rename has to carry the
        // selection with it or the inspector would go blank on its own edit.
        setSelection((s) =>
          s.domainGroups.includes(oldName)
            ? { ...s, domainGroups: s.domainGroups.map((n) => (n === oldName ? trimmed : n)) }
            : s,
        );
        const placements = diagram.placements
          .filter((p) => p.domainGroup === oldName)
          .map((p) => ({ ...p, domainGroup: trimmed }));
        dispatch(transaction([
          { type: 'layout.set', diagramId: diagram.id, layoutConfig: { ...current, domainGroups: groups } },
          ...(placements.length ? [{ type: 'placement.set' as const, diagramId: diagram.id, placements }] : []),
        ]));
      },

      setAutoRoute(on) {
        const diagram = currentDiagram();
        if (!diagram || (diagram.autoRoute ?? false) === on) return;
        // `undoable: false`: a mode is not content. Undoing a node move must not
        // switch live routing off (see the action's doc comment).
        dispatch({
          type: 'diagram.update', id: diagram.id, patch: { autoRoute: on }, undoable: false,
        });
      },

      removeDomainGroup(name) {
        const diagram = currentDiagram();
        if (!diagram || diagram.kind !== 'layer7') return;
        geometry(transaction(groupRemovalCommands(diagram, new Set([name]))));
        setSelection((s) =>
          s.domainGroups.includes(name)
            ? { ...s, domainGroups: s.domainGroups.filter((n) => n !== name) }
            : s,
        );
      },
    };
  }, [dispatch, ids]);

  // Single-item inspector cases: exactly one thing (and nothing else) selected.
  const soleKind =
    selectionCount(selection) === 1
      ? selection.elementIds.length === 1
        ? 'element'
        : selection.connectionIds.length === 1
          ? 'connection'
          : 'domainGroup'
      : undefined;
  const selectedElement =
    soleKind === 'element'
      ? model.elements.find((e) => e.id === selection.elementIds[0])
      : undefined;
  const selectedConnection =
    soleKind === 'connection'
      ? model.connections.find((c) => c.id === selection.connectionIds[0])
      : undefined;
  const selectedDomainGroup = soleKind === 'domainGroup' ? selection.domainGroups[0] : undefined;

  // Keep selection honest when a selected item disappears from the model — an
  // undo of the step that drew it, or a delete. Prunes the vanished ids, keeping
  // the rest of a multi-selection intact.
  useEffect(() => {
    setSelection((current) => pruneSelection(current, model, propsRef.current.activeDiagramId));
  }, [model, props.activeDiagramId]);

  return {
    model,
    selection,
    setSelection,
    selectedElement,
    selectedConnection,
    selectedDomainGroup,
    actions,
    geometryVersion,
    commitToken: tokenRef.current,
    undo: props.history.undo,
    redo: props.history.redo,
    canUndo: props.history.canUndo,
    canRedo: props.history.canRedo,
  };
}

function seedPlacement(
  seed: ElementSeed,
  diagram: {
    id: string;
    kind: 'layer7' | 'container';
    placements: DiagramPlacement[];
    layoutConfig?: DiagramLayoutConfig;
  },
  elementId: ElementId,
): DiagramPlacement {
  if (diagram.kind === 'layer7') {
    const zone = seed.zone ?? HOME_ZONE[seed.kind];
    const position =
      seed.position ??
      defaultZonePosition(
        zone,
        seed.kind,
        diagram.placements.filter((p) => (p.zone ?? 'landscape') === zone).length,
        diagram.layoutConfig,
      );
    return { elementId, zone, domainGroup: seed.domainGroup, ...position };
  }
  const position =
    seed.position ?? defaultContainerPosition(seed.kind, diagram.placements.length);
  return { elementId, ...position };
}

/**
 * Route rows, said as commands.
 *
 * A row with nothing on it — no bends, no chip, no pin, no fixed side — is not
 * a row to store: it is the instruction to forget the one that is there.
 * `hasRouteContent` is the single definition of that, so nobody has to
 * re-derive the rule from `waypoints`.
 */
function routeCommands(diagramId: string, rows: readonly EdgeRoute[]): Command[] {
  const routes = rows.filter((r) => hasRouteContent(r));
  const connectionIds = rows.filter((r) => !hasRouteContent(r)).map((r) => r.connectionId);
  const commands: Command[] = [];
  if (connectionIds.length > 0) commands.push({ type: 'route.clear', diagramId, connectionIds });
  if (routes.length > 0) commands.push({ type: 'route.set', diagramId, routes });
  return commands;
}

/**
 * What a Tidy leaves of a route it did not route: the bends and the chip go —
 * they were measured against positions that no longer exist — but the attach
 * sides stay, because a constraint is not measured against anything. A row kept
 * for its sides alone is the router's (`auto`); with no sides this row has no
 * content at all, and `routeCommands` reads that as "forget it".
 */
function clearedRoute(route: EdgeRoute): EdgeRoute {
  return {
    connectionId: route.connectionId,
    waypoints: [],
    labelPosition: undefined,
    ...(hasFixedSide(route) ? { source: 'auto' as const, ...routeSides(route) } : {}),
  };
}

/**
 * Drop domain-group rects by name and clear their members' membership — the
 * shared body of `removeDomainGroup` and the group half of `deleteSelection`,
 * so both stay a single step. The member ELEMENTS survive; they just stop
 * belonging to a group (removing a box is a layout edit, never a data delete).
 */
function groupRemovalCommands(diagram: DesignDiagram, names: Set<string>): Command[] {
  const current = diagram.layoutConfig ?? {};
  const commands: Command[] = [{
    type: 'layout.set',
    diagramId: diagram.id,
    layoutConfig: {
      ...current,
      domainGroups: (current.domainGroups ?? []).filter((g) => !names.has(g.name)),
    },
  }];
  const placements = diagram.placements
    .filter((p) => p.domainGroup !== undefined && names.has(p.domainGroup))
    .map((p) => ({ ...p, domainGroup: undefined }));
  if (placements.length > 0) {
    commands.push({ type: 'placement.set', diagramId: diagram.id, placements });
  }
  return commands;
}

/**
 * Drop ids whose element/connection no longer exists, and group names the
 * active diagram no longer defines; keep the survivors.
 */
function pruneSelection(
  selection: Selection,
  model: DesignModel,
  activeDiagramId: string,
): Selection {
  if (isSelectionEmpty(selection)) return selection;
  const elementIds = new Set(model.elements.map((e) => e.id));
  const connectionIds = new Set(model.connections.map((c) => c.id));
  const diagram = model.diagrams.find((d) => d.id === activeDiagramId);
  const groupNames = new Set(
    (diagram?.layoutConfig?.domainGroups ?? []).map((g) => g.name),
  );
  const nextElements = selection.elementIds.filter((id) => elementIds.has(id));
  const nextConnections = selection.connectionIds.filter((id) => connectionIds.has(id));
  const nextGroups = selection.domainGroups.filter((name) => groupNames.has(name));
  if (
    nextElements.length === selection.elementIds.length &&
    nextConnections.length === selection.connectionIds.length &&
    nextGroups.length === selection.domainGroups.length
  ) {
    return selection;
  }
  return {
    elementIds: nextElements,
    connectionIds: nextConnections,
    domainGroups: nextGroups,
  };
}
