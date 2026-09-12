# The road to 2.0.0

*The working plan for ADR-0012 — the federated model. ADR-0012 says what is
built; this says in what order, what each stretch touches, and what "done"
means for it. It is kept current: strike a line when it lands, and change the
order when the work says so. `git log` stays the ground truth.*

Four betas, then the release. Each beta is a prerelease on the `beta`
channel (ADR-0006), cut from `main` when its stretch is whole, with
`npm run verify` green and the fictional example exercising everything the
beta adds. The stable that follows is 2.0.0 — cut when a second real
organisation has run on the last beta for a fortnight without a finding
that changed the model.

The discipline does not change: `npm run check` after every change, small
commits that say why, `verify` before a push that ends a stretch. Every
string lands in all four languages (`en`, `nl`, `fy`, `de`) in the same
commit as the screen that says it. Every pure function gets a test; every
port gets a contract; every budget line is written before the code it
times.

---

## Beta 1 — the model underneath

*Ships the business sheet, on one scope, so the thing this was all for is on
screen first. Steps 1–3 were built behind format 3 through shims; step 4 turns
the format and deletes them.*

**The rule on formats, decided 12 September 2026:** 2.x may break the file
format as often as the model needs, as long as every older format opens and
migrates. A 1.x build meeting a 2.x file fails to open it, which is the honest
answer. No shim is kept for the sake of an older build; a shim exists only
until the format that makes it unnecessary is written.

### 1. Relations with a type — landed 10 September 2026 (4f4615f…5d2a3d6)

`DesignConnection` → `Relation` (`model/types.ts`): `type: 'flow' | 'supports'
| 'serves' | 'realises' | 'assigned'`, `validFrom`/`validUntil` on every row,
`protocol` and `isBidirectional` meaningful on `flow` only.

- `model/normalised.ts`, `commands.ts`, `reducer.ts`, `activity.ts`,
  `diff.ts`, `equality.ts`, `clipboard.ts`, `restore.ts`, `porting.ts`,
  `lifecycle.ts`/`transition.ts` (windows on any row), `textSearch.ts`.
- **The file keeps `connections`** until format 4: `toArrays` writes a
  `flow` as a connection and refuses to write any other type at format 3 —
  as a `ShellError` key, so a beta-1 user cannot make a file a 1.x build
  misreads. `fromArrays` reads every connection as a `flow`.
- Interchange: unchanged; `toInterchange` exports `flow` rows only.
- Agent: `connect` / `connection.*` keep their names and mean `flow`;
  `relation.add` / `relation.update` / `relation.remove` arrive for the rest.
- Done when: the byte-for-byte round trip still passes; every kind of row
  survives `apply` → undo; a `supports` row with a window shows on the
  roadmap as a hatched span.

### 2. Views apart from geometry — landed 10 September 2026 (01222e1…5d40a67)

`DesignDiagram` gains `members`, `groups` (with ids), `lines`; loses
`placements[].zone`, `placements[].domainGroup`, `layoutConfig.domainGroups`.
`Geometry` becomes its own type: `nodes`, `groups`, `routes`, `canvas`,
`zones`, `needsLayout`.

- `model/placement.ts` reads membership from `members` and geometry from
  the geometry type; the editor's props (`editor/props.ts`) are handed both.
- **The files keep their v3 shape** through a shim in `projects/folderFormat.ts`:
  on read, `members` is derived from placements and groups get ids minted
  from their names; on write, both are folded back. The shim is one
  function pair with a test that pins "read then write is the bytes you
  started with", and it is deleted at format 4.
- `model/diff.ts`: geometry as a count, membership as a sentence — the
  split the format was always meant to give history.
- Done when: a rename of a dashed group is one line in the definition; a
  drag is one line in geometry; `describeProjectStore` passes unchanged.
- Left standing for step 4: a group's colour is the one thing format 3
  cannot carry for a group that has no box, because the format keeps the
  colour on the rectangle. Nothing in the app can make one, and the fold
  says so out loud rather than dropping it quietly.

### 3. The business layer — landed 12 September 2026 (eca944c…9b21896)

**The model half landed 12 September 2026 (eca944c…581c776).** The kinds, the
fields, the format-3 fold, `src/business/`, the export's report and the
agent's vocabulary. What is left of this step is the half that draws: the
`sheet` view, `ui/SheetPage.tsx`, `ui/FunctionInspector.tsx`,
`business/sheet.ts` (the laid-out page), `diagram.render` for a sheet, and the
example's journey and areas. Four things the next stretch has to know:

- **Format 3 cannot hold the business layer, and says so rather than
  flattening it.** `asStoredElement` throws `element.notInThisFormat` for a
  `step`, a `function` or a `process`, the way `asConnections` already throws
  for a `supports` row. **Answered 12 September: step 4 turns the format.**
  Until it lands, the sheet is tested over a hand-built model and the
  example's business content waits for the format-4 example form.
- **A sheet is a fourth diagram kind and nothing knows it yet.** `canPlaceKind`
  answers `ok` for any kind on a view that is not `layer7` or `container`,
  which is the right default for a laid-out view and is not a rule about
  sheets; `toInterchange` writes a diagram's kind through unchanged.
- **`business/` has no `strings/` slice**, because nothing in the model half
  says a word to anybody. The page brings the first one, and with it a line in
  `i18n/strings.en.ts` and its three siblings.
- **A `parentId` that would make a loop is refused by `business/tree.wouldCycle`
  and nothing calls it yet.** The gesture that re-parents is the sheet's; the
  agent may not reach `business` and so cannot re-parent at all, which is why
  `element.update` does not offer `parentId`.

**The sheet half landed 12 September 2026 (51a631d…52f4d82).** `DesignDiagram`
gained the `sheet` kind with `journeyId`, `lanes`, `areas` and `showActors` and
no geometry at all; `business/sheet.ts` lays the page out in rows and depths the
way the roadmap works in days; `ui/SheetPage.tsx` draws it and
`ui/FunctionInspector.tsx` edits one thing on it, re-parenting included, with a
loop offered and refused rather than hidden; `app/useSheet.ts` is the wiring —
its tab sits in the editor's own strip and *Business architecture* is under the
`+`, while the active diagram stays a board, so the canvas is never unmounted
for it. For an agent, `diagram.inspect` answers a sheet's rows instead of its
geometry, `diagram.render` a PNG of the whole page, and tidy and route are
refused as questions about the model. Two notes for whoever picks this up: the
matrix gained `agent` → `business`, and the page needs nothing from the editor's
theme, because its whole design is MUI palette tokens.

**The example's half landed 12 September 2026 (9b21896), and step 3 with it.**
Acme Logistics has the layer above its applications: *Ship a consignment* in
seven phases, a key-account lane that forks at *Quote* and a marketplace
partner's that runs from outside, five areas with their capabilities, the
stakeholders as a tree with the four the landscape already drew under
*Employees*, and `supports` / `assigned` / `serves` rows joining the two layers.
Four roots carry no domain and land in the *not yet mapped* band. Three things
worth knowing:

- **The sheet is tested over the example now, not only over a fixture.**
  `examples.test.ts` lays the shipped page out and asserts in rows — seven
  phases, three lanes with the common one first, the derived forks and
  pass-throughs, five areas, a band of four, and all three coverage answers
  present. `business/testFixtures.shippingScope()` stays what the module's own
  suites are written over; a fixture and an example answer different questions.
- **Two `supports` rows carry a window**, because that is the half of ADR-0012
  §5 a page cannot show without data: the legacy rater supports *Rating* until
  the day it goes, and Yard Management does not support *Yard and dock* until it
  is live.
- **`parentId` on the landscape's four actors moves nothing.** Every reader of
  it in `editor/` and `layout/` is guarded by `kind === 'component'`, and a test
  in `examples.test.ts` builds the board with and without the field and compares
  the geometry rather than leaving that to a reading.

Still nothing a person can do on a page makes a `supports` row — the sheet shows
coverage and does not edit it, which is step 12's to give it.

Kinds `actor` (a tree, `outside`), `step`, `function`, `process`;
`parentId` replaces `parentApplicationId`; `order` where order is a
decision. `externalSystem`, `inputChannel`, `managementTool` are read from a
v3 file as `application` + `outside` / + zone, and written back the same way
until format 4 (the same shim rule as step 2).

- `src/business/` — a new module beside `roadmap/`, pure at the root:
  `tree.ts` (children, depth, order, the refuse-a-cycle check), `sheet.ts`
  (the laid-out page: journey band with one row per lane and the fork, join
  and pass-throughs derived from where a lane has steps; area columns; the
  unmapped band — in geometry not pixels, the roadmap's *days not pixels*
  rule), `coverage.ts`
  (0..n `supports`, `assigned` only = manual, neither = uncovered).
  `ui/SheetPage.tsx` draws it; `ui/FunctionInspector.tsx` edits one.
- `editor/` learns to *not* place a business kind on a landscape, and to
  draw an `application` in the zone its member row says.
- The palette offers *application* and the view offers *where*.
- Import matrix: `business` may import `model`, `i18n`, `widgets`,
  `documentation` (a process's page); never `editor`, `projects`, `app`.
- `src/app/examples/acme-logistics.json`: a journey (*Ship a consignment*)
  with two lanes beside the common row — a key account on a project, and a
  marketplace partner that fulfils — nine areas, the functions the existing
  applications support, a stakeholder tree with two `outside` branches, one
  manual function, one uncovered one.
- **The export says what it leaves out.** `toInterchange` carries `flow`
  rows only (the interchange is a contract with tools that know nothing of
  the business layer), so from this step on a scope can hold rows an export
  does not. The interchange export — the dialog, and `project.export` for
  an agent — reports the count and kinds of relations left out, as a value
  the caller renders; never silently, never as a refusal. Pinned by a test.
- Done when: the sheet renders the example on one screen with no geometry
  file; `diagram.render` produces it for an agent; the roadmap hatches a
  `supports` window; an export of the example says it left out its
  `supports` rows.

**3c — a person can author the sheet — landed 12 September 2026.** Beta 1 drew
the business architecture and offered nothing to make it with: the only authors
were the example's JSON and an agent, and the first person to test the beta hit
that in the first minute. Every band now has its own *+* — a journey with its
first phase, a phase, a step on any row, a lane (its actor made on the spot if
need be, with the step that makes its row appear), an area, a grouping, a
capability, a stakeholder — each one `Command`, undoable, with an Activity line,
and each one selecting what it made with the cursor in its name so the gesture
is click, type, Enter. *Supported by…* and *Done by…* on a capability write the
`supports` and `assigned` rows a person could previously only get from an agent,
which is the half of step 12 that could not wait. *Delete* is refused as a value
while something is inside it — nothing cascades. *What this sheet draws* is the
four fields a sheet is made of, including which journey a scope with two of them
draws. Three things worth knowing:

- **A leaf is a leaf at any depth** (`business/sheet.ts`). A function straight
  under an area used to draw as a grouping box with nothing in it, which is what
  *+ capability* on an area would have made; a grouping is now a child of an
  area that holds something, and an emptied one reads as a card again. The
  agent's sheet report carries an area's own leaves for the same reason.
- **A lane is still derived.** `addLane` writes an actor and a step, and nothing
  else: `lanes` on the diagram is the *order* of the rows, and a row exists
  because a step names the actor. A lane whose last step goes stops being drawn,
  with nothing to tidy up.
- **A coverage link lands where the element is drawn.** `model/drawnOn.ts`
  answers which boards hold it *and* draw it on their own day, so the two
  landscapes in the example stop sending a person to a board that does not have
  it; when none does, the element's own page opens instead.

### 4. Format 4 — the model's own shape, written — landed 12 September 2026 (6691380…ccf5de7)

The file says what the model says. The three folds in
`projects/folderFormat.ts` and `model/relations.ts` — connections ↔ typed
relations, placements ↔ members + geometry, the retired kinds ↔ application +
band — go, and with them every "refuses to write at format 3" refusal.

- `model.json`: `elements` with the six kinds and their fields (`parentId`,
  `order`, `lane`, `outside`, `partyId`), `relations` with a `type` per row.
  `diagrams/<id>.json` with `members`, `groups`, `lines`;
  `diagrams/<id>.geometry.json` with numbers only. `project.json` stays
  (scopes are beta 2's turn) and says `formatVersion: 4`.
- **Opening a format-3 folder migrates it**: an explicit pass in
  `projects/migration.ts` — snapshot first where the folder has git, every
  project rewritten, `.placements.json` removed by the pass. The pass is the
  three folds' read halves, run once, and then deleted from the format. Pinned
  by a test over a v3 fixture tree that holds all three retired kinds, a
  dashed group, a manual route, and a connection with a window. Browser
  storage gets the same pass over its keys.
- `workingFile.ts`: `.lvarch` v4 is a format-4 project zipped; v1–v3 open and
  migrate. `isWorkingFile` and `hostModel.test.ts` pin what is refused.
- The shipped example moves from the interchange form to the working form,
  because the interchange cannot carry a business layer and the example is
  about to have one (step 3's second half fills it).
- The interchange export is untouched — it is a contract — and keeps saying
  what it left out.
- Done when: a v3 fixture opens, migrates, and writes format 4; a format-4
  folder round-trips byte-for-byte; the `.lvarch` v1–v4 fixtures all open;
  `describeProjectStore` passes; no fold remains in `folderFormat.ts`.

**Landed**, and four things the next stretch should know:

- **The migration is a pass, and it needs no preference to remember it.**
  `ProjectStore` gained one optional clause — `outdated()`, beside
  `pressure()` — because which of its projects an older build wrote is a
  question only a store can answer. The folder store reads one header per
  project; the browser store asks the model, since a key there has no version.
  An empty answer is the whole guard, so a v3 project dropped into the folder
  in a month is migrated in a month. Beta 2's format 4 → 5 pass hangs off the
  same seam: `upgradeProjects(store, record)` in `projects/migration.ts`.
- **Two behaviours flipped, deliberately.** A deleted geometry file means "lay
  it out again" over a membership list that is still whole, where at format 3
  it emptied the board; and restoring one diagram to a snapshot changes both
  of its files, because what is on a view is the definition's now.
- **The example is the folder, as JSON by path** — an object per `.json`, an
  array of lines per `.md` — with its plans and decisions inside it as files
  rather than beside it in TypeScript. Its content is unchanged; step 3's
  second half fills in the business layer by editing that file.
- **The interchange round trip kept its document.** The old example moved to
  `model/testing/interchange-sample.json`, because a test that another tool's
  format survives a round trip must not be fed by our own export.

### 5. Strings, manual, screenshots — landed 12 September 2026 (cc92bd4)

Every new word in four languages; `docs/manual.*.md` gets *The business
architecture*; a screenshot of the sheet beside the landscape one.

The words landed with the screens that say them, as the discipline at the top of
this file asks. The manual's section is beside the roadmap's and at the same
length: what a sheet is and why it is laid out, the journey and the lanes
derived from where their steps are, the three coverage answers, the not-yet-
mapped band, and what the inspector edits.

**Two things this did not do.** `docs/manual.*.md` is `en` and `nl`: the UI has
had four languages since 087f58f but the manual has only ever had two, and two
whole translated manuals is its own piece of work rather than a line in this
one. And the screenshot needs a browser, so both manuals carry a marker where it
goes — as does the README, whose `screenshot-landscape.png` is the one it should
sit beside.

- The screenshot landed 12 September 2026: `docs/screenshot-sheet.png`,
  the example's sheet in the browser build, dark theme, 2× — in the README
  beside the landscape and in both manuals. Taking it found the capability
  cards drawing their names in the browser's `buttontext` black on the dark
  ground; fixed in the same stretch.

**Cut 2.0.0-beta.1** — cut 12 September 2026 from `3af5dad`.

---

## Beta 2 — scopes

*Format 5. The one deliberate, whole commit with the migration in it. ADR-0012
§11 numbers this turn 4; the model's own shape took 4 first (step 4 above),
and the ADR's *Built* note at 2.0.0 will say so.*

### 6. One document shape — landed 12 September 2026 (513a925…164b137)

`scope.json` replaces `project.json` and `group.json`; `ScopeStore`
replaces `ProjectStore` + `GroupStore` (`ports/ScopeStore.ts`, its contract
with the two new clauses: a scope's children, and a reserved name refused);
`ProjectRef` becomes a path (`projects/scopePath.ts`); `GroupProfile`,
`groupsOf`, `model.customerName`, the `folder.json` organisation section and
`projects/organisation.ts` go.

- Adapters: `fileSystem/`, `webStorage/`, `memory/`, `desktop/` — one
  store each over the same contract; the browser-storage tree keeps the
  same paths as keys.
- `projects/migration.ts` grows the **format 4 → 5 pass**: snapshot first
  where there is git; every scope rewritten; `project.json`, `group.json`,
  removed by the pass; ids left as they are (collisions are beta 3's
  finding, not this pass's problem). Pinned by a test over a
  fixture tree that covers a nested group, a group with a profile, a project
  with a decision per application, and a working file inside the folder.
- `workingFile.ts`: `.lvarch` v5 is a scope zipped; v1–v4 still open.
- Desktop: the window title reads the root's `scope.json`; the File menu's
  *Recent* is scopes; the smoke run writes a tree and reads it back.
- Done when: the migration test's fixture tree round-trips; `describeScopeStore`
  passes on all four adapters; a 1.x folder opens, migrates, and every
  landscape in it draws as before.

**Landed**, and six things the next stretch should know:

- **A scope with no views reads.** That is the one clause of ADR-0003 that
  moved: a folder with no diagrams used to answer `undefined`, and a domain is
  exactly such a folder — refusing it would hide its decisions, its documents
  and everything filed under it. Whether the canvas can show one is the shell's
  question (`isOpenableScope`), and the picker declines to enter one.
- **`list()` answers a tree**, root included, always — a store with nothing in
  it answers with a root that has no children, which is what makes "there is
  nothing here yet" a screen rather than a failure. `ScopeSummary` carries the
  path, the name, the `kind` label, the `client`, the description, the links,
  a count of views and the children. **That count is the only one**: it comes
  off `scope.json`, which a listing already reads, and anything else would cost
  a second file per scope on every open. The organisation screen's finding
  lines will need more than a summary can answer cheaply — either a load per
  card, or a widening of this with its own budget line.
- **The group's decisions are the parent scope's**, read up the tree (§7) and
  written back to it. `groupDecisions` keeps its name through the editor, the
  search and the agent: collapsing the three ADR lists into `subjectId` is beta
  3's, and renaming them without changing what they mean is churn.
- **Creating a scope creates the ones above it.** A folder with no `scope.json`
  is not a scope, so a child filed under one would be filed under nothing. The
  4 → 5 pass does the same for a group format 4 never made a record of, and for
  the root, whose name was `folder.json`'s `organisation` key — read once and
  then taken away.
- **The example is two scopes and one model.** An organisation above a
  landscape; the model is NOT split, because every `supports` row joining a
  capability to an application would dangle at one end and the stand-ins that
  resolve a cross-scope id are §2's. The split that costs nothing is a name
  above a document.
- **What kept its name, deliberately.** The module `projects/`; `ProjectOrder`
  and the `projectOrder` preference, which is a person's setting and would
  silently reset if renamed; `ProjectHistory`, which is ADR-0008's vocabulary;
  and `ProjectWorkspace`, `ProjectPicker` and `ProjectSettingsDialog`, which
  step 7 is about to replace.

### 7. The organisation screen — landed 12 September 2026 (d512688…9d35ef3)

Replaces the picker (`src/app/picker/` → `src/app/organisation/`). The
design is on the canvas beside this plan: the root scope's home — its name,
client, links and description at the top; its own pages (business
architecture, register, decisions, roadmap) as cards with one finding line
each; the scope tree beneath, ordered by name or by change, with *New
scope…* under any node; examples last.

- `useOrganisation` hook: what the screen may do, which dialog is up,
  where a person lands on leaving — the *wiring is a hook* rule.
- Settings for any scope is the same dialog at every level (name, kind
  label, client, description, links).
- Done when: the screen's tests cover open, create-under, rename, remove
  (save-then-remove order kept), and a fresh folder with nothing in it.

**Landed**, and five things the next stretch should know:

- **`InitialPage` is new shell vocabulary**, and it is what made the cards
  possible at all. The root usually draws nothing, so *Open* on a card enters
  the root and tells the workspace which page to show the moment it appears;
  closing that page on a scope with no views leaves, rather than landing a
  person on "diagram not found". `App` owns the type, because one screen says
  it and the other obeys it. A `sheet` with no id is seeded through the
  session (`sheets.create`), so making one is one undo step and one Activity
  line rather than a write from the screen.
- **The card counts are one `load(root)`, and the ADR-0012 §6 note about
  widening `ScopeSummary` did not need answering.** Every number on the three
  real cards is about the root's own document, so the screen loads the one
  scope it is about — `organisationPages`, pure and node-tested — and the
  listing stays exactly as cheap as it was. The hook reads the root only while
  its screen is up (`active`), so nothing loads a whole model behind a canvas.
- **The register card is drawn and empty on purpose.** Title, one sentence, no
  count, no *Open*. When §8's index lands it is the only card that has to
  change.
- **A move is reachable from the first screen now**, which the settings dialog
  grew a *Filed under* field and a kind picker for. `ScopeStore.remove` takes
  the subtree with it, so every scope under the one being moved is saved at its
  new address before the old folder is removed; `projects/scope.movedPaths`
  says which addresses, and the order is pinned by a test rather than left to a
  reading.
- **`unmappedFunctions` and the roadmap's two label tables are published now.**
  The *not yet mapped* rule was inline in `sheetPage` and the plan statuses and
  finding sentences were private to their pages; a second screen saying the
  same words is what the "publish a table, not a key" rule is for
  (`business/sheetDiagram.ts`, `roadmap/labels.ts`).

One thing deliberately left: `readOnly` is still not a state this screen has.
The honest signal that a store will not take a write is the standing storage
notice along the bottom, and a second one that guessed would hide affordances
that work.

**Cut 2.0.0-beta.2.**

---

## Beta 3 — one identity

### 8. Organisation-wide ids and the index

`idPolicy` takes the tree's taken set. `projects/index.ts`: the index built
from every scope's `model.json` — definitions (id → name, kind, master path,
declaring paths), stand-ins (id → drawing paths) — with a budget line in
`model/testing/` for twenty scopes of a few thousand elements. The watcher
invalidates it. A session holds it read-only.

### 9. `ref`, the checks, and `mayEdit`

`Element.ref`; the checks of ADR-0012 §9 as one `checks.ts` in `business/`
or `projects/` — conflict, drift, dangling, unmapped, proposal, uncovered,
unattributed, master drawn nowhere — each a value with a key and a place it
is drawn. `mayEdit(id, scope)` refuses as a value; the inspector shows the
owning scope and offers to open it.

### 10. The register page and the four gestures

The register page at the root (derived, with the findings); *link*,
*promote*, *demote*, *transfer* — the other scope written first, confirmed,
and the stack refusing to undo past a two-scope step.

### 11. History across scopes

`historyPath` for an id is the union of its files across the tree; the
history page's subject picker offers *everywhere this is drawn*.

**Cut 2.0.0-beta.3.**

---

## Beta 4 — the map, and the agent

### 12. The enterprise map

The `map` view: functions × applications from `supports`, rolled up across
scopes through the index; *people* as a column; *uncovered* as the gap.

### 13. The agent at every scope

`scope` on every tool; `register.list`, `scopes.list`, `checks.list`; URIs
`lvarch://<scope path>/element/<id>`; `diagram.render` for a `sheet` and a
`map`. `docs/decisions/0011` gets a *Built* note.

### 14. BPMN

A renderer for the ```bpmn fence, registered in `documentation/`'s fence
table. Read-only first.

**Cut 2.0.0-beta.4.**

---

## 2.0.0

- `docs/decisions/0012` gets its *Built* preamble with the departures from
  the text, the way 0010 has one.
- `CLAUDE.md`: the module map (`business/`, `ScopeStore`, the index), the
  names table (`scope.json`, `.geometry.json`, format 4, working file v4),
  *State of play*.
- The manual, in four languages, with the organisation screen and the map.
- Release notes covering every beta.

## What is deliberately not in this plan

- A repository store, an ArchiMate import, a permissions model beyond
  `mayEdit` and `CODEOWNERS`, a stack that spans two scopes, and an export
  that inlines stand-ins into a subtree's `.lvarch`. Each is an open
  question in ADR-0012 and stays one until 2.0.0 has been used.
