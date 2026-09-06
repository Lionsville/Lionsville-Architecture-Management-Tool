import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DesignConnection, DesignDiagram, DesignElement, DesignModel, DiagramLayoutConfig, DiagramPlacement, DomainGroupRect, EdgeRoute, EdgeRouteSource, ElementId, ElementKind, Layer7Zone, NodeIconSize, NodeShapeVariant, Point, Rect, ResizableZone } from '../model/types';
import type { SolutionDesignEditorProps } from './props';
import { DEFAULT_TRANSLATE, translator, type StringKey, type Translate } from '../i18n/strings';
import type { TidyResult } from '../layout/tidy';
import { buildBatch } from '../model/batch';
import { remapClipboard, type ClipboardPayload } from '../model/clipboard';
import { isTempId } from '../model/ids';
import { idPolicy, idsIn } from '../model/keys';
import type { IdPolicy } from '../model/keys';
import { mergeModel } from '../model/merge';
import {
  EMPTY_OVERLAY,
  overlayWithConnection,
  overlayWithConnectionDeleted,
  overlayWithEdgeRoute,
  overlayWithElement,
  overlayWithElementDeleted,
  overlayWithAutoRoute,
  overlayWithLayoutConfig,
  overlayWithPlacement,
  overlayWithPlacementRemoved,
  overlayWithPlacements,
  type ModelOverlay,
} from '../model/overlay';
import {
  reconcileOverlay,
  remapOverlayIds,
  type EmittedConnectionSnapshot,
  type EmittedElementSnapshot,
} from '../model/reconcile';
import { diffToOverlay, effectiveOverlay } from '../model/diffToOverlay';
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
   * The same patch onto several elements in ONE commit — the selection menu's
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
   * Both land in ONE commit, so it is one undo step. A refused change commits
   * nothing.
   */
  changeElementKind(id: ElementId, kind: ElementKind): void;
  movePlacements(moves: PlacementMove[]): void;
  setPlacements(placements: DiagramPlacement[]): void;
  /**
   * Commit a Tidy run in ONE batch: element positions plus, for layer7, the
   * re-sized landscape domain-group rects. Rects are merged into
   * `layoutConfig.domainGroups` BY NAME — create-or-resize: an existing rect is
   * resized in place, a tidy rect with a new name is appended (Tidy emits one
   * per group with members) — and rects Tidy didn't touch (e.g. member-less
   * groups) are preserved.
   */
  applyTidyResult(result: TidyResult, amend?: CommitToken): CommitToken;
  setDomainGroup(elementId: ElementId, domainGroup: string | undefined): void;
  /**
   * The same, for a whole selection, in ONE commit — so bulk-assigning a domain
   * group is one undo step rather than one per element. Elements with no
   * placement on the active diagram are skipped.
   */
  setDomainGroups(elementIds: readonly ElementId[], domainGroup: string | undefined): void;
  /**
   * Draw a new connection. With `sides` (an Alt-connect from or to a specific
   * side handle) the attach sides land in the SAME commit as the line, as a
   * bend-less `auto` route row, so one undo removes both. Returns the new
   * connection's (temp) id; `undefined` for a refused self-connection.
   */
  connect(sourceId: ElementId, targetId: ElementId, sides?: RouteSides): string | undefined;
  /**
   * Repoint an existing connection — a reconnect drag — optionally fixing the
   * end(s) the user dragged to a specific side handle with Alt held, in ONE
   * geometry commit: a reconnect changes topology, so the live pass follows.
   */
  reconnect(id: string, endpoints: { sourceId: ElementId; targetId: ElementId }, sides?: RouteSides): void;
  /**
   * Paste a clipboard snapshot onto the active diagram: mints fresh temp ids,
   * remaps references (parent, endpoints), offsets placements, then selects
   * the pasted set. Reuses the tempId → reconcile round-trip (see clipboard.ts).
   */
  pasteClipboard(payload: ClipboardPayload, offset: Point): void;
  updateConnection(id: string, patch: Partial<Omit<DesignConnection, 'id'>>): void;
  deleteConnection(id: string): void;
  /**
   * Delete a whole selection (elements + connections + domain groups) in ONE
   * batched commit — the destructive half of Mod+X cut. Element deletes cascade
   * to their connections and placements; the explicit connection ids are removed
   * too, and selected domain groups lose their rect (members survive, they just
   * stop belonging to a group).
   */
  deleteSelection(selection: Selection): void;
  removeFromDiagram(elementId: ElementId): void;
  deleteFromModel(elementId: ElementId): void;
  /**
   * Replace a connection's waypoints on the active diagram (label anchor and pin
   * kept). A hand edit, so the route becomes `manual`. Clearing the last bend of
   * a route that has no label anchor and no pin writes the delete marker instead,
   * which hands the line back to the router — "remove all bend points" must not
   * leave behind an empty row that every automatic pass then steps around.
   */
  setEdgeRoute(connectionId: string, waypoints: Point[]): void;
  /** Move (or reset, with undefined) a connection's label anchor on the active diagram. */
  setEdgeLabelPosition(connectionId: string, position: Point | undefined): void;
  /**
   * Pin (`manual`) or unpin (`auto`) a connection's route without touching its
   * geometry — one commit, one undo step. Pinning a line that has no stored row
   * writes a bend-less row carrying `pinned: true`, so the fact survives; unpinning
   * such a row deletes it. Nothing is re-routed here: Unpin only hands the line
   * to the next automatic pass, and `resetEdgeRoute` is the action that asks for one.
   */
  setRouteSource(connectionId: string, source: EdgeRouteSource): void;
  /**
   * Forget everything stored for a connection's route on the active diagram —
   * bends, label anchor, pin, provenance, attach sides — so the router gets it
   * back. With live auto-routing on this is a GEOMETRY commit, so the live pass
   * follows and amends its routes into the same undo step through the returned
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
   * commit with live routing on, a plain commit plus a caller-run pass with it
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
   * placements join the group in the same commit — how "Group into new domain
   * group" makes one undo step out of a box and its membership.
   */
  upsertDomainGroup(rect: DomainGroupRect, memberIds?: readonly ElementId[]): void;
  /**
   * Rigid-move a domain group: translate its box rect AND every member
   * placement by (dx, dy) in ONE commit (one undo step). Membership is
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
  effectiveModel: DesignModel;
  selection: Selection;
  setSelection(selection: Selection): void;
  selectedElement?: DesignElement;
  selectedConnection?: DesignConnection;
  /** Name of the sole selected domain group (layer7), if that's the selection. */
  selectedDomainGroup?: string;
  actions: EditorActions;
  /**
   * Bumped by every commit that moved geometry or changed topology, and by
   * undo/redo. Live routing debounces a whole-board reroute on it.
   */
  geometryVersion: number;
  /**
   * The current overlay version — the amend token a caller passes back to
   * `applyTidyResult` to fold a follow-up commit into the step it already made.
   * Read it BEFORE an async pass; anything that mutates the overlay meanwhile
   * makes it stale, which is exactly what should invalidate the amend.
   */
  overlayVersion: CommitToken;
  /** In-memory undo/redo over content commits (U7). Selection/viewport excluded. */
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
 * Owns the local overlay (see model/overlay.ts for the merge strategy) and
 * exposes the effective model plus every mutation as a small action API.
 * Each mutation synchronously emits a fresh DiagramContentBatch through
 * `onChange` — the host debounces and persists.
 *
 * The overlay lives in a ref with a version counter: commits happen in event
 * handlers, must read the latest overlay synchronously (several state updates
 * can land before React re-renders), and must emit exactly once per mutation
 * (StrictMode-safe — no side effects inside setState updaters).
 */
/** Undo history depth cap (U7/D6): drop the oldest past-snapshot beyond this. */
const HISTORY_CAP = 50;

/**
 * What a commit hands back so a follow-up can be folded INTO it rather than
 * pushed after it — see `commit`'s amend mode.
 *
 * It is the overlay version, not a commit counter, and the difference is
 * load-bearing: `undo`/`redo` bump the overlay version without going through
 * `commit`, so a token minted before an undo is correctly stale afterwards.
 */
export type CommitToken = number;

export function useEditorState(props: SolutionDesignEditorProps): EditorState {
  const overlayRef = useRef<ModelOverlay>(EMPTY_OVERLAY);
  const [, setOverlayVersion] = useState(0);
  // Mirrored in a ref so a callback can read the CURRENT value synchronously —
  // `commit` returns it as an amend token and compares against it on the way in,
  // both of which happen inside event handlers before React re-renders.
  const overlayVersionRef = useRef(0);
  const bumpOverlayVersion = useCallback(() => {
    overlayVersionRef.current += 1;
    setOverlayVersion(overlayVersionRef.current);
  }, []);
  /**
   * Bumped by every commit that moves geometry or changes topology, and
   * unconditionally by undo/redo. Live routing debounces on it.
   *
   * Deliberately NOT bumped by `applyTidyResult`: a tidy routes as its own final
   * step, so re-routing after it would fight the `'clear'` policy it just ran
   * under. That exclusion is also what keeps an auto-layout from triggering a
   * second pass — an auto-layout IS an `applyTidyResult`.
   */
  const [geometryVersion, setGeometryVersion] = useState(0);
  const bumpGeometry = useCallback(() => setGeometryVersion((v) => v + 1), []);
  // In-memory undo/redo stacks (U7, B-effective-state): session-scoped, no
  // persistence. Each snapshot is a full-upsert overlay of the EFFECTIVE state
  // (`effectiveOverlay`), NOT the raw patch — the host swaps `props.model` on
  // every autosave, so a raw-patch snapshot would go stale against the moved
  // base. `undo`/`redo` synthesise the corrective patch against the CURRENT base
  // via `diffToOverlay` and re-emit through the SAME `emitBatch`. `past` holds
  // states to undo TO; `future` holds ones a redo restores. `commit` is the only
  // push point (undo/redo never route through it — no flag needed).
  const pastRef = useRef<ModelOverlay[]>([]);
  const futureRef = useRef<ModelOverlay[]>([]);
  const emittedElementsRef = useRef<Map<ElementId, EmittedElementSnapshot>>(new Map());
  const emittedConnectionsRef = useRef<Map<string, EmittedConnectionSnapshot>>(new Map());
  const previousModelRef = useRef<DesignModel>(props.model);
  const previousAliasesRef = useRef(props.idAliases);
  const previousHistoryTokenRef = useRef(props.historyResetToken);
  const previousRebaseTokenRef = useRef(props.rebaseToken);
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);

  const propsRef = useRef(props);
  propsRef.current = props;

  /**
   * The host's policy when it has one, otherwise one over the model as this
   * editor sees it — which includes what has been drawn and not yet flushed, so
   * two elements added in one gesture cannot claim the same key.
   */
  const ownIds = useRef<IdPolicy | null>(null);
  ownIds.current ??= idPolicy(
    () => idsIn(mergeModel(propsRef.current.model, overlayRef.current)));
  const ids = props.ids ?? ownIds.current;

  const emitBatch = useCallback((overlay: ModelOverlay) => {
    const { model, activeDiagramId, onChange } = propsRef.current;
    const batch = buildBatch(activeDiagramId, model, overlay);
    recordSnapshots(batch, emittedElementsRef.current, emittedConnectionsRef.current);
    onChange(batch);
  }, []);

  const commit = useCallback(
    (mutate: (overlay: ModelOverlay) => ModelOverlay, options?: { amend?: CommitToken }) => {
      if (propsRef.current.readOnly) return overlayVersionRef.current;
      const previous = overlayRef.current;
      const next = mutate(previous);
      if (next === previous) return overlayVersionRef.current; // no-op: nothing to record
      // AMEND (live routing): fold this commit into the undo step the caller
      // already made, instead of pushing a second one. A node drag commits on
      // drag-stop and its routes arrive milliseconds later; two undo entries for
      // one gesture would mean Cmd+Z put the routes back where they were and left
      // the node where it is.
      //
      // The token is the OVERLAY version, deliberately not a counter of commits.
      // `undo`/`redo` bypass `commit` entirely but do bump the overlay version, so
      // keying on it makes the invariant structural: any path that mutates the
      // overlay has to bump the version to render, and bumping it is exactly what
      // invalidates a stale amend. A commit-local counter would still match after
      // an undo, and the reroute would then write pre-undo routes into the
      // restored step with no undo entry of its own.
      //
      // A stale token falls back to a normal commit, which is correct rather than
      // clever: the routes get their own undo step instead of being folded into
      // the wrong one.
      const amending = options?.amend !== undefined && options.amend === overlayVersionRef.current;
      // A host that owns the stack (`onUndo`) gets no snapshot pushed here: the
      // snapshot is a full-model merge, and paying for it per keystroke to fill
      // a stack nothing reads is the worst of both mechanisms.
      if (!amending && !propsRef.current.onUndo) {
        // Snapshot the EFFECTIVE state BEFORE this edit (full-upsert overlay), so
        // a later base (post-autosave) can't corrupt the undo target. Truncate the
        // redo tail (a fresh edit invalidates it) and cap the depth (D6).
        pastRef.current.push(effectiveOverlay(mergeModel(propsRef.current.model, previous)));
        if (pastRef.current.length > HISTORY_CAP) pastRef.current.shift();
        futureRef.current = [];
      }
      overlayRef.current = next;
      bumpOverlayVersion();
      emitBatch(next);
      return overlayVersionRef.current;
    },
    [emitBatch, bumpOverlayVersion],
  );

  // Undo/redo (U7): restore a neighbouring overlay snapshot and re-emit the
  // cumulative corrective batch through the SAME path `commit` uses, so the
  // autosave queue converges the server to the restored state. Content only —
  // never selection or viewport (D5). `readOnly`-gated, exactly like `commit`.
  const undoLocal = useCallback(() => {
    if (propsRef.current.readOnly || pastRef.current.length === 0) return;
    const base = propsRef.current.model;
    // Park the current effective state for redo, restore the previous one as a
    // fresh patch against the current base.
    futureRef.current.push(effectiveOverlay(mergeModel(base, overlayRef.current)));
    overlayRef.current = withModeLanes(
      diffToOverlay(base, pastRef.current.pop() as ModelOverlay),
      overlayRef.current,
    );
    bumpOverlayVersion();
    // UNCONDITIONALLY, without inspecting whether the restored snapshot differs
    // geometrically at all. Undo and redo deliberately bypass `commit` — it is the
    // only push point onto the undo stack — so a bump list built out of the action
    // functions misses them entirely, and Cmd+Z after a node move would restore the
    // old positions while keeping the routes computed for the new ones: exactly the
    // stale geometry live routing exists to remove, reached by the one gesture a
    // user reaches for when they dislike what they see.
    //
    // Undoing a rename therefore costs one redundant whole-board reroute. That is
    // sub-millisecond worker time on a real board for an idempotent pass, against
    // the alternative of diffing two overlay snapshots for geometric equality on
    // every undo — a new comparison to write, test and keep in step with the model.
    bumpGeometry();
    emitBatch(overlayRef.current);
  }, [emitBatch, bumpOverlayVersion, bumpGeometry]);

  const redoLocal = useCallback(() => {
    if (propsRef.current.readOnly || futureRef.current.length === 0) return;
    const base = propsRef.current.model;
    pastRef.current.push(effectiveOverlay(mergeModel(base, overlayRef.current)));
    overlayRef.current = withModeLanes(
      diffToOverlay(base, futureRef.current.pop() as ModelOverlay),
      overlayRef.current,
    );
    bumpOverlayVersion();
    bumpGeometry(); // same reasoning as `undo` above
    emitBatch(overlayRef.current);
  }, [emitBatch, bumpOverlayVersion, bumpGeometry]);

  // Reconcile whenever the host hands us a refreshed model — or a fresh alias
  // map (see reconcile.ts). The two do NOT always arrive together: the host
  // learns tmp→real only when its save call resolves, by which time the
  // mutation's success handler has already swapped `props.model`. Running only
  // on the model swap would reconcile with an alias map that is still missing
  // the id that very save just assigned, and nothing would re-run afterwards.
  useEffect(() => {
    const modelChanged = previousModelRef.current !== props.model;
    const aliasesChanged = previousAliasesRef.current !== props.idAliases;
    /**
     * The host replaced the DOCUMENT, not just its content: forget everything
     * this session accumulated ABOUT the old one and take the incoming model as
     * the base, rather than reconciling against a model that no longer exists.
     *
     * It runs before the reconcile because reconciliation is the wrong tool
     * here. It exists to keep local edits alive across a save round-trip by
     * matching them to the rows that came back; matching them against a
     * different document would let a stale undo step reintroduce content the
     * user just replaced.
     */
    if (previousHistoryTokenRef.current !== props.historyResetToken) {
      previousHistoryTokenRef.current = props.historyResetToken;
      previousRebaseTokenRef.current = props.rebaseToken;
      previousModelRef.current = props.model;
      previousAliasesRef.current = props.idAliases;
      overlayRef.current = EMPTY_OVERLAY;
      pastRef.current = [];
      futureRef.current = [];
      emittedElementsRef.current.clear();
      emittedConnectionsRef.current.clear();
      setSelection(EMPTY_SELECTION);
      bumpOverlayVersion();
      return;
    }
    /**
     * The host changed the model for a reason that is not a reply to a batch —
     * its own undo. Take what arrived as the base and drop the overlay, or
     * reconciliation would let the local value win and put the undone change
     * straight back. The selection stays: one step of the document moved, not
     * the document (see `rebaseToken` in props.ts).
     */
    if (previousRebaseTokenRef.current !== props.rebaseToken) {
      previousRebaseTokenRef.current = props.rebaseToken;
      previousModelRef.current = props.model;
      previousAliasesRef.current = props.idAliases;
      overlayRef.current = EMPTY_OVERLAY;
      emittedElementsRef.current.clear();
      emittedConnectionsRef.current.clear();
      bumpOverlayVersion();
      bumpGeometry();
      return;
    }
    if (!modelChanged && !aliasesChanged) return;
    previousAliasesRef.current = props.idAliases;
    // On an alias-only pass `previous` and `incoming` are the same model, so
    // there are no new candidates to match heuristically — the authoritative
    // aliases do all the work (resolving still-live temp ids, materialising
    // raced deletes) and the stack remap below picks up the parked snapshots.
    const result = reconcileOverlay({
      previous: previousModelRef.current,
      incoming: props.model,
      overlay: overlayRef.current,
      emittedElements: [...emittedElementsRef.current.values()],
      emittedConnections: [...emittedConnectionsRef.current.values()],
      knownElementAliases: props.idAliases?.elements,
      knownConnectionAliases: props.idAliases?.connections,
    });
    previousModelRef.current = props.model;
    overlayRef.current = result.overlay;
    // The crux (D3): remap the WHOLE undo/redo stack into the server id-space so
    // no snapshot carries a tempId that already has a real id. Use the DURABLE
    // `props.idAliases` (the host's accumulated tmp→real contract), not just the
    // freshly-resolved `result` aliases — those are gated on the tempId still
    // being live in the overlay (reconcile.ts), so a tempId that survives only in
    // a PARKED past/future snapshot (e.g. after an undo emptied the live overlay
    // while its create was in flight) would otherwise never be remapped. A stale
    // tempId there makes `diffToOverlay` see the reconciled real row as "absent"
    // and synthesise a delete of a persisted row — data loss. Union both maps
    // (result wins on overlap; both agree in practice) so heuristic-only aliases
    // for still-live tempIds are covered too. This is also why the effect above
    // re-runs on a late alias map: the durable contract is only durable once we
    // have actually seen it.
    const elementAliases = new Map<ElementId, ElementId>([
      ...(props.idAliases?.elements ?? []),
      ...result.elementAliases,
    ]);
    const connectionAliases = new Map<string, string>([
      ...(props.idAliases?.connections ?? []),
      ...result.connectionAliases,
    ]);
    if (elementAliases.size > 0 || connectionAliases.size > 0) {
      const remap = (o: ModelOverlay) => remapOverlayIds(o, elementAliases, connectionAliases);
      pastRef.current = pastRef.current.map(remap);
      futureRef.current = futureRef.current.map(remap);
    }
    for (const [tempId] of result.elementAliases) emittedElementsRef.current.delete(tempId);
    for (const [tempId] of result.connectionAliases) emittedConnectionsRef.current.delete(tempId);
    // An alias-only pass that resolved nothing changed nothing observable — skip
    // the re-render rather than churn the effective model on every save.
    if (modelChanged || result.elementAliases.size > 0 || result.connectionAliases.size > 0) {
      setSelection((current) => remapSelection(current, result));
      bumpOverlayVersion();
    }
    if (result.mustEmit) emitBatch(result.overlay);
  }, [
    props.model, props.idAliases, props.historyResetToken, props.rebaseToken,
    emitBatch, bumpOverlayVersion, bumpGeometry,
  ]);

  const overlay = overlayRef.current;
  const effectiveModel = useMemo(
    () => mergeModel(props.model, overlay),
    [props.model, overlay],
  );

  const actions = useMemo<EditorActions>(() => {
    /**
     * Commit something that moved geometry or changed topology.
     *
     * The list of actions that route through this IS the specification of when
     * live routing re-runs, so it is worth reading as one: every placement move,
     * resize, group move or group rect change; every connect, delete or paste;
     * every add or removal from the diagram. Not style edits, not renames, not
     * zone/canvas resizes — those change nothing the router measures.
     *
     * `applyTidyResult` is the deliberate omission (see `geometryVersion`).
     */
    const commitGeometry: typeof commit = (mutate, options) => {
      const token = commit(mutate, options);
      bumpGeometry();
      return token;
    };
    const diagramId = () => propsRef.current.activeDiagramId;
    const currentModel = () => mergeModel(propsRef.current.model, overlayRef.current);
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
        commitGeometry((o) =>
          overlayWithPlacement(overlayWithElement(o, element), diagram.id, placement),
        );
        setSelection(selectElement(id));
      },

      updateElement(id, patch) {
        const element = currentModel().elements.find((e) => e.id === id);
        if (!element) return;
        commit((o) => overlayWithElement(o, { ...element, ...patch, id, kind: element.kind }));
      },

      updateElements(ids, patch) {
        const elementsById = new Map(currentModel().elements.map((e) => [e.id, e]));
        const targets = ids.map((id) => elementsById.get(id)).filter((e): e is DesignElement => Boolean(e));
        if (targets.length === 0) return;
        commit((o) => {
          let next = o;
          for (const element of targets) {
            next = overlayWithElement(next, { ...element, ...patch, id: element.id, kind: element.kind });
          }
          return next;
        });
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
        commit((o) =>
          overlayWithPlacement(overlayWithElement(o, { ...element, kind }), diagram.id, next),
        );
      },

      movePlacements(moves) {
        const diagram = currentDiagram();
        if (!diagram || moves.length === 0) return;
        const model = currentModel();
        const elementsById = new Map(model.elements.map((e) => [e.id, e]));
        // Rects before and after, for the hand-drawn routes that hang off a moved
        // node (below). Size never changes in a move, so both come from the kind.
        const rects = new Map<ElementId, { before: Rect; after: Rect }>();
        commitGeometry((o) => {
          let next = o;
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
            next = overlayWithPlacement(next, diagram.id, {
              ...placement,
              x: move.x,
              y: move.y,
              zone: diagram.kind === 'layer7' ? move.zone : placement.zone,
              domainGroup: diagram.kind === 'layer7' ? move.domainGroup : placement.domainGroup,
            });
          }
          // Hand-drawn routes follow their nodes (Phase 2e): the bend next to a
          // moved node slides along its end leg's axis by the node's delta, in the
          // SAME commit as the move, so one undo takes both back. Auto routes are
          // left alone — live routing recomputes them, and without live routing
          // they were never the user's geometry to keep attached.
          for (const route of diagram.edgeRoutes ?? []) {
            if (isAutoRoute(route)) continue;
            const connection = model.connections.find((c) => c.id === route.connectionId);
            if (!connection) continue;
            let followed = route;
            const source = rects.get(connection.sourceId);
            if (source) followed = followNodeMove(followed, source.before, source.after, true);
            const target = rects.get(connection.targetId);
            if (target) followed = followNodeMove(followed, target.before, target.after, false);
            if (followed !== route) next = overlayWithEdgeRoute(next, diagram.id, followed);
          }
          return next;
        });
      },

      setPlacements(placements) {
        const diagram = currentDiagram();
        if (!diagram) return;
        commitGeometry((o) => overlayWithPlacements(o, diagram.id, placements));
      },

      applyTidyResult(
        { placements, domainGroups, canvas, edgeRoutes, partial, routingError },
        amend,
      ) {
        const diagram = currentDiagram();
        if (!diagram) return overlayVersionRef.current;
        // `commit`, never `commitGeometry`: a tidy — and an auto-layout, which is
        // one — routes as its own final step, so bumping here would queue a second
        // pass to fight the 'clear' policy it just ran under.
        return commit((o) => {
          let next = overlayWithPlacements(o, diagram.id, placements);
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
              next = overlayWithLayoutConfig(next, diagram.id, nextConfig);
            }
          }
          // U-edge-2: Tidy now carries ELK's computed orthogonal edge routes, so
          // tidied edges route AROUND the relaid-out nodes instead of cutting
          // through them. For every edge ELK routed with bends, PERSIST those
          // waypoints (resetting the label anchor so the chip re-centres on the
          // new polyline). Every OTHER manual route on the effective diagram — an
          // edge ELK routed straight, or a cross-zone/unrouted edge ELK never
          // touched — is CLEARED back to default floating routing (U1 behaviour),
          // since Tidy reflowed the nodes under it. All folded into THIS commit so
          // the whole Tidy stays one undo step. `diagram` is the merged effective
          // diagram, so `edgeRoutes` below is the union of persisted +
          // session-pending content routes.
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
              next = overlayWithEdgeRoute(next, diagram.id, {
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
              next = overlayWithEdgeRoute(next, diagram.id, clearedRoute(route));
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
            for (const route of diagram.edgeRoutes ?? []) {
              next = overlayWithEdgeRoute(next, diagram.id, clearedRoute(route));
            }
          }
          return next;
        }, amend === undefined ? undefined : { amend });
      },

      setDomainGroup(elementId, domainGroup) {
        const diagram = currentDiagram();
        const placement = diagram?.placements.find((p) => p.elementId === elementId);
        if (!diagram || !placement) return;
        commit((o) => overlayWithPlacement(o, diagram.id, { ...placement, domainGroup }));
      },

      setDomainGroups(elementIds, domainGroup) {
        const diagram = currentDiagram();
        if (!diagram) return;
        const targets = elementIds
          .map((id) => diagram.placements.find((p) => p.elementId === id))
          .filter((p): p is DiagramPlacement => Boolean(p));
        if (targets.length === 0) return;
        commit((o) => {
          let next = o;
          for (const placement of targets) {
            next = overlayWithPlacement(next, diagram.id, { ...placement, domainGroup });
          }
          return next;
        });
      },

      connect(sourceId, targetId, sides) {
        if (sourceId === targetId) return undefined;
        const diagram = currentDiagram();
        const connection: DesignConnection = {
          id: ids.connection(),
          sourceId,
          targetId,
          isBidirectional: false,
        };
        commitGeometry((o) => {
          const next = overlayWithConnection(o, connection);
          // Alt-connect: the side(s) dragged from/to, in the SAME commit as the
          // line. A bend-less `auto` row — the router's to fill in, under the sides.
          if (!diagram || !sides || !hasFixedSide(sides)) return next;
          return overlayWithEdgeRoute(next, diagram.id, {
            connectionId: connection.id,
            waypoints: [],
            source: 'auto',
            ...routeSides(sides),
          });
        });
        setSelection(selectConnection(connection.id));
        return connection.id;
      },

      reconnect(id, endpoints, sides) {
        if (endpoints.sourceId === endpoints.targetId) return;
        const diagram = currentDiagram();
        const connection = currentModel().connections.find((c) => c.id === id);
        if (!connection) return;
        const stored = diagram ? routeFor(diagram, id) : undefined;
        commitGeometry((o) => {
          const next = overlayWithConnection(o, { ...connection, ...endpoints, id });
          if (!diagram || !sides || !hasFixedSide(sides)) return next;
          // Only the end(s) the drag fixed change; the other keeps whatever it had.
          return overlayWithEdgeRoute(next, diagram.id, routeWithSides(stored, id, routeSides(sides)));
        });
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
        commitGeometry((o) => {
          let next = o;
          for (const element of remapped.elements) next = overlayWithElement(next, element);
          for (const placement of remapped.placements) {
            next = overlayWithPlacement(next, diagram.id, placement);
          }
          for (const connection of remapped.connections) {
            next = overlayWithConnection(next, connection);
          }
          return next;
        });
        setSelection({
          elementIds: remapped.elements.map((e) => e.id),
          connectionIds: remapped.connections.map((c) => c.id),
          domainGroups: [],
        });
      },

      updateConnection(id, patch) {
        const connection = currentModel().connections.find((c) => c.id === id);
        if (!connection) return;
        commit((o) => overlayWithConnection(o, { ...connection, ...patch, id }));
      },

      deleteConnection(id) {
        commitGeometry((o) => overlayWithConnectionDeleted(o, id));
        setSelection(EMPTY_SELECTION);
      },

      deleteSelection(selection) {
        if (isSelectionEmpty(selection)) return;
        const model = currentModel();
        const diagram = currentDiagram();
        commitGeometry((o) => {
          let next = o;
          for (const elementId of selection.elementIds) {
            next = overlayWithElementDeleted(next, model, elementId);
          }
          for (const connectionId of selection.connectionIds) {
            next = overlayWithConnectionDeleted(next, connectionId);
          }
          // Groups ride along in the SAME commit, so Delete over a mixed
          // selection stays one undo step and one save round-trip.
          if (diagram && diagram.kind === 'layer7' && selection.domainGroups.length > 0) {
            next = overlayWithGroupsRemoved(next, diagram, new Set(selection.domainGroups));
          }
          return next;
        });
        setSelection(EMPTY_SELECTION);
      },

      removeFromDiagram(elementId) {
        const diagram = currentDiagram();
        if (!diagram) return;
        commitGeometry((o) => overlayWithPlacementRemoved(o, diagram.id, elementId));
        setSelection(EMPTY_SELECTION);
      },

      deleteFromModel(elementId) {
        commitGeometry((o) => overlayWithElementDeleted(o, currentModel(), elementId));
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
        commit((o) =>
          hasPlacedContent({ waypoints, labelPosition, pinned })
            ? // A hand edit CLAIMS the route (intent rule 10). Written in the same
              // commit as the waypoints, so nudging one auto line and keeping it is
              // a single undo step in either direction — and from here on no
              // automatic pass may replace it.
              overlayWithEdgeRoute(o, diagram.id, {
                connectionId,
                waypoints,
                labelPosition,
                source: 'manual',
                pinned,
                ...sides,
              })
            : hasFixedSide(sides)
              ? // Nothing a person PLACED is left, only where the line attaches. The
                // row stays for its sides, but as the router's: a manual side-only
                // row would be preserved straight by every pass, for ever.
                overlayWithEdgeRoute(o, diagram.id, {
                  connectionId,
                  waypoints: [],
                  labelPosition: undefined,
                  source: 'auto',
                  ...sides,
                })
              : // The last bend went and nothing else was ever stored: the delete
                // marker, so the line is a plain floating edge again and the router
                // may have it. Stamping THIS `manual` would leave a label-less,
                // bend-less row that every automatic pass then preserves forever.
                overlayWithEdgeRoute(o, diagram.id, {
                  connectionId,
                  waypoints: [],
                  labelPosition: undefined,
                }),
        );
      },

      setEdgeLabelPosition(connectionId, position) {
        const diagram = currentDiagram();
        if (!diagram) return;
        const stored = routeFor(diagram, connectionId);
        const waypoints = stored?.waypoints ?? [];
        const pinned = stored?.pinned;
        const sides = routeSides(stored);
        commit((o) =>
          // A dragged chip claims the route exactly as a dragged bend does. This
          // is the case the old waypoint-presence heuristic could not see at all:
          // a label-only route carries no waypoints, so it looked like nothing.
          // Resetting the chip of a row that then holds only its sides hands the
          // line back to the router (see `setEdgeRoute`).
          overlayWithEdgeRoute(o, diagram.id, {
            connectionId,
            waypoints,
            labelPosition: position,
            source:
              hasPlacedContent({ waypoints, labelPosition: position, pinned }) || !hasFixedSide(sides)
                ? 'manual'
                : 'auto',
            pinned,
            ...sides,
          }),
        );
      },

      setRouteSource(connectionId, source) {
        const diagram = currentDiagram();
        if (!diagram) return;
        const stored = routeFor(diagram, connectionId);
        if (!stored) {
          // Nothing stored and nothing to unpin.
          if (source === 'auto') return;
          commit((o) =>
            overlayWithEdgeRoute(o, diagram.id, {
              connectionId,
              waypoints: [],
              labelPosition: undefined,
              source: 'manual',
              pinned: true,
            }),
          );
          return;
        }
        const next: EdgeRoute =
          source === 'manual'
            ? { ...stored, source: 'manual', pinned: true }
            : // Dropping the pin may leave the row without content, in which case
              // this IS the delete marker and the row goes — a straight line that
              // is no longer pinned has nothing left to say.
              {
                connectionId,
                waypoints: stored.waypoints,
                labelPosition: stored.labelPosition,
                source: 'auto',
                // The sides stay: unpinning gives the geometry back, not the constraints.
                ...routeSides(stored),
              };
        commit((o) => overlayWithEdgeRoute(o, diagram.id, next));
      },

      setRouteSides(connectionId, sides) {
        const diagram = currentDiagram();
        if (!diagram) return undefined;
        const stored = routeFor(diagram, connectionId);
        const row = routeWithSides(stored, connectionId, sides);
        // A no-op — the side it already had, or Automatic on a line with no row —
        // commits nothing, so it costs no undo step and queues no pass.
        if (stored ? edgeRoutesEqual(stored, row) : !hasRouteContent(row)) return undefined;
        const write = (o: ModelOverlay) => overlayWithEdgeRoute(o, diagram.id, row);
        // The same two roads as `resetEdgeRoute`: live routing follows a geometry
        // bump by itself; otherwise the caller runs the pass and amends through
        // the token.
        return diagram.autoRoute ? commitGeometry(write) : commit(write);
      },

      resetEdgeRoute(connectionId) {
        const diagram = currentDiagram();
        if (!diagram) return overlayVersionRef.current;
        const clear = (o: ModelOverlay) =>
          overlayWithEdgeRoute(o, diagram.id, {
            connectionId,
            waypoints: [],
            labelPosition: undefined,
          });
        // With live routing on, the geometry bump is what queues the reroute that
        // brings the line back routed; off, the caller runs that pass itself and
        // the plain commit hands it the token to amend into.
        return diagram.autoRoute ? commitGeometry(clear) : commit(clear);
      },

      setZoneSize(zone, size) {
        const diagram = currentDiagram();
        if (!diagram || diagram.kind !== 'layer7') return;
        const current = diagram.layoutConfig ?? {};
        const next: DiagramLayoutConfig = {
          ...current,
          zones: { ...current.zones, [zone]: { size: clampZoneSize(zone, size, current) } },
        };
        commit((o) => overlayWithLayoutConfig(o, diagram.id, next));
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
        // members back inside — one commit, one undo step.
        const zones = { ...current.zones };
        for (const zone of RESIZABLE_ZONES) {
          const stored = current.zones?.[zone]?.size;
          if (stored === undefined) continue;
          zones[zone] = { size: clampZoneSize(zone, stored, { ...current, canvas }) };
        }
        const next: DiagramLayoutConfig = { ...current, canvas, zones };
        const elementsById = new Map(currentModel().elements.map((e) => [e.id, e]));
        commit((o) => {
          let overlay = overlayWithLayoutConfig(o, diagram.id, next);
          for (const placement of diagram.placements) {
            const element = elementsById.get(placement.elementId);
            if (!element || !placement.zone || placement.zone === 'landscape') continue;
            const moved = clampPlacementIntoZone(placement, element.kind, next);
            if (moved) overlay = overlayWithPlacement(overlay, diagram.id, moved);
          }
          return overlay;
        });
      },

      resizePlacement(elementId, rect) {
        const diagram = currentDiagram();
        const placement = diagram?.placements.find((p) => p.elementId === elementId);
        if (!diagram || !placement) return;
        commitGeometry((o) =>
          overlayWithPlacement(o, diagram.id, {
            ...placement,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          }),
        );
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
        commitGeometry((o) => {
          let next = overlayWithLayoutConfig(o, diagram.id, { ...current, domainGroups: groups });
          for (const placement of diagram.placements) {
            if (!members.has(placement.elementId) || placement.domainGroup === rect.name) continue;
            next = overlayWithPlacement(next, diagram.id, { ...placement, domainGroup: rect.name });
          }
          return next;
        });
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
        const moved = diagram.placements
          .filter((p) => p.domainGroup === name)
          .map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
        commitGeometry((o) => {
          let next = overlayWithPlacements(o, diagram.id, moved);
          next = overlayWithLayoutConfig(next, diagram.id, { ...current, domainGroups: groups });
          return next;
        });
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
        commit((o) => {
          let next = overlayWithLayoutConfig(o, diagram.id, {
            ...current,
            domainGroups: groups,
          });
          for (const placement of diagram.placements) {
            if (placement.domainGroup !== oldName) continue;
            next = overlayWithPlacement(next, diagram.id, {
              ...placement,
              domainGroup: trimmed,
            });
          }
          return next;
        });
      },

      setAutoRoute(on) {
        if (propsRef.current.readOnly) return;
        const diagram = currentDiagram();
        if (!diagram || (diagram.autoRoute ?? false) === on) return;
        // Straight into the overlay and out through `emitBatch`, bypassing
        // `commit` — the only push point onto the undo stack. A mode is not
        // content: undoing a node move must not switch live routing off.
        overlayRef.current = overlayWithAutoRoute(overlayRef.current, diagram.id, on);
        bumpOverlayVersion();
        emitBatch(overlayRef.current);
      },

      removeDomainGroup(name) {
        const diagram = currentDiagram();
        if (!diagram || diagram.kind !== 'layer7') return;
        commitGeometry((o) => overlayWithGroupsRemoved(o, diagram, new Set([name])));
        setSelection((s) =>
          s.domainGroups.includes(name)
            ? { ...s, domainGroups: s.domainGroups.filter((n) => n !== name) }
            : s,
        );
      },
    };
  }, [commit, bumpGeometry, bumpOverlayVersion, emitBatch]);

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
      ? effectiveModel.elements.find((e) => e.id === selection.elementIds[0])
      : undefined;
  const selectedConnection =
    soleKind === 'connection'
      ? effectiveModel.connections.find((c) => c.id === selection.connectionIds[0])
      : undefined;
  const selectedDomainGroup = soleKind === 'domainGroup' ? selection.domainGroups[0] : undefined;

  // Keep selection honest when a selected item disappears from the model (e.g.
  // a delete confirmed by the server). Prunes the vanished ids, keeping the
  // rest of a multi-selection intact.
  useEffect(() => {
    setSelection((current) =>
      pruneSelection(current, effectiveModel, propsRef.current.activeDiagramId),
    );
  }, [effectiveModel, props.activeDiagramId]);

  return {
    effectiveModel,
    selection,
    setSelection,
    selectedElement,
    selectedConnection,
    selectedDomainGroup,
    actions,
    geometryVersion,
    overlayVersion: overlayVersionRef.current,
    // The host's stack when it has one (see `onUndo` in props.ts), otherwise the
    // editor's own over the content it can see.
    undo: props.onUndo ?? undoLocal,
    redo: props.onRedo ?? redoLocal,
    // Recomputed each render; commit/undo/redo all bump `setOverlayVersion`, so
    // these track the live stack depth for the toolbar buttons.
    canUndo: props.onUndo ? props.canUndo === true : pastRef.current.length > 0,
    canRedo: props.onRedo ? props.canRedo === true : futureRef.current.length > 0,
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

function recordSnapshots(
  batch: ReturnType<typeof buildBatch>,
  elements: Map<ElementId, EmittedElementSnapshot>,
  connections: Map<string, EmittedConnectionSnapshot>,
): void {
  for (const element of batch.elements) {
    if (!isTempId(element.id)) continue;
    const placement = batch.placements.find((p) => p.elementId === element.id);
    elements.set(element.id, {
      tempId: element.id,
      kind: element.kind,
      name: element.name,
      placement: placement
        ? { diagramId: batch.diagramId, x: placement.x, y: placement.y }
        : elements.get(element.id)?.placement,
    });
  }
  for (const connection of batch.connections) {
    if (!isTempId(connection.id)) continue;
    connections.set(connection.id, {
      tempId: connection.id,
      sourceId: connection.sourceId,
      targetId: connection.targetId,
      label: connection.label,
      protocol: connection.protocol,
      isBidirectional: connection.isBidirectional,
    });
  }
}

/**
 * What a Tidy leaves of a route it did not route: the bends and the chip go —
 * they were measured against positions that no longer exist — but the attach
 * sides stay, because a constraint is not measured against anything. A row kept
 * for its sides alone is the router's (`auto`); with no sides this is the plain
 * delete marker, exactly as before.
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
 * Carry the non-content lanes of the overlay across an undo or a redo.
 *
 * `diffToOverlay` synthesises a patch from a CONTENT snapshot, so every lane the
 * undo stack does not track comes back empty — and undo/redo replace the overlay
 * wholesale rather than merging into it. Without this, a pending auto-route
 * toggle would simply vanish on the next Cmd+Z, which is worse than it sounds:
 * the overlay entry is what is still travelling to the server, so the mode would
 * silently revert to whatever the base says.
 *
 * Modes are deliberately outside content history (see `setAutoRoute`), and
 * "outside history" has to mean carried across it, not dropped by it.
 */
function withModeLanes(next: ModelOverlay, previous: ModelOverlay): ModelOverlay {
  return previous.autoRoutes.size === 0 ? next : { ...next, autoRoutes: previous.autoRoutes };
}

/**
 * Drop domain-group rects by name and clear their members' membership — the
 * shared body of `removeDomainGroup` and the group half of `deleteSelection`,
 * so both stay a single commit. The member ELEMENTS survive; they just stop
 * belonging to a group (removing a box is a layout edit, never a data delete).
 */
function overlayWithGroupsRemoved(
  overlay: ModelOverlay,
  diagram: DesignDiagram,
  names: Set<string>,
): ModelOverlay {
  const current = diagram.layoutConfig ?? {};
  let next = overlayWithLayoutConfig(overlay, diagram.id, {
    ...current,
    domainGroups: (current.domainGroups ?? []).filter((g) => !names.has(g.name)),
  });
  for (const placement of diagram.placements) {
    if (!placement.domainGroup || !names.has(placement.domainGroup)) continue;
    next = overlayWithPlacement(next, diagram.id, { ...placement, domainGroup: undefined });
  }
  return next;
}

/**
 * Remap tempIds to their reconciled server ids across the id-bearing selection
 * arrays. Domain groups are keyed by name, not by id, so they never remap.
 */
function remapSelection(
  selection: Selection,
  result: { elementAliases: Map<string, string>; connectionAliases: Map<string, string> },
): Selection {
  if (isSelectionEmpty(selection)) return selection;
  let changed = false;
  const remap = (ids: string[], aliases: Map<string, string>) =>
    ids.map((id) => {
      const mapped = aliases.get(id);
      if (mapped) changed = true;
      return mapped ?? id;
    });
  const elementIds = remap(selection.elementIds, result.elementAliases);
  const connectionIds = remap(selection.connectionIds, result.connectionAliases);
  return changed ? { ...selection, elementIds, connectionIds } : selection;
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
