# CLAUDE.md — working in this repo

The **Lionsville Architecture Management Tool**: a general-purpose architecture
modelling tool — a Layer-7 application landscape and the C4 container diagrams
under it. **There is no customer in this codebase.** An organisation is a
*group*, which is data a user creates. Never write a customer's name into an
identifier, a storage key, a file extension or a shipped example; *Names,
decided* below holds the settled ones (the working file is `.lvarch`).

One codebase, in modules, with **2256 tests** and one of every config. The
editor was a separate package under `vendor/` until September 2026; that
boundary is gone and `docs/decisions/0001` says why.

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

A few seconds: typecheck and lint of everything, plus all 2256 tests. Run it
after every change.
That is the whole feedback loop — there is no gate to pass, no ceremony, no
reviewer step. It is fast on purpose so you run it constantly instead of
batching up and discovering three problems at once.

```bash
npm run check:all
```

Adds a production build. Run it once before you hand work back, not during.

```bash
npm run verify
```

~2 minutes: everything `check:all` does, then the desktop build and the desktop
smoke run — every step run to the end, one table, one exit code. This is the
gate before a push, and it is written so an agent can run it without deciding
anything: no flags, no reading of scrollback. `npm run smoke` is the last two
steps on their own.

The timings are for an ordinary laptop; a fast desktop-class Mac does all three
in about a third of that.

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

`npm run check` before you commit is the whole discipline. Run `verify` before
a push that changes the build, touches the desktop, or ends a stretch of work.

Prefer **several small commits over one large one**, each with a message that
says why rather than what. A commit that has to explain four unrelated things is
four commits.

A branch and a PR are still the right call when the change is genuinely risky,
when you want a second pair of eyes before it lands, or when it is going to sit
half-finished for a while. That is a judgement call, not a default — reach for
it deliberately, not out of habit.

## The module map

Read this before adding a file; it answers "where does this go" in one pass.
Every module has an `index.ts` that is its public surface, pure files at its
root, and a `ui/` folder for its React side where it has one. `editor/` is the
exception: React through and through, so it keeps its subfolders.

```
src/model/        What a landscape is made of, and the arithmetic over it.
                    types             the domain half; imports nothing at all
                    kinds · zones · placement · aspects · kindChange · deletion
                    ids · keys        addressing, slugs, where a new id comes from
                    normalised        the model indexed by id; fromArrays/toArrays
                    commands · reducer  what a change IS, and the one writer
                    routes · floatingEdgeMath   where a line leaves a box
                    overlay/merge/reconcile/batch   the editor's in-flight edits,
                                      on their way out; batchCommands is the bridge
                    hostModel · fromInterchange · toInterchange · containerDiagram
                    logo · logoRegistry · marks/    uploads, the icon registry
                    textSearch        the one rule for "found"
                    adr               what a decision record IS (rules: decisions/)
src/layout/       Where things end up: tidy, ELK, libavoid, the router worker.
src/editor/       The canvas and everything docked to it. React.
                    canvas/ · nodes/ · edges/ · theme/ · export/
                    props.ts          what the editor is handed (38 props)
                    useEditorState    the editing session's brain
src/documentation/  Descriptions as documents.
                    documentation     outline, element links, the template
                    ui/               DocumentationPage, MarkdownField, mermaid
src/decisions/    Decision records: the status machine, the numbering, the page.
src/search/       One search over elements, documentation and decisions; ⌘K, ⌘F.
src/i18n/         The registry. Each module owns `strings/en.ts` + `strings/nl.ts`;
                  `strings.en.ts` composes them and is the schema.
src/projects/     A project: open, save, order, summarise, address, remember.
src/platform/     What the app runs inside, and what a failure looks like.
                    errors            ShellError: a refusal as a key, never a sentence
                    diagnostics       what a failure entry is, and how a trail reads
                    logFile           what the desktop log is called, and when it rolls
                    windowChrome      how much of the top bar is the window's
src/widgets/      Presentation with no opinions: icons, one confirm dialog.
src/ports/        The seams. Interfaces only, no implementations.
                    ProjectStore · PreferencesStore · DocumentGateway
                    GroupStore · Diagnostics · HostControls
                    ProjectStore.contract.ts — behaviour every store must show
src/adapters/     The outside world, one folder per flavour.
                    webStorage/ · memory/ · browser/ · fileSystem/
src/app/          The shell around the editor.
                    main.tsx          composition root. Read its header first.
                    composition.ts    which adapter, and which icon packs
                    App · ProjectWorkspace · ShellToolbar · SaveMenu · ToastBar
                    picker/ · dialogs/ · examples/ · iconPacks/
                    testing/          renderShell / renderApp: the shared harness
                    use*              the hooks: session, files, autosave, toasts
electron/         The desktop main process and preload.
```

**Components declare the interface they need**, not the widest one available.
`useAutosave` asks for `{ save(project) }`, not for a `ProjectStore`, so it
cannot reach `load()` or `clear()` and a reader does not have to check whether it
did. `DocumentationPage` asks for one `updateElement`, not the editor's whole
action set. The concrete implementations satisfy those shapes structurally, so
narrowing costs nothing: no wrappers, just a smaller type.

**Who may import whom is a matrix**, declared as data at the top of
`eslint.config.js` and generated into one rule per module, each with its own
sentence. `model` is the bottom and knows nobody; `app` is the top and knows
everyone; nobody imports `app`, and nobody but `app/composition.ts` imports
`adapters`. `model`, `layout`, `platform`, `ports`, `projects` and `i18n` may not
import React, MUI, Emotion or React Flow at all. If a rule blocks you, the design
is telling you something; move the code, don't route around the rule.

Two rows are worth knowing because they are not obvious. `editor` may not import
`decisions` or `projects` — a canvas that knows what a project is cannot be
mounted in a test with two plain objects. And `documentation` may not import
`editor`, which is why the documentation page takes its inspector as a
`renderInspector` slot.

### Where does my change go?

| It is… | Put it in | Test it in |
|---|---|---|
| what a landscape is, or arithmetic over it | `src/model/` | node, no mocks needed |
| where something ends up on the board | `src/layout/` | node |
| talking to a browser/OS/network API | `src/adapters/<flavour>/` | its own suite |
| a new kind of place to keep things | new adapter + one line in `composition.ts` | the contract |
| inside the canvas/palette/inspector | `src/editor/` | jsdom (`// @vitest-environment jsdom`) |
| a screen that is not the canvas | that module's `ui/` | jsdom |
| the shell around it all | `src/app/` | jsdom |

If you find yourself writing `localStorage`, `fetch`, `FileReader` or
`document.` anywhere outside `src/adapters/`, stop: that belongs behind a port.

## Decisions (ADRs)

Three lists, one shape (`decisions/adr.ts` for the rules, `model/adr.ts` for the record). The **group's** records live on its
`GroupProfile.decisions`; the **landscape's** and every **application's** live
on `model.decisions`, told apart by `applicationId`. The body is MADR markdown;
title, status, date and signers are fields. The status is a state machine —
proposed → reviewing → accepted | rejected, accepted → superseded (with the
successor's id) — and the three end states lock the record: `updateAdr` and
`removeAdr` refuse them. Numbers are per list and never reused. The working
file is version 2 because of this field; v1 still opens.

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
- **UI strings are never inline, and every module owns its own.** A module keeps
  `strings/en.ts` (`as const`, the schema for its keys) and `strings/nl.ts`
  (typed from it, so a missing translation is a compile error where the word
  lives). `i18n/strings.en.ts` composes the slices; that file and its Dutch twin
  are the only ones that name every module. Adding a language is a new
  `strings/<lang>.ts` per module plus one line in `TABLES`. `strings.test.ts`
  loops over every registered language for completeness, empty values,
  placeholders and "was it actually translated", and over the slices for keys
  lost, keys nobody owns, and two modules claiming the same key.
- **A module does not name another module's key.** `common.` is the exception —
  shared vocabulary — and so is a refusal key that is part of a published type
  (`KindChangeRefusal`). Anything else means publishing a table, the way
  `decisions` publishes `STATUS_LABEL` and `SCOPE_LABEL`.
- Every pure function gets a unit test. Every port gets a contract or a suite.
- `readOnly` must hide every mutating affordance you add.
- Anything that covers the whole window (a fullscreen dialog) must take
  `windowChrome` and apply it to its top bar — the inset for the macOS traffic
  lights, `-webkit-app-region: drag` on the bar and `no-drag` on its controls.
  Electron computes drag regions from geometry, not from what is painted on
  top, so the shell toolbar's drag strip stays live under a dialog and swallows
  every click on the controls placed there. `DocumentationPage` and `AdrPage`
  are the examples; both pin it in a test.
- Both MUI themes must keep working; no hard-coded hex outside `theme/`.
- Keep existing tests green. If a test pins behaviour you are deliberately
  changing, flip it in the same change and say so.
- Errors from the pure modules and the adapters carry a **key**
  (`shell.logoTooBig`), never a sentence — they are `ShellError`s
  (`platform/errors.ts`), and `app/messageFor.ts` is the one place that turns a
  key into words. A refusal that is part of a function's
  ordinary answer stays a returned value (`openProjectDocument`).
- **A failure has somewhere to go.** Report it through the `Diagnostics` seam
  before you draw anything about it; every `void promise` needs a rejection
  handler or a comment saying why not. Never toast a success you did not wait
  for. Log messages and keys, never model content — the desktop writes the
  trail to a file the user is invited to hand over.
- **Component tests go through `ui/testing/renderShell.tsx`.** It supplies the
  theme and the language, and checks on every render that the theme reached the
  tree — which is how a doubled Emotion gets caught by every test rather than by
  one.

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

One thing deliberately does **not** change:

- **The interchange format is not renamed.** It is an exchange format other
  tools read; its field names are a contract with them, not branding. The same
  goes for `solution-design/v1` inside it, and for `DesignModel`'s field names.

And one thing deliberately broke, once. Files written under the tool's previous
name are **not** opened: `isWorkingFile` accepts only the
`lionsville-architecture` tag, and `model/hostModel.test.ts` pins the refusal
with its reasoning. The working file was redefined rather than extended, at a
moment when nobody had one worth keeping. Versions 1 and 2 of the current file
both open, and phase 4 adds version 3 with a reader for both. `docs/decisions/`
has the long version.

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

Then the editor package was dissolved (`docs/decisions/0001`). 326 files moved
into the modules above in one mechanical commit; the second toolchain, the
alias, the `dedupe` lists and the 720-line half-domain-half-props contract file
went with it. The boundaries that remain are the import matrix, which is data at
the top of `eslint.config.js` rather than prose. Around 600 lines of surface
belonging to the application the editor was carved out of are gone, the string
table is nine slices each owned by the module that says the words, and the rail
icon set is a registered pack rather than a railway vocabulary in the model.

Then a change became a **command** (`docs/decisions/0002`), which is the work
in progress. The model is indexed by id in memory with `fromArrays`/`toArrays`
at the file boundary (the file itself does not change, and a byte-for-byte
round trip pins that); `apply(model, command)` is the only writer and returns
the command that undoes what it just did; the session holds one stack over
everything, so ⌘Z undoes a diagram rename, a decision's status and a project
setting as readily as a node move. A new element gets the key the file would
have given it at the moment it is drawn, so the temporary id, the alias map and
the reconciliation between them are gone from the shell.

**The editor still speaks `DiagramContentBatch`**, translated by
`model/batchCommands.ts` and landed as one step. Converting its actions to
dispatch, and then deleting the overlay, the merge, the reconcile and the batch,
is what is left; the editor's own undo stack is still there but nothing pushes
to it or reads it. Until that lands, `hostModel.applyBatch` and its neighbours
are still exercised by their own tests and by nothing else.

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
storage rather than in files on disk — `src/projects/documentSession.ts` and
`src/adapters/fileSystem/` are the pure half of that work, waiting on a folder
picker and the wiring.

Older commit messages and code comments refer to numbered roadmap phases. That
file is gone; the numbering shifted once along the way, so read such a reference
as history, not as a plan.
