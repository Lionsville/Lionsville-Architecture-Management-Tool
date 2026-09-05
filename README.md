# Lionsville Architecture Management Tool

An architecture modelling tool: a Layer-7 application landscape and the C4
container diagrams underneath it, drawn, edited and saved to a file. No backend,
no account, nothing outside this directory. It runs in a browser today and, from
phase 7 of `ROADMAP.md`, as a desktop app.

Built and owned by Lionsville Group BV. **There is no customer in this codebase**
— an organisation is a *group*, which is data a user creates, not a name
compiled into the code. If you find one in an identifier, a storage key or a
default filename, that is a bug with a phase number on it (see phase 5 in
`ROADMAP.md`).

## Running it

Node 20 or newer. Internet is needed once, for `npm install`; everything after
that is local.

```bash
npm run setup && npm run dev
```

Then open http://127.0.0.1:5200. `npm run setup` installs both trees — this repo
and the editor package under `vendor/solution-design`, which has its own
`node_modules`.

## The loop

```bash
npm run check
```

~3 seconds: typecheck, the shell's 274 tests, lint. Run it after every change;
it is fast on purpose.

```bash
npm run check:all
```

~40 seconds: adds the editor package's 1428 tests, its typecheck and lint, and a
production build. Run it once before handing work back, and before any push that
touches `vendor/`.

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
```

Four ESLint rules enforce that rather than a convention: `core` and `ports` may
not import React, MUI or an adapter; `ui` may not import an adapter; browser
globals are an error outside `src/adapters/`. If a rule blocks you, the design is
telling you something — move the code, do not route around it.

`CLAUDE.md` carries the full map, including a "where does my change go" table.
`ROADMAP.md` carries what is built, what is next, and the names that are settled.

## Groups and projects

A project is addressed by a **group path** plus a key, and the store holds many:

```
lvarch.project.acme-logistics/warehouse-landscape
lvarch.project.acme/rail/rolling-stock
```

A group is whatever the namespace is called in that environment — a customer, a
department, a programme. Groups are derived from the projects filed under them,
so creating a group and creating a project are separate actions. A project's name
and group are editable afterwards.

On boot the app reopens the project you had open, or shows the picker. Examples
are **copied** into a project of your own when opened; nothing runs against an
example in place.

## The two save forms

- **The working file (`.lvarch`)** carries everything: topology, geometry,
  styling, uploaded logos, pinned routes and attach sides. This is what you save
  to keep working.
- **The interchange document** carries topology and semantics only — no
  geometry, no styling. It is the form for review and version control, and the
  form other tools read.

The document carries the topology; the tool owns the geometry. One exception: the
choice of a *built-in* icon travels in the interchange document as `iconType`,
because a key from a closed vocabulary is semantics. An uploaded logo never does
— a data URL in someone's browser is not something a reviewer can resolve.

Reading is broad and writing is narrow: a key this tool does not know survives a
round trip, and files written by older builds keep opening.

## Storage

The browser keeps projects and preferences in localStorage, behind
`ProjectStore` and `PreferencesStore`. If storage refuses — private window,
strict policy — the session falls back to memory: everything works and nothing
is left behind, which is what opening such a window asked for. The status bar
says so once.

Adding a different place to keep things is a class under `src/adapters/`, the
shared behaviour suite (`src/ports/ProjectStore.contract.ts`) run over it, and
one branch in `composition.ts`. Nothing above the seam changes.

## Using the editor

The user manual is moving into the tool itself, in the reader's language (phase 9
in `ROADMAP.md`). Until then the current Dutch text is kept, unedited and
partly out of date, in `docs/manual.nl.md`.

## Files worth knowing

| Path | What it is |
|---|---|
| `CLAUDE.md` | How to work in this repo: the layer map, the loop, the conventions |
| `ROADMAP.md` | What is built, what is next, and the settled names |
| `vendor/solution-design/` | The editor package, source and tests |
| `src/main.tsx` | The composition root; its header states the pattern |
| `src/composition.ts` | Which adapter the shell gets |
| `src/core/project.ts` | What a project is: open, save, order, summarise |
| `src/ports/ProjectStore.contract.ts` | The behaviour every store must show |
| `build/libavoidWasm.ts` | Publishes the router's wasm; fails a build, not a shipped app |
| `docs/manual.nl.md` | The old Dutch user manual, kept as source for phase 9 |
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
