# @lionsville/solution-design

The customer solution-design diagram editor: a Layer 7 landscape (Lionsville's
enriched C4 System Landscape) plus C4 container diagrams, rendered with
React Flow and themed from the host's MUI theme (light **and** dark).

Source-only workspace package (`main: src/index.ts`, no build step), consumed
by `hal_app`. It never talks to a backend and never imports HAL code —
integration happens exclusively through props (see the host contract below).

References: `docs/specs/11-solution-designs.md`,
`docs/intent/solution-designs.md` (the Layer 7 zone grammar is an invariant),
`docs/plans/2026-06-10-solution-design/foundation/2026-06-10-solution-design-plan.md` (Phase 2b pins the public API).

## Architecture

```
src/
├── index.ts            Public API — everything else is internal
├── types.ts            Contract types (mirror the API save contract)
├── editor/             Shell: SolutionDesignEditor, toolbar, inspector,
│                       delete dialog, useEditorState (the state brain).
│                       Owns the two docked side panels — the palette on the
│                       left, the inspector on the right — as flex siblings
│                       of the canvas, so collapsing either reflows for free
├── canvas/             DiagramCanvas (shared React Flow wiring),
│                       Layer7Canvas (zone bands + domain groups + drop
│                       assignment), ContainerCanvas, ZoneLayer,
│                       DomainGroupLayer, ElementPalette (+ paletteItems,
│                       its copy and group metadata; domainGroupPlacement,
│                       the naming/clamping rules shared by Place and drop).
│                       A click OPENS (a row, or a rail icon which expands the
│                       panel at that row); a drag PLACES — logo, name and (on
│                       the domain group) colour are edited in the tray
├── nodes/              One component per element kind + the application-as-
│                       boundary node (container diagrams), all built on one
│                       NodeShell (wrapper, selection ring, retired dim,
│                       resizer, 4-side handles, lifecycle badge, icon slot).
│                       The icon library lives here too: logoRegistry (data +
│                       resolver), PathMark (the one renderer), marks/ (the
│                       records), LogoGrid (the picker)
├── edges/              FloatingEdge + pure closest-side routing math
├── i18n/               strings.ts (the nl/en table + pure `t`) and
│                       LanguageContext (`LanguageProvider`, `useStrings`).
│                       English is the no-provider default, on purpose
├── model/              PURE functions: overlay/merge/batch/reconcile,
│                       zone hit-testing, placement math, temp ids, graph
│                       projection, panel widths, element search — this is
│                       where the unit tests live
├── theme/              MUI palette → node tokens (no hardcoded hex except
│                       one documented exception: the category hash palette),
│                       EUR formatting
├── layout/             ELK wrapper (lazy-loaded) + zone-aware "tidy"
└── export/             PNG export with title block (drawn on export only)
```

Design principles:

- **The model prop is the source of truth.** The editor renders
  `mergeModel(model, overlay)` where the overlay holds only local,
  not-yet-reflected edits. No internal copy of the document, no localStorage.
- **Pure core.** Everything that can be a pure function is one
  (`model/`, `edges/floatingEdgeMath.ts`, `theme/categoryColors.ts`), so the
  interesting logic is unit-tested without a DOM.
- **Zone grammar is fixed** (`model/zones.ts`): actors top, input channels
  left, external systems right, management bottom, landscape centre. Band
  *sizes* are adjustable per diagram (drag a band's inner edge; persisted via
  `layoutConfig.zones`). Dragging an element reassigns the placement's `zone`
  via centre-point hit-testing; landing inside an explicit domain-group
  rectangle (`layoutConfig.domainGroups`) assigns `placement.domainGroup` by
  containment. Groups are created from the palette and moved/resized/renamed
  (double-click the label) on the canvas.
- **Manual edge routing** (`model/routes.ts`): double-click an edge to add a
  waypoint at the cursor (rounded polyline through the ordered points,
  endpoints stay floating); drag waypoints; the line's context menu adds and
  removes bend points. Routes live per (diagram, connection) in
  `DesignDiagram.edgeRoutes`. Any selected line shows its handles (bend
  squares, segment pills — counter-scaled so they keep their screen size at any
  zoom); the first hand edit marks the route `manual`, and Pin / Unpin / Reset
  to automatic live in the inspector's Route section and the line menu.
  Each end may carry a fixed **attach side** (`EdgeRoute.sourceSide` /
  `targetSide`: `'top' | 'right' | 'bottom' | 'left'`), set from the inspector
  (Leaves from / Arrives at), the line menu (Attach at ▸ Source / Target) or by
  Alt-dragging a connection from a specific side handle. Both render branches
  honour it (`floatingEdgeMath.routeEndLeg`, the `assignEdgeAnchors` per-edge
  override) and the libavoid router pins the end to that side
  (`ShapeConnectionPin`, see `layout/libavoidRouter.ts`). A side on its own is
  route *content* (`hasRouteContent`) but not a hand edit: it survives
  re-routing and Tidy, and `Automatic` clears it.
- **One context menu** (`canvas/menuItems.ts` decides, `canvas/ContextMenu.tsx`
  draws, `canvas/useMenuActions.ts` dispatches): right-click an element, a
  line or bend handle, a domain group, a diagram tab or the empty canvas;
  Shift+F10 / the Menu key open it for the current selection, F2 renames it.
  The builder is pure and table-tested; every item shows its keymap chord, and
  read-only mode keeps only the navigation entries. Layer 7 wires the
  group-specific entries (tidy, colour, inline rename) through
  `DiagramCanvasProps.onMenuAction`; everything else is one shared dispatcher.
- **Configurable aspects** (`model/aspects.ts`): the badge row and the
  inspector aspects editor render from the diagram's `aspectConfig` (ordered
  key+label, superset `ASPECT_SUPERSET` + custom slugs), falling back to the
  original five (`DEFAULT_ASPECT_CONFIG`). Element aspects are
  `Record<string, { status, note? }>`; the note shows in the badge tooltip,
  and the export title block lists the configured aspects as a legend row.
- **Bilingual UI** (`i18n/strings.ts`): one flat table with a Dutch and an
  English column, keyed by `keyof typeof EN` — so an English key nobody
  translated is a *type* error rather than an English sentence on a Dutch
  screen. `t(language, key, params?)` is pure; `useStrings()` reads the
  language from context. **The default with no provider is English**, which is
  why the pure label tables (`canvas/menuItems`, `model/zones`,
  `editor/keymap`, `canvas/paletteItems`) take an optional `Translate` and keep
  saying exactly what they said before — and why the whole test suite reads as
  English without a word of setup. `SolutionDesignEditor` takes `language` and
  `onLanguageChange`; wiring the latter is what puts the NL/EN toggle in the
  toolbar, so a host that owns the language elsewhere gets no rival control.
  Zone captions, menus, dialogs, tooltips, errors and the PNG title block all
  follow it; `theme/format.ts` takes the language for its currency locale.
- **Find, and room to work** (4B): ⌘F opens `ElementSearchDialog` over the pure
  `model/elementSearch.ts` (name / category / vendor / technology, folded case
  and accents, hits on the current diagram first) and focuses through the same
  `useFocusElement` path the host's `focusElement` prop uses. The palette has
  its own filter, matching **both** languages' labels so a Dutch architect can
  type English product words. The minimap is a toolbar toggle, off by default.
  Both side panels have a 6 px drag seam (`editor/PanelResizer` over
  `usePointerDrag`); widths are clamped by `model/panels.ts`, remembered in
  `EditorPreferences`, reset by double-click, and adjustable with the arrow
  keys — the seam is a `role="separator"` with `aria-valuenow`.
- **Bulk edit and kind change** (4B, low priority): the multi-selection
  inspector sets lifecycle / accent colour / icon / domain group across a
  selection in one commit each (`updateElements`, `setDomainGroups`); its
  controls are deliberately write-only, because a mixed selection has no current
  value to show. `changeElementKind` is its own action rather than a wider patch
  type: the rules live in `model/kindChange.ts` (refused for an application a
  container diagram is about, and for a component still holding a
  `parentApplicationId`), and the placement follows the new kind — home band and
  size limits both change — in the same commit.
- **Keyboard** (4B): nodes are focusable (React Flow's `nodesFocusable`), Tab
  cycles them behind a `:focus-visible` ring drawn from `tokens.card.focusRing`
  — a different hue from the selection ring, because focus and selection
  routinely disagree — and Enter selects the focused node (Shift+Enter adds).
  `disableKeyboardA11y` stays ON so the keymap keeps owning the arrow keys; RF's
  own arrow move is visual-only and would double every nudge. Shortcut dispatch
  moved to a document-level capture listener gated on this editor being visible
  and the target being inside it, so ⌘Z fires from an inspector button and not
  only from the canvas.

## Host contract (what hal_app must do)

1. **Render inside a sized container.** The editor fills 100%/100%.
2. **Map DTOs ↔ `DesignModel`** with all ids stringified. Placements are
   embedded per diagram.
3. **Debounce `onChange`.** The editor emits a full `DiagramContentBatch` on
   every mutation (plan suggests ~800 ms debounce + flush on unmount).
   Batches are cumulative and idempotent: element/connection upserts repeat
   until the host's refreshed model reflects them, `placements` is always the
   full set for the active diagram. `edgeRoutes` are upserts per connection —
   an entry with empty `waypoints` deletes the stored route. `layoutConfig`
   is present only when touched this session and is upserted whole.
   Debounce per `diagramId`.
4. **Save → refresh → set the `model` prop.** Apply the API's
   `ElementIdMap`/`ConnectionIdMap` to your own state, then pass the refreshed
   content as a new `model`. Also accumulate those maps into the `idAliases`
   prop (`elements`/`connections`, tempId → real id) — reconciliation resolves
   temp ids from these maps first and only falls back to heuristic matching
   for ids the maps don't cover. See the merge strategy below.
5. **Temp ids.** New items carry `tmp-…` ids (`createTempId`/`isTempId`).
   When mapping a batch to the API save request: a temp element id goes into
   `SaveElement.TempId`; temp references go into `ParentApplicationTempId`,
   `SourceTempId`, `TargetTempId`. Temp ids never appear in
   `deletedElementIds`/`removedPlacementElementIds` (the server never saw
   them).
6. **Slots.** `renderInspectorExtras(element)` → CM line links + ADR sections;
   `renderDesignPanelExtras()` → coverage/ADR panel trigger (toolbar);
   `parameterSpecs(element)` → which commercial parameters to edit per kind;
   `decorations` → link counts, € price, drift/dangling/unlinked warnings;
   `renderMarkdown(md)` → description preview rendering (falls back to a
   plain `<pre>` without it).
7. **Click-to-focus.** `focusElement: { id, nonce }` (coverage drawer):
   bump `nonce` to make the editor select the element and pan/zoom to it.
   If the element is only placed on another diagram, the editor calls
   `onActiveDiagramChange(diagramId)` first and completes the focus once you
   update `activeDiagramId`. Unplaced elements are a no-op. Keep the same
   nonce across unrelated re-renders — each nonce is handled exactly once.
8. **Navigation.** Double-clicking an application (or its menu's "Open
   container diagram") opens its container diagram (`onActiveDiagramChange`)
   or asks the host to create one (`onCreateContainerDiagram`).
   `onCreateLayer7Diagram` backs the "+" tab. Each Layer 7 tab lists the
   container diagrams of the applications placed on it behind a small chevron.
   Diagram management from a tab's right-click menu is opt-in per callback:
   `onRenameDiagram(id, name)` receives the new name (the editor collects it in
   its own dialog), `onDuplicateDiagram(id)` and `onDeleteDiagram(id)` are
   requests the host fulfils — confirm, copy, decide what becomes active. The
   editor disables Delete for the last remaining landscape.
9. **Export.** The toolbar button downloads a PNG (title block from
   `exportTitleBlock` + diagram name + date + configured-aspects legend).
   `exportDiagramPng(options)` is also exported for host-driven export flows.
10. **Scope cost chip.** Pass `scopeSummary` (estimate, note, linked T&S
    monthly total) to show a corner chip on layer7 diagrams. The host composes
    it from the diagram's `estimatedMonthlyCost`/`costEstimateNote` and its
    scope-level link totals.
11. **Fullscreen.** Provide `onOpenFullscreen` to get a toolbar button; render
    the fullscreen view yourself (typically the editor again with
    `readOnly` — read-only mode hides the palette, resize/route handles and
    all mutating affordances).
12. **Icon library.** The package ships ~100 built-in marks (`nodes/marks/`):
    hand-authored generic category marks (data, integration, applications,
    platform, security & operations), a rail domain set with Dutch keywords, and
    real vendor marks from the CC0 `simple-icons` package. All are single 24×24
    `currentColor` paths drawn by one `PathMark`, so they inherit the node's ink
    in both themes and under the per-element accent override. `LOGO_ENTRIES`,
    `LOGO_CATEGORIES`, `isBuiltInLogoKey` and `searchLogos` are exported for a
    host that needs the vocabulary (see `iconType` below) or wants its own picker
    filtering by the same rule. Every element kind has an icon slot, at two sizes
    (`DesignElement.iconSize`: absent = the ≈14 px header mark, `large` = a 28 px
    mark leading the body).

    On top of them sits the host's **uploaded** library: pass `logoLibrary`
    (`{ key, label, url }` per mark) and, to offer an upload affordance,
    `onRequestLogoUpload`. The package never fetches: it renders the `url` you
    give it in an `img` — and only ever in an `img`, since an uploaded SVG
    inlined into the DOM could carry a script. Namespace uploaded keys `lib:`;
    the resolver then looks in your library FIRST for those and at the built-ins
    first for everything else, so neither side can shadow the other. A key that
    resolves to neither falls back to the element's kind glyph rather than
    breaking the diagram (intent rule 9) — which is also what makes an unknown
    `iconType` from another tool harmless. Prefer handing over data URLs: HAL's
    content endpoint needs a bearer token that an `img` cannot send, and a data
    URL also survives PNG export without a fetch. On a dark theme a full-colour
    uploaded mark gets a light backing plate (`tokens.card.logoPlate`), because
    brand marks are drawn for white paper. `onExportImagesMissing` reports marks
    the export could not embed — worth surfacing, because the PNG still succeeds
    and looks finished.

13. **View preferences.** Snap, the dot grid, lifecycle badges, panel collapse
    and the two Tidy option sets are the editor's own state. Seed them with
    `initialPreferences` (read once, on mount — they are preferences, not a
    controlled value) and persist them from `onPreferencesChange`, which fires
    only on a real change (value equality, not identity), so writing straight to
    storage from it is safe. `initialPreferences` takes `unknown`: every field
    falls back to the package default on its own, so a stale or hand-edited blob
    costs that field and not the editor. `EditorPreferences`,
    `DEFAULT_EDITOR_PREFERENCES`, `mergePreferences` and `preferencesEqual` are
    exported. The package owns no storage of its own — hosts disagree about
    where a preference belongs (this browser, a user profile, nowhere).
14. **Swapping the document under the editor.** Bump `historyResetToken`
    whenever you replace the whole document while keeping the same diagram ids
    (opening a file, reverting to a shipped one). It clears the undo/redo stacks,
    the pending overlay and the selection — undo steps are diffs against a model
    that has just been thrown away, and without this ⌘Z can restore content from
    the previous document. A host that remounts the editor instead does not need
    it; a host that changes the SET of diagram ids must still remount, because
    the once-per-session settling pass (`useAutoLayout`) is keyed by diagram id.
15. **Deletes the editor stops for.** Deleting one connection or a whole
    multi-selection now opens a confirmation naming what goes, including the
    connections that die with an endpoint without having been selected
    (`model/deletion.ts`). A single element keeps its richer remove-from-diagram
    / delete-from-model dialog, a group-box-only selection is still a silent
    layout edit, and Cut is deliberately not confirmed — the content is on the
    clipboard. All of it is internal to the editor; the host sees only the
    resulting batch.

## Merge strategy (in-flight edits vs refreshed models)

Implemented in `model/overlay.ts` (strategy), `model/merge.ts` (application)
and `model/reconcile.ts` (clearing) — unit-tested in `model/*.test.ts`.

- Every local mutation lands in an immutable **overlay** and immediately emits
  a batch. The rendered document is always `mergeModel(model, overlay)`;
  **local uncommitted changes win** over whatever the host supplies.
- When a new `model` prop arrives, the editor **reconciles**:
  - Overlay entries whose incoming value is field-equal made the round trip →
    dropped.
  - Entries that differ are newer in-flight edits → kept (they keep winning;
    last-write-wins is accepted for v1).
  - **Temp-id resolution:** the host's `idAliases` maps are consulted first —
    an authoritative tempId → real-id entry wins outright. For ids the maps
    don't cover, created items are matched heuristically against elements
    that are *new* in the incoming model using the snapshot of what was last
    emitted (kind + name, tie-broken by placement distance; connections by
    resolved endpoints + label) — heuristics alone can't tell identical twins
    apart, which is exactly why the id maps take priority. On a match the
    overlay is re-keyed to the real id, so edits made while the save was in
    flight survive seamlessly.
  - A temp item deleted locally after its save already landed is converted to
    a real-id delete and re-emitted automatically.

## Testing

```bash
npm run test -w @lionsville/solution-design     # Vitest, node env
npm run typecheck -w @lionsville/solution-design
npm run lint -w @lionsville/solution-design
```

Model/theme/edge tests run in the fast `node` environment; the editor smoke
test opts into jsdom per-file (`// @vitest-environment jsdom`, same convention
as hal_app) using the React Flow mocks in `editor/reactFlowTestSetup.ts`.

## Notable defaults

- Palette-created actors / external systems / input channels start
  `isManaged: false` (they are outside Lionsville's operational scope by
  definition, so they never produce false coverage warnings); applications,
  components and management tools start managed.
- Category strip colours come from a stable FNV-1a hash (`theme/categoryColors.ts`)
  so the same category keeps its hue forever — pinned by tests.
- PNG exports default to a white background with a fixed-ink title block so
  they drop cleanly into documents; the toolbar passes the live theme
  background instead.
- The UI language defaults to English (`language` prop absent) and the title
  block's captions default to English with it — a host calling
  `exportDiagramPng` directly gets the block it always got.
- The minimap is off, the palette opens at 232 px and the inspector at 320 px
  (`model/panels.ts`), all three remembered through `EditorPreferences`.
