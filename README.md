# Lionsville Architecture Management Tool

An architecture modelling tool. It draws an **application landscape in Layer-7
bands** and the **C4 container diagrams underneath it**, edits both, and saves
them to a file. No account, no backend, no telemetry: your design lives on your
own machine and goes no further than you send it.

It runs as a desktop app on macOS, Windows and Linux, and in a browser from
source.

![The Acme Logistics example open in the desktop app: an application landscape
in Layer-7 bands, with domain groups, lifecycle badges, routed connections and
the right-click menu of a connection open](docs/screenshot-landscape.png)

*The shipped example, `Acme Logistics` — a fictional landscape you can open,
copy and take apart.*

## Download

**[Download the desktop app →](https://github.com/Lionsville/Lionsville-Architecture-Management-Tool/releases/latest)**

| Platform | File |
|---|---|
| macOS (Apple Silicon) | `…-mac-arm64.dmg` — signed, notarized |
| Windows (x64 / ARM64) | `…-win-x64.exe`, `…-win-arm64.exe` — signed installers |
| Linux | `…-linux-x86_64.AppImage`, `…-linux-amd64.deb` — unsigned |

The desktop app checks that release page for a newer version in the background
and installs it the next time you quit. Releases are still pre-1.0: the
capabilities below all work, the format keeps opening older files, but expect
rough edges.

Prefer a browser, or want to change something? See
[Running from source](#running-from-source).

## What it does

### Two levels of diagram

- **The Layer-7 landscape.** Five bands — actors, input channels, external
  systems, the application landscape, the management layer — with elements
  placed in them and **domain groups** boxing the ones that belong together.
  Bands and groups resize; groups have their own colour and can be tidied on
  their own.
- **C4 container diagrams.** Double-click an application to open the container
  view underneath it, or to create one. The application becomes the boundary of
  that view and its components sit inside. Each landscape keeps a list of the
  container views under it, and you can step back up from any of them.

### Elements

Seven kinds: application, component, external system, input channel, management
tool, actor, and the domain group that holds them. Each carries a name,
category, vendor, technology, a markdown description, an accent colour, an icon
and a **lifecycle** — planned, live, retiring, retired — which shows as a badge
on the card (retired elements are dimmed, and the badges can be switched off for
a clean export). Elements also carry **operational aspects** — managed, partial,
at risk — for the parts of a landscape that are about who runs what.

Elements are model-level: an element exists whether or not it is placed on a
diagram, one element can appear on more than one, and removing it from a diagram
is a different action from deleting it from the model. The search (⌘F) finds
elements by name, category or vendor across the whole design, including the ones
not currently on a board.

### Connections

Draw one by dragging between elements or from the right-click menu's *Start
connection to…*. A connection carries a label, a protocol (EDI, Kafka, REST —
whatever you type), a direction that sets the arrowheads, a colour and a line
style.

Lines are routed orthogonally by a real router — libavoid compiled to
WebAssembly, running off the main thread — so they route around elements rather
than through them, and re-route when you move something. When automatic is not
what you want, take over: drag a segment, add or remove bend points, **pin** a
route so nothing moves it again, choose which **side** of an element each end
attaches to, and drag the label off its default position. All of that survives a
re-layout, a reload, and a round trip through the working file.

### Layout you can hand off or keep

**Tidy layout** runs an ELK pass over the diagram with a direction (across,
down, or hybrid: groups across and the applications inside each one down), a
density, and pins for the things you have already placed by hand — anchor
points, group placements, group contents, the container boundary. There is also
a **route-only** pass that leaves every element where it is and just redraws the
lines.

By hand: align and distribute a selection, a grid with optional snapping, nudge
with the arrow keys (finer with Shift), a minimap, and fit-view.

### Icons and logos

Around a hundred built-in marks, sorted into data, integration, applications,
platform, security and operations, rail and vendors — searchable, and settable
for a whole selection at once. You can upload your own SVG or PNG, which joins
an "uploaded" category in the picker.

### Editing, in general

Right-click menus on everything — element, connection, canvas, domain group,
selection, diagram tab — each offering what that thing can actually do.
Multi-select with a rubber band or Shift-click, then edit lifecycle, colour,
icon or domain group for all of it in one undo step. Undo and redo over the
whole session. Rename in place with F2. Copy, cut, paste, duplicate. Resizable
palette and inspector panels. A keyboard-shortcut overlay that is generated from
the same table that dispatches the keys, so it cannot drift.

There is a **read-only** mode that hides every mutating control rather than
disabling it.

### Projects, and the groups they sit in

Projects are listed in a picker: yours, and the examples that ship with the app.
A project is filed under a **group** — a customer, a department, a programme,
whatever the namespace is called where you work — and both the project's name
and its group can be changed afterwards. The list sorts alphabetically, or by
what you changed most recently.

Examples are **copied** into a project of your own when you open one; nothing
you do runs against an example in place.

### Saving, exporting, sharing

Three ways out, for three different purposes:

- **The working file (`.lvarch`)** — everything: topology, geometry, styling,
  uploaded logos, pinned routes and attach sides. This is what you save to keep
  working, and the file to hand to someone who will edit it.
- **The interchange document** — topology and semantics only, no geometry and no
  styling. This is the form for review and for version control: a diff shows
  what changed about the architecture rather than what moved on the canvas.
- **PNG export**, with a title block carrying client, title, author, date and
  the aspect legend.

Reading is broad and writing is narrow: a key this tool does not understand
survives a round trip untouched, and files written by older builds keep opening.

### Two languages, three themes

Dutch and English, switchable at any moment, covering menus, dialogs, band
names, errors and the export title block — not a partial translation. Light,
dark and system themes.

## Where your work is kept

Projects and preferences are stored locally by the app itself (in the desktop
build and in the browser alike), and the working file is the durable artefact —
the thing to keep, back up and share. If local storage refuses — a private
window, a strict policy — the session falls back to memory: everything works and
nothing is left behind, which is what opening such a window asked for. The
status bar says so once.

On boot the app reopens the project you had open, or shows the picker.

## Running from source

Node 20 or newer. Internet is needed once, for `npm install`; everything after
that is local.

```bash
npm run setup && npm run dev
```

Then open http://127.0.0.1:5200. `npm run setup` installs both trees — this repo
and the editor package under `vendor/solution-design`, which has its own
`node_modules`.

For the desktop app: `npm run dev:desktop` runs it against the Vite dev server,
`npm run smoke:desktop` builds it and drives the real production bundle through
nine checks in a real window, and `npm run dist:desktop` packages it (unsigned,
locally).

## The loop

```bash
npm run check
```

~6 seconds: typecheck and lint of the shell and the desktop main process, plus
the shell's 512 tests. Run it after every change; it is fast on purpose.

```bash
npm run check:all
```

~30 seconds: adds the editor package's 1509 tests, its typecheck and lint, and a
production build. Run it once before handing work back, and before any push that
touches `vendor/`.

```bash
npm run verify
```

~40 seconds: everything `check:all` does, then the desktop build and the desktop
smoke run — every step run to the end, one table, one exit code. The gate before
a push, made so an agent can run it without deciding anything. `npm run smoke`
is the last two steps on their own.

Other commands: `npm run test:watch`, `npm run build`, `npm run preview`. The dev
server is also declared in `.claude/launch.json` as `editor-dev`.

## How it is put together

Two halves, and the boundary between them is the reason both stay workable.

- **`vendor/solution-design/`** — the editor package. React Flow canvas, the
  model, layout, routing (libavoid on WebAssembly, in a worker), i18n, PNG
  export. It takes a `model` prop, emits a `DiagramContentBatch`, and knows
  nothing about storage, dialogs or backends. A fork, maintained here.
- **`src/`** — the shell around it: state, dialogs, storage, files, preferences.
  Almost every task lands here.

The shell has layers, and dependencies point inward:

```
src/core/       decisions and arithmetic — no React, no browser, no IO
src/ports/      the seams: ProjectStore · PreferencesStore · DocumentGateway
src/adapters/   the outside world, one folder per flavour
src/ui/         React
src/examples/   starting points that ship with the app. Data, not config.
src/composition.ts   the only file that knows both a seam and its filling
src/main.tsx    the composition root — read its header first
electron/       the desktop main process and preload
```

Four ESLint rules enforce that rather than a convention: `core` and `ports` may
not import React, MUI or an adapter; `ui` may not import an adapter; browser
globals are an error outside `src/adapters/`. If a rule blocks you, the design is
telling you something — move the code, do not route around it.

Adding a different place to keep things is a class under `src/adapters/`, the
shared behaviour suite (`src/ports/ProjectStore.contract.ts`) run over it, and
one branch in `composition.ts`. Nothing above the seam changes.

`CLAUDE.md` carries the full map, including a "where does my change go" table
and the names that are settled.

**There is no customer in this codebase** — an organisation is a *group*, which
is data a user creates, not a name compiled into the code. If you find one in an
identifier, a storage key or a default filename, that is a bug.

## Groups and projects, in the store

A project is addressed by a **group path** plus a key, and the store holds many:

```
lvarch.project.acme-logistics/warehouse-landscape
lvarch.project.acme/rail/rolling-stock
```

Groups are derived from the projects filed under them — there is nowhere to keep
an empty one — so creating a group and creating a project are separate actions.
A rename edits the model and leaves the ref alone; a move changes the ref, and
is save-then-remove in that order.

## The user manual

In two languages, one file each: [docs/manual.en.md](docs/manual.en.md) and
[docs/manual.nl.md](docs/manual.nl.md). It covers projects and groups, the
workspace, drawing, elements, connections, layout, the documentation page,
diagram settings, saving and sharing, and the shortcuts worth knowing.

## Files worth knowing

| Path | What it is |
|---|---|
| `CLAUDE.md` | How to work in this repo: the layer map, the loop, the conventions, the settled names |
| `docs/release.md` | Cutting a release: the procedure, the thirteen secrets, what has gone wrong before |
| `vendor/solution-design/` | The editor package, source and tests |
| `src/main.tsx` | The composition root; its header states the pattern |
| `src/composition.ts` | Which adapter the shell gets |
| `src/core/project.ts` | What a project is: open, save, order, summarise |
| `src/ports/ProjectStore.contract.ts` | The behaviour every store must show |
| `electron/main/index.ts` | The desktop main process; its header states what is load-bearing |
| `build/libavoidWasm.ts` | Publishes the router's wasm; fails a build, not a shipped app |
| `docs/manual.en.md`, `docs/manual.nl.md` | The user manual, in English and in Dutch |
| `LICENSE` | The licence |

## Licence

**GNU Affero General Public License v3.0** — see `LICENSE`. Copyright ©
2024–2026 Lionsville Group BV.

The Affero clause is the one to read before deploying: if you run a modified
version of this tool where other people can reach it over a network, those
people are entitled to its source. Running it unmodified, or modifying it for
yourself, carries no such obligation.

The router is `libavoid-js`, which is LGPL-2.1-**or-later** and therefore
usable here under LGPL-3.0. Its wasm is published beside the app under its own
unhashed name so that a self-built replacement can be dropped in, which is what
that licence asks for; see `build/libavoidWasm.ts`. Other dependencies
installed through npm are under their own licences.
