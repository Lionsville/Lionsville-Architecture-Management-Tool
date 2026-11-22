# ADR-0049 — A feature may be composed of features, below the shell

* Status: accepted, 22 November 2026; implemented, 22 November 2026 (4.1.0, not yet released)
* Date: 2026-11-22
* Deciders: Wouter Simons
* Extends: ADR-0001 (the modules and the matrix between them)

ADR-0001 stands: one tree, in modules, and who may import whom is a matrix,
declared as data and generated into one rule per module. This record adds a
tier to it and takes nothing away.

## Context and Problem Statement

The matrix has two kinds of row. A feature — decisions, the roadmap, the
people register, the editor — may import the model, the words, the kit and
the few features under it. The shell, `app`, may import everything, and
nobody imports `app`.

So only the shell may know two features at once. A screen that is made of
several — the organisation chart, which draws units, people, the operating
model and a plan's moves; a scope's home, which reads the register, the
checks, the topics and the views of every kind — has had one place it could
live, and that is the shell. Two folders inside `app/` grew that way until
they held more screens than the shell proper, and more than most features.

What that costs:

* **The matrix says nothing inside `app/`.** A chart file may import the
  frame, the boot or the workspace, and nothing refuses it; a loop between a
  screen and the shell's wiring is invisible, because both ends are one module.
* **A screen there is only testable as part of the shell**, or by convention,
  since nothing says which of the shell's files it may lean on.
* **The shell is not readable as the shell.** The frame, the boot, the
  composition and the wiring are the smaller part of what the folder holds.
* **A build composed from this one** can name a feature by its module and the
  shell by its seams, and has no way to name a screen that sits between them.

## Decision Drivers

* The shell is the frame, the boot, the composition and the wiring, and
  nothing else.
* A screen composed of features is held by the matrix like any other module:
  a row, a sentence, a floor.
* No loop is possible between composed modules, by construction rather than
  by a test finding one.
* What a composed screen needs of the window reaches it through something
  the matrix can see, not through an import of the shell.
* No screen changes, no address, no control name, no string key.

## Considered Options

1. **A tier between the features and the shell: a seam the window fills, and
   composed modules over it in a fixed order.**
2. **One composed module with a subfolder per screen.** Rejected: one row
   would grant every screen in it every feature any of them uses, and the
   subfolders could import each other freely, which is the state this leaves.
3. **Widen the features' rows**, so the chart lives in `people` or
   `operating` and a home in `projects`. Rejected: `projects` may not import
   React, and a feature that imports five others to draw one screen is no
   longer the feature its row describes.
4. **Leave them in `app/` and hold the folder with rules of its own.**
   Rejected: a second matrix inside one row of the first, kept by hand.

## Decision Outcome

Option 1.

### 1. The seam: `session`

`src/session/` is what a window lends the pages drawn in it, and it draws no
page and chooses nothing. It holds:

* a write in another scope, under that scope's rights, and a refusal held
  until the person has read it;
* a finding marked as intended and a mark taken back, from any list;
* what is folded for as long as the window is open;
* a file handed to the person, said once it has been;
* the words the shell and a page say to each other: which page a scope opens
  on, which of a home's pages is asked for, what a scope's settings may
  change, a failure reported, a toast with its undo;
* what a screen tells the frame about itself, and the places a press may go.

It may import the model, the words, the platform, the kit, the ports, the
projects and the agent's vocabulary of screens. The shell fills it: the
contexts are provided there, the hooks are called there with the source's
repositories, and a page reads the result.

### 2. The composed modules, in order

After the seam, in this order in the matrix:

| Module | What it is | Composed of |
|---|---|---|
| `units` | the organisation as units, drawn: the chart, the Conway map, a unit made, moved and deleted | the people register, the operating model, the business sheet's inspector, the editor's panels |
| `guidance` | principles, building blocks and references read over the tree: what a page of any of them is handed, and how a reference is drawn | principles, blocks, decisions, observations, documentation |
| `organisation` | a scope's home and what is read over the whole tree from it: the register, the checks, the topics, who serves it, its settings | the above, and every feature a home lists |

**A composed module may import the features its row names, the seam, and the
composed modules before it in the list. Never one after it**, which is what
makes a loop between them impossible. Only `app` and a composed module later
in the list may import one; no feature may, and none of them may import `app`.

The rows are data in `eslint.config.js` like every other, each with its
sentence.

**They are refused by where a specifier goes, and have no barrel.** Every
other module is refused by its name as a segment of the specifier, which is
exact while no file is called what a module is called. These are called what
the domain calls things, and files already are: `model/units.ts`,
`agent/write/organisation.ts`. So the rule for these four reads the shape of
the path — a specifier that climbs and then goes into the module's folder —
and a composed module has no `index.ts`, because a barrel would be reached by
a specifier (`../units`) the rule cannot tell from such a file. What each is
for is said by its sentence in the matrix and in the module map.

### 3. What stays in the shell

* The frame, the boot, the composition root, the workspace and its bar, the
  history page, the dialogs, the drawing host, the theme, and every hook that
  holds a session, a document, the files, the navigation or the agent.
* **Wiring that names a feature.** A file whose props are the workspace's
  parts or the shell's — the component that draws the chart in a view's tab,
  the one that puts a scope's pages over the open scope — is the shell's, and
  sits beside the workspace it wires into.
* The journeys over the whole app, which are tests of the shell.

### 4. How it is held

* The matrix refuses an import the rows do not allow, in the importing file,
  with the row's sentence. `build/layering.test.ts` asks the linter about
  files that are not there: a composed module importing a feature and the
  seam, the shell refused to all four, a feature refused a composed module,
  the seam refused the modules over it, a file elsewhere that carries a
  composed module's name left alone, and no barrel in any of the four.
* `build/cycles.test.ts` reads the tree for a loop between files and between
  modules, as before; the tier adds no exception to it.
* Each module has a coverage floor of its own (`build/coverage.ts`).

## Consequences

* Four rows, four sentences and four floors more. The shell's folder holds
  the shell.
* A screen of a composed module is mounted in a test with what the seam
  declares and no shell; the tests that do so today still use the shell's
  harness for the theme and the language, which a test may.
* A file that moves keeps its name, its exports, its control names and its
  string keys. The words of a composed module move to a slice of its own,
  key for key.
* The parts the shell hands down (`appProps`, `workspaceProps` and what its
  hooks hand the panels) do not get smaller by this. Each composed module
  declaring the slice it takes, and those files importing the types, is a
  later change.
* A path that named a file under `app/units` or `app/organisation` from
  outside this tree names it under `units` or `organisation` now. The lazy
  parts keep their scripts; a script's name follows its file.

## As built, 22 November 2026

The four modules are in the tree with their rows, sentences and floors, and
`app/` holds the shell: 153 source files where it held 272, and 339 files
with its suites, harnesses and words where it held 534. `units` is 58 source
files, `organisation` 51, `session` 17 and `guidance` 4.

**The rows, as they stand.** Each grants what its files import, and the
three leaves every module may read (the words, the platform, the kit):

| Module | May import |
|---|---|
| `session` | model, i18n, platform, widgets, ports, projects, agent |
| `units` | model, i18n, platform, widgets, people, operating, business, editor, projects, agent, session |
| `guidance` | model, i18n, platform, widgets, documentation, decisions, observations, principles, blocks, projects, session |
| `organisation` | model, i18n, platform, widgets, people, documentation, comments, principles, blocks, decisions, observations, roadmap, business, search, editor, projects, agent, ports, session, units, guidance |

**What the seam holds.** `writeIn` and `writeRefusals`, `useChangeBelow`,
`checkMarking`, `sessionFolds`, `handOver`, `deleteViewBody`; the words the
shell and a page say to each other (`initialPage`, `scopeSettings`,
`homePages`, `reporting`, `sourceSayings`, `activity`); and `frameStore`,
`places` and `recentPlaces`, which a home publishes its facts through and
draws its places from. The shell's files that declared those types export
them as before.

**Three types are said twice, on purpose**, where the seam would otherwise
read a page: the lists a change to a scope below is handed (`WorkBelow`,
beside the observations page's own), a line of the palette (`PaletteLine`,
beside the search dialog's), and nothing else. Each pair is held together by
the compiler at the one place the shell hands one to the other.

**What stayed in the shell that the text above did not name.** The idle
fetch of the scripts a home lists (`app/preloadViews`), because its table
names the drawing host; `app/App` calls it beside `useOrganisation`. A
record's changes on a home are read by the shell from the source's history
and handed in on the home's store, as the workspace does for its readers.
`helpAt` and `savePicture` are used by the shell's wiring alone and did not
move.

**The words.** The shell's slice was cut by key prefix into `units/strings`
(580 keys), `organisation/strings` (671) and `guidance/strings` (8), no key
changed. The 31 keys the shell and the composed modules both say became
`common.` keys: a view made and deleted, a scope created, a scope's four
pages (`common.documentation`, `.decisions`, `.observations`, `.roadmap`),
what deleting a view says (`common.deleteBody.<kind>`), and what a picker
says (`common.pick.<name>`). Four of the old names stay in the shell's slice
with the same words, for a build composed from this one that names them:
`shell.newDiagram`, `shell.decisions`, `shell.observations`, `shell.roadmap`.
Still said across modules by name: the seam's `work.refused…`,
`frame.place.…` and `register.tab…` keys, and a few of `prefs.`, `share.`
and `first.` on a home.

**How the files moved.** Each move is one commit of `git mv` and the
specifiers and listed paths it forces, made by `scripts/moveFiles.mjs` with
its command line in the message; the edits that made a move possible are
commits of their own before it.

**Held.** `build/layering.test.ts` has the cases of §4, the file that carries
a module's name and the missing barrel among them; `build/cycles.test.ts`
passes with no exception added. Floors, the lowest of three runs: session
97/86, units 94/83, guidance 84/61, organisation 88/80.

**Not built, and still as the Consequences say.** The parts the shell hands
down are as wide as they were. The suites of the composed modules use the
shell's harness (`app/testing`) for the theme, the language and axe.
