# Lionsville Architecture Management Tool — working brief

**What this is.** A general-purpose architecture modelling tool, built and owned
by Lionsville Group BV. It draws an application landscape in Layer-7 bands and
the C4 container diagrams underneath it, edits both, and saves them to a file.
It runs in a browser today and as a desktop app after phase 7.

**What this is not, and the mistake this file exists to stop.** It is not one
customer's tool. It began as an editor for a single organisation's landscape,
and for a while that customer was compiled into the code — a hardcoded
`CUSTOMER`, a "shipped document", `ns-` in every storage key and filename. That
is gone from the architecture (a group is data now, see *Groups and projects* in
`CLAUDE.md`) but it survives in **names**, and names are what a new reader
copies. **A customer's name must never appear in an identifier, a storage key, a
file extension, a bundle id, a default filename or a shipped example.** If you
are about to write one, you are working from a stale plan — read the next
section instead.

## Names, decided

Decided 5 September 2026. These are settled; do not invent alternatives, and do
not carry forward any name from an older document — the customer-specific file
extension, storage prefix, example filename and window title are all dead, and
are deliberately not written down here. This repository is public; a list of a
customer's old identifiers is still a list of a customer's identifiers.

| Thing | Value |
|---|---|
| Product name | **Lionsville Architecture Management Tool** |
| Short name (menus, window title, tight spaces) | **Architecture Management Tool** |
| Working-file extension | **`.lvarch`** |
| Working-file discriminator (inside the JSON) | `lionsville-architecture` |
| npm package name | `lionsville-architecture-management-tool` |
| Desktop bundle id | `nl.lionsville.architecture` |
| Browser storage prefix | `lvarch.project.<group>/<project>` |
| Preferences key | `lvarch.preferences` |
| Vendor / copyright | Lionsville Group BV |
| Shipped example | a fictional organisation, never a real customer's landscape |

Two things deliberately do **not** change:

- **`.werkbestand.json` keeps opening, forever.** Every file anyone has saved so
  far is one. Reading is broad; writing is narrow.
- **The interchange format is not renamed.** It is an exchange format that other
  tools read; its field names are a contract with them, not branding.

## What the tool does today

The capabilities, stated generically, because this is the list a stranger needs:

- **Layer-7 landscape views.** Elements in bands, domain groups, lifecycle
  badges, accent colours, icons, orthogonal connections with a real router
  (libavoid on WebAssembly, off the main thread).
- **C4 container diagrams.** Double-click an application to open or create the
  container view underneath it; the format's rule 5 (a component of another
  application is replaced by its parent) is executed on seeding.
- **Manual routing.** Segment drag, pinned routes, per-end attach sides, all of
  it surviving a re-layout and a reload.
- **Groups and projects.** A project is addressed by a group path plus a key;
  the store holds many. A group is whatever the namespace is called in that
  environment — a customer, a department, a programme. There is no customer in
  the code.
- **Two save forms.** The **working file** (`.lvarch`) carries everything:
  geometry, styling, uploaded logos, pinned routes. The **interchange document**
  carries topology and semantics only — the form for review and version control.
  The document carries the topology, the tool owns the geometry.
- **PNG export** with a title block.
- **Dutch and English**, switchable, covering menus, dialogs, band names, errors
  and the export title block.
- **Light, dark and system themes.**

## What is already built

`git log` is the ground truth; this table is the map.

| Phase | State | Commit / notes |
|---|---|---|
| Baseline | — | `899287d` |
| 0 Groundwork | done | `cba1970` — router in a Web Worker, host tests, `usePointerDrag`, `VENDOR.md` |
| 1 Right-click menu | done | `21be570` — node/line/pane/selection/group/tab menus, connect mode, F2 / Shift+F10 |
| 2 Manual routing | done | `00329ce` — handles on any selected line, segment drag, pin/unpin/reset, routes follow nodes |
| 2d Attach sides | done | `05cad06` — `sourceSide`/`targetSide`, inspector, Alt-drag, router honours sides |
| 3 Icon library | done | `05cad06` — ~100 built-in marks, uploads as data URLs, `iconType` in interchange |
| 4 Polish | done | `9f95ef1`, `2a29e02` — search, resizable panels, keyboard, delete confirmations |
| 5A/5B Layers | done | `6eebe8b` — `core` / `ports` / `adapters` / `ui`, `main.tsx` 805 → 137 lines, four ESLint boundary rules |
| Configuration out of code | done | `6eebe8b` — group + project refs, examples, no compiled-in customer |
| Trunk-based working | done | `edbeaf7` |
| Names de-drifted | done | `8f4e133`, `f036202` — this file rewritten, README in English, LICENSE generic, dead scripts gone |
| 7A Desktop scaffold | done | `909ab74` — electron-vite, `app://` with CSP, CJS main and preload, the nine-check smoke, app icon |

**Counts at HEAD:** shell **274** tests, package **1428**, typecheck and lint
clean, `npm run build` succeeds. Any phase that lowers a number owes an
explanation.

**Corrections already applied** (do not redo them): the root has a jsdom Vitest
project and `@testing-library/react`, so a component *can* be tested; the root
has an ESLint config whose four boundary rules are armed and verified firing;
`hostModel` / `keys` / `fromInterchange` / `toInterchange` live under
`src/core/model/`; preferences are one blob with one `writePrefs(patch)`;
`libavoid.wasm` is published by a real Vite plugin that fails a build rather
than a packaged app (`build/libavoidWasm.ts`).

## Conventions for every phase

- **The fast loop is `npm run check`** (~3 s: typecheck + shell tests + lint).
  `npm run check:all` (~40 s, adds the package's 1428 tests and a build) once
  before handing work back. See `CLAUDE.md`.
- **Trunk-based.** Small commits straight to `main`, each saying why.
- **`vendor/solution-design/` is left alone** unless a phase says otherwise. It
  takes a `model` prop, emits `DiagramContentBatch`, and knows nothing about
  storage, dialogs or backends. Exactly one future phase (8) changes it, by one
  optional field.
- **Where does my change go** — the table in `CLAUDE.md`. `core` computes,
  `adapters` touch the world, `ui` draws, `composition.ts` chooses.
- **UI strings are never inline**; they live in the per-language tables.
- **Errors from `core` carry a key**, never a sentence.
- Every pure function gets a unit test; every port gets a contract.

---

# Phase 5 — take the customer out of the names

**Why first.** Every later phase writes one of these names into something
permanent: phase 7 puts the extension into an OS file association and the bundle
id into a signed binary; phase 8 reads a branding file next to the app. Renaming
after that is a migration; renaming now is a rename.

**Decided (see *Names, decided*):** no migration of existing browser storage.
The keys change, and a project sitting in someone's localStorage under the old
prefix is not carried over. That is a deliberate trade — this is a tool in
development, the working file is the durable artefact, and 40 lines of migration
code would outlive its usefulness by years. **Say so in the release note**, and
say it in the picker's empty state if it is cheap.

**5A — identifiers and keys.**
- `PROJECT_PREFIX` → `lvarch.project.`, `PREFERENCES_KEY` → `lvarch.preferences`,
  the storage probe likewise. Their tests pin the literals; change them in the
  same commit.
- `package.json` name, `index.html` title and its no-JS fallback text,
  the suggested download name.
- Grep for `ns-`, `NS `, `rewired`, `werkbestand`, `Werkbestand` across `src/`
  and `index.html` and leave none behind that is not a deliberate exception
  below.

**5B — the working file's own name for itself.**
- Write `type: 'lionsville-architecture'`, `version: 3`. **Read** `version` 1, 2
  and 3, and read the old `'solution-design-werkbestand'` discriminator forever
  — `isWorkingFile` accepts both strings; only the writer narrows. A file saved
  by an older build must keep opening; that is the whole point of a working file.
- Default filename `<project>.lvarch`. `.werkbestand.json` still opens by
  content, not by extension — the open path already sniffs the JSON.
- This is the format change 7D used to carry. 7D is now packaging only.

**5C — a shipped example that belongs to nobody.**
- Write a fictional landscape (a logistics or utilities company, ~25 elements,
  two domain groups, one container diagram) and ship that. It has to be good:
  it is the first thing a new user opens, and a thin example makes the tool look
  thin.
- The real customer landscape stops being a shipped example. Keep it out of
  `EXAMPLES` and out of the build; if it is wanted for local work, it is a
  working file someone opens, not source in this repo.
- `src/core/model/interchange.test.ts` and `project.test.ts` import it as a
  fixture — point them at the new example, and check the numbers they assert
  still mean something.

**Gate:** `npm run check:all`. Storage keys, the file discriminator and the
example are all covered by existing suites, so this phase should be green or
explicitly, deliberately red.

# Phase 6 — the document session

**Partly done** (`src/core/documentSession.ts`, `src/adapters/fileSystem/`).

**Done: the reducer.** `documentSession` is a pure state machine — no React, no
filesystem, no clock — over `no-file | clean | dirty | saving | external-changed
| conflict`, with 41 tests. Every awkward sync case is a row in it: a change
arriving while a save is in flight, while there are unsaved edits, twice before
anyone answered, or turning out to be our own write coming back. Three
transitions are the ones implementations usually miss, and each is pinned:

- a save that lands *after* a further edit leaves the session **dirty**, not
  clean — otherwise the newest edit is the one nobody notices is missing;
- a failed save returns to **dirty**, never to clean;
- editing after being told their version changed, or saving over it, becomes a
  **conflict** rather than silently clobbering somebody else's work.

`SaveFingerprint` (path, mtime, size, sha256) is recorded on every successful
save, and `sameFile` compares all four — mtime granularity differs per
filesystem and sync clients preserve it deliberately, size misses an edit that
keeps the length, and a hash alone cannot tell "unchanged" from "changed back".
Without it every save round-trips through the watcher as a phantom external
change, which is how a sync feature becomes something people turn off.

The autosave cadence is designed here as a pure decision — `shouldSaveNow(state,
trigger, msSinceLastEdit)` over `idle | blur | quit`, with a 3 s idle window
instead of today's 400 ms. Leaving the window is when a person believes they are
done; quitting is the last moment there is. It refuses to write on top of a
write in flight, whatever the trigger, because two overlapping writes to one
file is how half a document reaches disk.

**Done: the folder store.** `FileSystemProjectStore` keeps projects as real
`.lvarch` files under a directory handle, laid out as the ref itself
(`<group path>/<project>.lvarch`), so the picker and the file manager cannot
disagree and there is no index to fall out of step. It passes the shared
`ProjectStore` contract and adds the cases only a folder can fail: files that
are not ours, a corrupt project skipped rather than breaking the listing, a file
moved in Finder simply being the project at its new address, an unreadable
folder answering with an empty list, and a ref that could escape the folder
refused. It runs against `FakeDirectory`, an in-memory double the compiler holds
to the real API's shape.

**Still open — and this is what makes the phase ship rather than compile:**

1. **A way to choose the folder.** `showDirectoryPicker()` behind the
   `DocumentGateway` seam (browser globals are an ESLint error outside
   `src/adapters/`), the handle kept in IndexedDB so it survives a reload, and
   the permission re-prompt on return. Until this exists, `composeShell()` has
   no branch to make and the store is unreachable.
2. **Wiring the session into the shell.** `useAutosave` still writes 400 ms
   after every change and reports success straight to a toast; it needs to hold
   a `documentSession`, drive it from the triggers, and let the status bar show
   `dirty`/`saving`/`conflict` instead of only "Saved · hh:mm". This changes
   what the toolbar says, so it wants a pass with someone watching rather than
   being slipped in at the end of a session.
3. **The conflict dialog.** Keep mine / take theirs / save mine as a copy — the
   reducer already has the transitions and the tests; nothing renders them yet.
4. **Polling for external change** in the browser: `handle.getFile().lastModified`
   against the stored fingerprint, plus a re-stat on window focus.

# Phase 7 — the desktop app

**7A — scaffold, and prove the hard part first.** ✅ **done** (`909ab74`)

It works: the renderer runs under `app://`, wasm compiles, the router runs on a
module worker, Tidy completes and PNG export produces a blob. `npm run
smoke:desktop` re-checks all nine in about a minute. **7B–7D may proceed.**

What is in the tree: `electron.vite.config.ts` (main, preload, renderer),
`electron/main/` (the `app://` handler, the window, the smoke), a CommonJS
preload that exposes nothing but the platform and versions, `electron-builder.yml`,
and an app icon generated from `public/icon.svg` by `scripts/make-icons.swift`.

**Three things that cost real time. Read them before touching this scaffold.**

1. **The main bundle is CommonJS, and that is load-bearing.** Electron loads an
   ESM main *asynchronously* and does not hold `ready` for it, so anything that
   must precede `ready` — `registerSchemesAsPrivileged` above all — runs too
   late, and `app.whenReady()` never resolves
   ([electron/electron#40719](https://github.com/electron/electron/issues/40719),
   closed as *not planned*). The symptom is a process that prints nothing, shows
   nothing and never exits. **An earlier edition of this file said to await such
   work at the top level of the ESM entry. That is exactly backwards and is what
   produced the hang.** The preload is CommonJS for a different reason: a
   sandboxed renderer cannot load an ESM preload at all.
2. **`standard: true` on the scheme is not decoration.** Without it the document
   gets an opaque origin: every `'self'` in the CSP matches nothing, the scripts
   and stylesheet are blocked, `localStorage` throws SecurityError, and the
   window sits on its loading state. Nothing appears in the main process — the
   evidence is all in the renderer console, which is why the smoke forwards that
   console to stderr.
3. **The CSP needs `'wasm-unsafe-eval'`** (the router compiles WebAssembly) and
   `'unsafe-inline'` for styles (Emotion injects the MUI theme). Without the
   first, the app starts, draws, and is quietly wrong — the router degrades to
   straight lines. That is why the smoke counts *corners*, not edges.

**How to check a change to it:** `npm run smoke:desktop`. It presses the real
buttons — it opens an example from the picker, presses Tidy, presses Export PNG
— rather than reaching into the app, so it keeps working as the shell changes.
Two details that are load-bearing there: the window must be **real and visible**
(a hidden pane never fires `requestAnimationFrame`, and `html-to-image` waits on
one), and downloads are cancelled in the session (otherwise the export puts a
save panel in front of the window and the run waits for a human).

**Dev vs production.** `npm run dev:desktop` serves the renderer over http so
Vite can hot-reload; only a production build exercises `app://`. So the smoke
builds first, and the smoke — not the dev server — is the gate.

**7B — files on disk.**
- `atomicWrite.ts`: write `.<name>.tmp-<pid>` **in the same directory**, fsync,
  rename over the target. **Never delete-then-rename** — that leaves a window
  with no file on disk, which is how sync clients and antivirus lose data.
  Retry the rename on `EPERM`/`EBUSY` with backoff; on Windows both AV and the
  sync client hold transient handles.
- `fingerprint.ts`: phase 6's `SaveFingerprint`, computed on write and on read.
- `watcher.ts`: **`@parcel/watcher`**, not chokidar (chokidar is documented as
  taking 20–30 minutes to notice a change on a network path). Watch the
  *containing directory*, not the file — OneDrive and SharePoint replace the
  file rather than writing in place, so a watch on the path goes deaf after the
  first sync. Debounce ~300 ms, plus a 10 s mtime poll and a re-stat on window
  focus. The focus re-stat is ten lines and catches nearly everything else.
- Conflict copies: OneDrive silently writes `<stem>-<HOSTNAME><n>.<ext>` beside
  ours. Scan for the pattern and surface it, or people lose work with no error.
- **Files On-Demand:** on macOS 12.1+ it is part of the OS and cannot be turned
  off, so a first read may block for seconds while the file hydrates. There is
  no reliable cross-platform placeholder API, so do not detect — make every read
  async off the window's critical path, show "fetching from OneDrive…" after
  ~1 s, and time out.
- **No locking.** OneDrive does not lock; two people editing one file both win,
  last write. Detect and warn.

**7C — typed IPC and the desktop store.**
- One typed channel contract in a shared `.d.ts`. `ipcMain.handle` validates
  every payload: **treat each message as an untrusted request.** Paths are
  allow-listed — only paths the user chose through a dialog or the recents list,
  resolved and `realpath`'d. The renderer never supplies an arbitrary path.
- `src/adapters/desktop/` implements `ProjectStore` (and `DocumentGateway`) over
  that channel, and `composition.ts` gains its one branch. Nothing above the
  seam changes — that is the property phases 5A/5B were bought for.
- Native menus, `app.addRecentDocument`, dirty-close guard, single-instance lock
  with `second-instance` / `open-file`.
- Autosave moves to the phase 6 cadence. localStorage demotes from source of
  truth to a crash journal keyed by file path.

**7D — packaging, signing, updates.** ✅ **build and signing done**
*Purely packaging now; the format change moved to phase 5B.*

`.github/workflows/release.yml` builds all three platforms from a published
GitHub release and attaches signed installers to it — macOS notarized and
stapled, Windows through Azure Trusted Signing, Linux unsigned. The config moved
from `electron-builder.yml` to `electron-builder.cjs` so that "sign with whatever
credentials are in the environment, and nothing else" can be a rule rather than a
second config file. `docs/release.md` is the operator's page: the thirteen
secrets, and the four ways this has already gone wrong elsewhere.

Excluding `node_modules` from the bundle took the asar from 61 MB to 6.5 MB — the
lesson below, confirmed here. **Still open:** the `.lvarch` file
association, and `electron-updater` (the workflow already publishes the
`latest*.yml` manifests it needs).
- electron-builder, configured the way an earlier internal desktop app of ours already
  is — that setup works and is the reference, not a starting point to rediscover:
  - `electron-builder.yml` with `appId`, `productName`, `directories.output:
    release`, `buildResources: resources`, and `files: [out/**, package.json]`.
  - **`dependencies` stays empty** unless something is genuinely loaded from
    `node_modules` at runtime. electron-builder copies production dependencies
    into the bundle; that project shipped a 96 MB asar of code the app never read
    before this was understood.
  - **A separate macOS icon.** Windows and Linux want full-bleed square artwork;
    macOS expects the file to already contain Apple's grid — an 824×824 rounded
    body inset in a 1024×1024 canvas, 185.4pt corner radius — and does **not**
    apply that mask itself. A square PNG renders as a hard-edged tile visibly
    larger than every neighbour in the Dock. that project has a
    `scripts/make-mac-icon.swift` that does the inset; reuse it.
  - arm64-only for macOS is defensible (signing cost scales with bytes hashed
    and each architecture is a separate notarization submission); if Intel is
    ever needed, restore `universal`, not `[arm64, x64]`.
- **Signing exists and is known-good.** macOS: Developer ID + `hardenedRuntime`
  + entitlements + notarization through `notarytool`. Windows: **Azure Trusted
  Signing** — the `.pfx` route no longer exists, the OV key must live on a
  token, HSM or cloud service. Both are wired in that project's
  `.github/workflows/desktop-release.yml`, credentials in GitHub secrets, and a
  local `electron-builder --dir` still builds unsigned with no setup. Copy that
  workflow's shape: a preflight job that turns "are the secrets present" into a
  job output (secrets cannot be read from a job-level `if:`), a tag as the
  single source of truth for the version, and notarization behind a dispatch
  input because it adds ~15 minutes of Apple queue time.
- `.lvarch` file association on both platforms; `open-file` on macOS, `argv` on
  Windows.
- `electron-updater` against a static host or GitHub releases.

# Phase 8 — branding per install

Rides on the phase 5 structure; small once that exists.

- `src/core/branding.ts` + an adapter: `{ appName, organisation, author,
  logoLight, logoDark, favicon, accent }`. Resolution order: built-in defaults →
  `branding.json` (from `public/` on web, from beside the app or `userData` on
  desktop) → user override in the preferences store. An organisation re-brands
  without a rebuild.
- **Branding is per install, not per document.** A shared file must not re-skin
  someone else's app. The export title block may be overridden per document;
  nothing else may.
- Reuse `readLogoFile` (`src/core/logo.ts`) for upload validation — it already
  handles SVG/PNG and throws translatable `LogoError` keys.
- Wire-up: a mark before the project name in `ShellToolbar`; `document.title`
  and the favicon set at boot, with `index.html` keeping its values as the no-JS
  fallback; `exportTitleBlock` fed from branding.
- **The one change inside `vendor/`:** optional `logo?: { dataUrl; width;
  height }` on `ExportTitleBlock` (`types.ts:568`), drawn in `drawTitleBlock`
  (`export/exportPng.ts:172`). Keep it optional — that file deliberately
  guarantees byte-identical output for a caller that passes nothing, and **there
  is no test pinning that guarantee** (checked 5 September 2026). Write the
  pinning test *first*, on current behaviour, then add the field.

# Phase 9 — the manual, inside the tool

**Decided:** user documentation lives **in the app**, in the reader's language,
following the language toggle. Developer documentation stays in the repo, in
English.

- `src/help/`: long-form content per language (`manual.en`, `manual.nl`),
  registered the way `i18n/TABLES` is, so adding a language is a file plus a
  line. A manual is content, not UI strings — it does not belong in the string
  table, and a test loops the registry for completeness the way
  `strings.test.ts` does.
- A Help entry in the toolbar opening a searchable drawer; deep-linkable
  sections, so an error toast can point at one.
- The content starts from the README's current user-facing sections (the two
  save forms, icons and logos, routing and attach sides, panels, keyboard,
  search, themes) — which then **leave** the README. A user manual in a
  developer readme is read by neither audience.
- README.md keeps: what the tool is, how to run it, the architecture map, the
  test story, how to package.

## Sequencing

| | Work | Size | Ships value alone |
|---|---|---|---|
| 5 | take the customer out of the names | ~1 d | yes — and it unblocks 7D and 8 |
| 6 | ~~`documentSession` reducer~~ · ~~folder store~~ · folder picker, session wiring, conflict dialog | ~1 d left | yes — real save-in-place in the browser |
| ~~7A~~ | ~~electron-vite, `app://`, wasm/worker proven~~ | **done** | it runs as an app |
| 7B | atomic write, watcher, fingerprint, conflicts | ~1 w | yes — the actual feature |
| 7C | typed IPC, desktop store, menus, autosave | ~3 d | yes |
| 7D | installers, signing, association, updater | ~2 d | yes |
| 8 | branding, logo, title-block logo | ~2 d | yes |
| 9 | the manual, in the tool, in two languages | ~2 d | yes |

Phase 5 first because it is cheap and everything after it writes a name into
something permanent. If the project stalls after 6, the codebase is still better
than it was and the browser tool gained a real working file.

## Risks, named

- ~~**7A is the go/no-go.**~~ **Answered: it works.** wasm compiles under
  `app://`, the module worker constructs, Tidy completes and PNG export settles.
  The risk this phase existed to retire is retired; `npm run smoke:desktop` keeps
  it retired.
- **Sync behaviour cannot be unit-tested end to end.** Phase 6 makes the *logic*
  testable; the filesystem layer needs a manual script — touch the file from
  another process, pull the network, let OneDrive dehydrate the file — run before
  each release. Write that script in 7B, not later.
- **Certificate expiry is a silent outage.** Since March 2026 OV certificates
  live ~460 days. the credentials are held outside this repository; put the renewal in a calendar
  the day 7D lands.
- **The example is the first impression.** A thin fictional landscape makes the
  tool look thin. Budget real time for it in phase 5C.

## Later

- Pinned routes as thin obstacles for the router (`RouterInput.fixedRoutes`).
- Split `useEditorState.ts` by concern; remove the surface that only ever served
  the original host (parameters editor, scope cost chip, legacy drag shims).
- Nested groups in the picker. The addressing already supports it
  (`ref.group` is a path); only `groupSegments()` and the picker would grow.

## Note on numbering

The previous edition of this file numbered the forward work 5 (layers), 6
(desktop), 7 (branding). The layer work is done and now appears in *What is
already built*; what was 5C is now **phase 6**, what was 6A–6D is now
**7A–7D**, and what was phase 7 is now **phase 8**. Commit messages for phases
0–4 keep their original numbers. Phases 5 (de-branding) and 9 (the in-app
manual) are new.
