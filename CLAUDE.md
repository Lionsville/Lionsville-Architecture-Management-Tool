# CLAUDE.md — working in this repo

The **Lionsville Architecture Management Tool**: a general-purpose architecture
modelling tool — a Layer-7 application landscape and the C4 container diagrams
under it. **There is no customer in this codebase.** An organisation is a
*group*, which is data a user creates. Never write a customer's name into an
identifier, a storage key, a file extension or a shipped example; *Names,
decided* below holds the settled ones (the working file is `.lvarch`). Two
halves:

- **`vendor/solution-design/`** — the editor package (React Flow canvas, model,
  layout, i18n, PNG export). A fork, maintained here. It takes
  a `model` prop, emits `DiagramContentBatch`, and knows nothing about storage,
  dialogs or backends. **1435 tests.** Leave it alone unless the task is in it.
- **`src/`** — the shell around it: state, dialogs, storage, files, preferences.
  **352 tests.** Almost every task lands here.

## This repository is public

Everything here is world-readable the moment it is pushed, and a force-push is
not an unpublish — GitHub keeps unreachable objects, clones and caches exist,
and search engines are faster than you are. **Nothing sensitive may enter this
tree in any scenario**, including "just for a minute", "it is a test value" and
"I will squash it out before pushing".

Two categories, both absolute:

- **Credentials.** Tokens, API keys, certificates, `.p12`/`.p8`/`.pem`/`.pfx`,
  connection strings, `.env` files, anything from a password manager. They live
  in GitHub Actions secrets and variables and are referenced **by name only** —
  `docs/release.md` lists all thirteen and carries not one value. If a
  credential ever does land here, it is burned: **rotate it first**, then clean
  the history. Cleaning history alone is not a remedy, it is a tidy-up.
- **Customer data.** A real organisation's landscape, its application names,
  hostnames, internal URLs, staff names, ticket numbers, org chart. Examples and
  fixtures are **fictional** (`src/examples/acme-logistics.json`). If you need a
  real landscape to test against, open it as a working file — that is what the
  working file is for. Do not commit it.

The second one is easy to get wrong, because a customer is identifiable without
being named. Their vocabulary, their systems' names and their domain terms
identify them as well as their logo does. When you add data you did not invent,
ask who it came from before you `git add` it — and if you did not write a file
yourself, read it before committing it.

## The fast loop

```bash
npm run check
```

~3 seconds: typecheck + all 352 shell tests + lint. Run it after every change.
That is the whole feedback loop — there is no gate to pass, no ceremony, no
reviewer step. It is fast on purpose so you run it constantly instead of
batching up and discovering three problems at once.

```bash
npm run check:all
```

~40 seconds: adds the vendor package's 1435 tests, its typecheck and lint, and a
production build. Run it once before you hand work back, not during.

Other commands: `npm run test:watch` · `npm run setup` (fresh clone; installs
both trees) · dev server on :5200 via `.claude/launch.json` (`editor-dev`).
**Do not start a dev server with Bash** — use the preview tooling.

## Committing

**Trunk-based. Commit to `main` and push.** No branch, no PR, no review gate for
ordinary work — that is the same reasoning as the fast loop above: the cost of
being wrong here is one revert, and the cost of ceremony is paid on every change
whether it needed it or not.

```bash
npm run check && git add -A && git commit && git push
```

`npm run check` before you commit is the whole discipline. Run `check:all` before
a push that touches `vendor/`, changes the build, or ends a stretch of work.

Prefer **several small commits over one large one**, each with a message that
says why rather than what. A commit that has to explain four unrelated things is
four commits.

A branch and a PR are still the right call when the change is genuinely risky,
when you want a second pair of eyes before it lands, or when it is going to sit
half-finished for a while. That is a judgement call, not a default — reach for
it deliberately, not out of habit.

## The layer map

Read this before adding a file; it answers "where does this go" in one pass.

```
src/core/         Arithmetic. No React, no browser, no storage, no IO.
                    model/            the design model, batching, interchange, keys
                    project           what a project IS: open, save, order, summarise
                    projectRef        addressing: group path + project key
                    containerDiagram  what belongs on a fresh container diagram
                    logo              the rules for an uploaded mark
                    preferences       language, theme, last project, list order
src/examples/     starting points that ship with the app. Data, not config.
src/ports/        The seams. Interfaces only, no implementations.
                    ProjectStore · PreferencesStore · DocumentGateway
                    ProjectStore.contract.ts — behaviour every store must show
src/adapters/     The outside world, one folder per flavour.
                    webStorage/ · memory/ · browser/
src/ui/           React. One concern per file:
                    App.tsx           picker or workspace; theme, language, toasts
                    ProjectWorkspace  one open project: toolbar, editor, dialogs
                    picker/           the first screen: ProjectPicker, NewProjectDialog
                    ShellToolbar · SaveMenu · ToastBar · dialogs/
                    useModelSession   the editing session (batches, aliases, remount)
                    useDiagramActions · useProjectFiles · useAutosave
                    useShellPreferences · useToasts · useStorageNotice · useFilePicker
src/composition.ts  Which adapter the shell gets. The ONLY file that knows both
                    a seam and its filling.
src/main.tsx      Composition root. Read its header first — it states the pattern.
```

**Components declare the interface they need**, not the widest one available.
`useAutosave` asks for `{ save(project) }`, not for a `ProjectStore`, so it
cannot reach `load()` or `clear()` and a reader does not have to check whether it
did. The concrete adapters satisfy those shapes structurally, so narrowing costs
nothing: no wrappers, just a smaller type. Follow that when you add a hook.

**Dependencies point inward.** `core` knows nobody. `adapters` and `ui` talk to
`ports`. Only `composition.ts` chooses. This is enforced by ESLint, not by
convention — try importing React into `core/` and you get an error explaining
why. If a rule blocks you, the design is telling you something; move the code,
don't route around the rule.

### Where does my change go?

| It is… | Put it in | Test it in |
|---|---|---|
| a decision, a calculation, a validation | `src/core/` | node, no mocks needed |
| talking to a browser/OS/network API | `src/adapters/<flavour>/` | its own suite |
| a new kind of place to keep things | new adapter + one line in `composition.ts` | the contract |
| something on screen | `src/ui/` | jsdom (`// @vitest-environment jsdom`) |
| inside the canvas/palette/inspector | `vendor/solution-design/src/` | that package's suite |

If you find yourself writing `localStorage`, `fetch`, `FileReader` or
`document.` anywhere outside `src/adapters/`, stop: that belongs behind a port.

## Groups and projects

There is no customer compiled into this app, and no "shipped document". A
project is addressed by a **`ProjectRef`** — a group path and a key inside it —
and the store holds many:

```
lvarch.project.acme-logistics/warehouse-landscape
lvarch.project.acme/rail/rolling-stock
```

A **group** is whatever the namespace is called in this environment: a customer,
a department, a programme. `ref.group` is a **path** (`acme/rail`), so groups can
nest later without the key format, the store interface, or any stored ref
changing — `groupSegments()` and the picker are the only places that would grow.
The group's display name is `model.customerName`; that field belongs to the
package's model and this shell reads it as the group's label.

A group is **derived from the projects filed under it** (`groupsOf`) — there is
nowhere to keep an empty one. Creating a group and creating a project are
therefore separate actions with separate dialogs: "New group" asks for the group
and its first project, "New project" offers a select of groups that exist. Each
group header in the picker also has its own "+ New project", which is the path
that stops `Acme` and `Acme Logistics` becoming two namespaces.

A project's name and its group are editable afterwards (`Settings…` in the
toolbar). A rename edits the model and leaves the ref alone; a **move** changes
the ref, so it is save-then-remove in that order — removing first and then
failing to save would lose the project.

On boot the app reopens the project you had open (a preference), or shows the
picker. Examples live in `src/examples/` and are **copied** into a project of
your own when opened — nothing runs against an example in place.

The picker lists **alphabetically by default**, with recency as a toggle
(`sortProjects`, persisted as `projectOrder`).

## Adding a storage backend (the worked example)

The point of the seams. Say you want to save to disk via the File System Access
API. You write one file, run one suite, change one line:

```ts
// src/adapters/fileSystem/FileSystemProjectStore.ts
export class FileSystemProjectStore implements ProjectStore { /* … */ }
```

```ts
// src/adapters/fileSystem/FileSystemProjectStore.test.ts
describeProjectStore('schijf', () => new FileSystemProjectStore(fakeHandle()))
```

`describeProjectStore` (in `src/ports/ProjectStore.contract.ts`) is the shared
behaviour suite: returns what it stored under its own ref, keeps two groups'
identically-named projects apart, keeps a nested group apart from its parent,
lists alphabetically, stamps `updatedAt`, refuses a ref that could escape its own
folder, and survives a round trip unchanged. Passing it is the whole admission
test. Then one branch in
`composition.ts`. **Nothing above the seam changes** — not `main.tsx`, not a
component, not a test.

The same holds for `PreferencesStore` and `DocumentGateway`.

## Conventions

- **Comments, identifiers and test names are English**, everywhere, including
  the shell. Write in the register the rest of the code uses: say why a decision
  was made, not what the line does, and match the density of the file you are in.
  Dutch survives only where it is domain data (a design's own content, a
  diacritics fixture) or a value already written into saved files.
- **UI strings are never inline.** They live one file per language —
  `vendor/solution-design/src/i18n/strings.en.ts` (the schema) and
  `strings.nl.ts` — with the registry and lookup in `strings.ts`. Adding a
  language is a new table file plus one line in `TABLES`; `strings.test.ts` loops
  over every registered language, so completeness, empty values, placeholders and
  "was it actually translated" are all checked automatically.
- Every pure function gets a unit test. Every port gets a contract or a suite.
- `readOnly` must hide every mutating affordance you add.
- Anything that covers the whole window (a fullscreen dialog) must take
  `windowChrome` and apply it to its top bar — the inset for the macOS traffic
  lights, `-webkit-app-region: drag` on the bar and `no-drag` on its controls.
  Electron computes drag regions from geometry, not from what is painted on
  top, so the shell toolbar's drag strip stays live under a dialog and swallows
  every click on the controls placed there. `DocumentationPage` is the example.
- Both MUI themes must keep working; no hard-coded hex outside `theme/`.
- Keep existing tests green. If a test pins behaviour you are deliberately
  changing, flip it in the same change and say so.
- Errors from `core` carry a **key** (`shell.logoTooBig`), never a sentence —
  the layer that knows the language turns it into words.

## Names, decided

Settled 5 September 2026. Do not invent alternatives, and do not carry a name
forward from an older document — the customer-specific file extension, storage
prefix, example filename and window title are all dead, and are deliberately not
written down here. This repository is public; a list of a customer's old
identifiers is still a list of a customer's identifiers.

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

- **`.werkbestand.json` keeps opening, forever.** Every file anyone saved before
  the rename is one. Reading is broad; writing is narrow.
- **The interchange format is not renamed.** It is an exchange format other
  tools read; its field names are a contract with them, not branding.

## State of play

`git log` is the ground truth for what is built and when.

The shell was restructured into the layers above and `main.tsx` was reduced to a
composition root (**805 → 137 lines**, most of it the pattern brief). The IO sits
behind ports, the preferences duplication is gone, the editing session and the
file actions are hooks, and the toolbar, menu, dialogs and toast bar are
presentational components with their own props.

Configuration then came out of the code: the hardcoded customer became a group
on a project, the landscape became an example, and the store became
`GROUP > PROJECT`.

Worth knowing: the last project is resolved at the edge of the app, before the
first render, so the workspace can start synchronously without a `null` case in
every `useState`. It uses `.then` rather than a top-level `await` because Vite's
target (chrome87/safari14) has none. Switching projects **remounts** the
workspace on purpose — the session's undo stack, id aliases and pending batches
belong to one project and must not leak into another.

The desktop app ships: `electron/` holds the main process and preload, the
renderer runs under `app://`, and `.github/workflows/release.yml` builds and
signs all three platforms from a published GitHub release
(`docs/release.md` is the operator's page). It still keeps projects in local
storage rather than in files on disk — `src/core/documentSession.ts` and
`src/adapters/fileSystem/` are the pure half of that work, waiting on a folder
picker and the wiring.

Older commit messages and code comments refer to numbered roadmap phases. That
file is gone; the numbering shifted once along the way, so read such a reference
as history, not as a plan.
