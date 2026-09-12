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

*Format 3 still. Nothing a user opens changes shape on disk; what changes is
what the model can say. Ships the business sheet, on one scope, so the thing
this was all for is on screen first.*

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
- Left standing for step 5: a group's colour is the one thing format 3
  cannot carry for a group that has no box, because the format keeps the
  colour on the rectangle. Nothing in the app can make one, and the fold
  says so out loud rather than dropping it quietly.

### 3. The business layer

**The model half landed 12 September 2026 (eca944c…581c776).** The kinds, the
fields, the format-3 fold, `src/business/`, the export's report and the
agent's vocabulary. What is left of this step is the half that draws: the
`sheet` view, `ui/SheetPage.tsx`, `ui/FunctionInspector.tsx`,
`business/sheet.ts` (the laid-out page), `diagram.render` for a sheet, and the
example's journey and areas. Four things the next stretch has to know:

- **Format 3 cannot hold the business layer, and says so rather than
  flattening it.** `asStoredElement` throws `element.notInThisFormat` for a
  `step`, a `function` or a `process`, the way `asConnections` already throws
  for a `supports` row — the file has nowhere to put one, and writing a
  `function` as the `application` its figure falls back to would hand a 1.x
  build a row that is a lie. So **the example cannot be saved as a project
  until this is answered**, and the answer is a decision rather than a fix:
  either a `business` key in `model.json` that a 1.x build ignores (the file's
  own lists stay exactly what they were, and the key goes at format 4), or
  beta 1 ships the sheet over a model that is only ever in memory, or step 5
  is brought forward. The interchange is not the same question — it is a
  contract with other tools and correctly leaves the business layer out.
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

### 4. Strings, manual, screenshots

Every new word in four languages; `docs/manual.*.md` gets *The business
architecture*; a screenshot of the sheet beside the landscape one.

**Cut 2.0.0-beta.1.**

---

## Beta 2 — scopes

*Format 4. The one deliberate, whole commit with the migration in it.*

### 5. One document shape

`scope.json` replaces `project.json` and `group.json`; `ScopeStore`
replaces `ProjectStore` + `GroupStore` (`ports/ScopeStore.ts`, its contract
with the two new clauses: a scope's children, and a reserved name refused);
`ProjectRef` becomes a path (`projects/scopePath.ts`); `GroupProfile`,
`groupsOf`, `model.customerName`, the `folder.json` organisation section and
`projects/organisation.ts` go.

- Adapters: `fileSystem/`, `webStorage/`, `memory/`, `desktop/` — one
  store each over the same contract; the browser-storage tree keeps the
  same paths as keys.
- `projects/migration.ts` grows the **format 3 → 4 pass**: snapshot first
  where there is git; every scope rewritten; `project.json`, `group.json`,
  `.placements.json` removed by the pass; ids left as they are (collisions
  are beta 3's finding, not this pass's problem). Pinned by a test over a
  fixture tree that covers a nested group, a group with a profile, a project
  with a decision per application, and a working file inside the folder.
- `workingFile.ts`: `.lvarch` v4 is a scope zipped; v1–v3 still open.
- Desktop: the window title reads the root's `scope.json`; the File menu's
  *Recent* is scopes; the smoke run writes a tree and reads it back.
- Done when: the migration test's fixture tree round-trips; `describeScopeStore`
  passes on all four adapters; a 1.x folder opens, migrates, and every
  landscape in it draws as before.

### 6. The organisation screen

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

**Cut 2.0.0-beta.2.**

---

## Beta 3 — one identity

### 7. Organisation-wide ids and the index

`idPolicy` takes the tree's taken set. `projects/index.ts`: the index built
from every scope's `model.json` — definitions (id → name, kind, master path,
declaring paths), stand-ins (id → drawing paths) — with a budget line in
`model/testing/` for twenty scopes of a few thousand elements. The watcher
invalidates it. A session holds it read-only.

### 8. `ref`, the checks, and `mayEdit`

`Element.ref`; the checks of ADR-0012 §9 as one `checks.ts` in `business/`
or `projects/` — conflict, drift, dangling, unmapped, proposal, uncovered,
unattributed, master drawn nowhere — each a value with a key and a place it
is drawn. `mayEdit(id, scope)` refuses as a value; the inspector shows the
owning scope and offers to open it.

### 9. The register page and the four gestures

The register page at the root (derived, with the findings); *link*,
*promote*, *demote*, *transfer* — the other scope written first, confirmed,
and the stack refusing to undo past a two-scope step.

### 10. History across scopes

`historyPath` for an id is the union of its files across the tree; the
history page's subject picker offers *everywhere this is drawn*.

**Cut 2.0.0-beta.3.**

---

## Beta 4 — the map, and the agent

### 11. The enterprise map

The `map` view: functions × applications from `supports`, rolled up across
scopes through the index; *people* as a column; *uncovered* as the gap.

### 12. The agent at every scope

`scope` on every tool; `register.list`, `scopes.list`, `checks.list`; URIs
`lvarch://<scope path>/element/<id>`; `diagram.render` for a `sheet` and a
`map`. `docs/decisions/0011` gets a *Built* note.

### 13. BPMN

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
