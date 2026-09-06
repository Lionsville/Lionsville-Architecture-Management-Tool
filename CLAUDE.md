# CLAUDE.md — working in this repo

The **Lionsville Architecture Management Tool**: a general-purpose architecture
modelling tool — a Layer-7 application landscape and the C4 container diagrams
under it. **There is no customer in this codebase.** An organisation is a
*group*, which is data a user creates. Never write a customer's name into an
identifier, a storage key, a file extension or a shipped example; *Names,
decided* below holds the settled ones (the working file is `.lvarch`).

One codebase, in modules, with **2367 tests** and one of every config. The
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

A few seconds: typecheck and lint of everything, plus all 2367 tests. Run it
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
                    keys              addressing, slugs, where a new id comes from
                    normalised        the model indexed by id; fromArrays/toArrays
                    commands · reducer  what a change IS, and the one writer
                    activity          what a step is called, for a list to read
                    routes · floatingEdgeMath   where a line leaves a box
                    hostModel · fromInterchange · toInterchange · containerDiagram
                    logo · logoRegistry · marks/    uploads, the icon registry
                    diff              what changed, in the landscape's own terms
                    textSearch        the one rule for "found"
                    adr               what a decision record IS (rules: decisions/)
src/layout/       Where things end up: tidy, ELK, libavoid, the router worker.
src/editor/       The canvas and everything docked to it. React.
                    canvas/ · nodes/ · edges/ · theme/ · export/
                    props.ts          what the editor is handed (12 groups)
                    useEditorState    the selection, and gestures said as commands
                    testing/          editorHost: the editor over a real reducer
src/documentation/  Descriptions as documents.
                    documentation     outline, element links, the template
                    ui/               DocumentationPage, MarkdownField, mermaid
src/decisions/    Decision records: the status machine, the numbering, the page.
src/search/       One search over elements, documentation and decisions; ⌘K, ⌘F.
src/i18n/         The registry. Each module owns `strings/en.ts` + `strings/nl.ts`;
                  `strings.en.ts` composes them and is the schema.
src/projects/     A project: open, save, order, summarise, address, remember.
                    folderFormat      a project as files (ADR-0003); adrFile · fileText
                    workingFile       the .lvarch container: v3 is the folder, zipped
                    documentSession   dirty / saving / changed on disk / conflict
                    migration         out of browser storage, into the folder
src/platform/     What the app runs inside, and what a failure looks like.
                    errors            ShellError: a refusal as a key, never a sentence
                    diagnostics       what a failure entry is, and how a trail reads
                    logFile           what the desktop log is called, and when it rolls
                    windowChrome      how much of the top bar is the window's
src/widgets/      Presentation with no opinions: icons, one confirm dialog.
src/ports/        The seams. Interfaces only, no implementations.
                    ProjectStore · PreferencesStore · DocumentGateway
                    GroupStore · ProjectHistory · Diagnostics · HostControls
                    ProjectStore.contract.ts — behaviour every store must show
src/adapters/     The outside world, one folder per flavour.
                    webStorage/ · memory/ · browser/ · fileSystem/ · desktop/
                    desktop/          the Electron file channel, as a folder handle
src/app/          The shell around the editor.
                    main.tsx          composition root. Read its header first.
                    composition.ts    which adapter, and which icon packs
                    App · ProjectWorkspace · ShellToolbar · SaveMenu · ToastBar
                    picker/ · dialogs/ · examples/ · iconPacks/ · history/
                    testing/          renderShell / renderApp: the shared harness
                    use*              the hooks: session, files, document, toasts
src/platform/     …and `hostCommands`: what a menu or an OS may ask for.
electron/         The desktop main process and preload.
                    files.ts · fileStore.ts · watch.ts   the file channel
                    git.ts            snapshots, through the machine's own git
                    appMenu.ts        the File menu; every item sends a command
```

**Components declare the interface they need**, not the widest one available.
`useDocumentSession` asks for `{ save(project), load?(ref) }`, not for a
`ProjectStore`, so it cannot reach `list()` or `remove()` and a reader does not
have to check whether it did. `DocumentationPage` asks for one `updateElement`, not the editor's whole
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
`removeAdr` refuse them. Numbers are per list and never reused. A record is one
markdown file with front matter (`projects/adrFile.ts`), and an application's go
in a folder of their own because numbers are per list.

## Groups and projects

There is no customer compiled into this app, and no "shipped document". A
project is addressed by a **`ProjectRef`** — a group path and a key inside it —
and the store holds many. In a working directory the ref IS the path, and the
folder holding a `project.json` is the project (ADR-0003):

```
<working directory>/acme-logistics/warehouse-landscape/project.json
<working directory>/acme/rail/rolling-stock/project.json
```

In a browser tab, which has no folder, the same refs are keys:

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
| Working-file discriminator (in `project.json`) | `lionsville-architecture` |
| npm package name | `lionsville-architecture-management-tool` |
| Desktop bundle id | `nl.lionsville.architecture` |
| Working-directory layout | `<group>/<project>/project.json` |
| Browser storage prefix (the fallback) | `lvarch.project.<group>/<project>` |
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
both open, and version 3 — the project folder in a zip — is what is written
now. `docs/decisions/0001` and `0003` have the long version.

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

Then a change became a **command** (`docs/decisions/0002`), and that phase is
done. The model is indexed by id in memory with `fromArrays`/`toArrays` at the
file boundary (the file itself does not change, and a byte-for-byte round trip
pins that); `apply(model, command)` is the only writer and returns the command
that undoes what it just did; the session holds one stack over everything, so
⌘Z undoes a diagram rename, a decision's status and a project setting as
readily as a node move. A new element gets the key the file would have given it
at the moment it is drawn.

**The editor holds no copy of the document.** Every action builds a command and
dispatches it at the session, which applies it and hands the model back. What
that removed is the whole reason the machinery existed — two brains holding the
same landscape — so `DiagramContentBatch`, the overlay, the merge, the
reconcile, `applyBatch`, temporary ids, the alias map and the editor's own undo
stack are all gone, about 2,700 lines of them. A run of keystrokes into one
field is one undo step (`fieldEdit`, a `coalesce` key, rather than a draft: the
card on the canvas is drawn from the model, so holding the text back means
watching the name you are typing not appear). The toolbar's **Activity** list
is what the log buys that undo did not — names derived from the commands, at
the moment the step is made and against the model as it was, so a delete can
still say what it deleted.

Worth knowing: the last project is resolved at the edge of the app, before the
first render, so the workspace can start synchronously without a `null` case in
every `useState`. It uses `.then` rather than a top-level `await` because Vite's
target (chrome87/safari14) has none. Switching projects **remounts** the
workspace on purpose — the session's undo stack belongs to one project and must
not leak into another. The editor is remounted (`editorKey`) only when the
document has to be laid out again or its diagram ids change, which is the one
thing `needsRemount` is left deciding.

The desktop app ships: `electron/` holds the main process and preload, the
renderer runs under `app://`, and `.github/workflows/release.yml` builds and
signs all three platforms from a published GitHub release (`docs/release.md` is
the operator's page).

Then a project became **a folder of text files** (`docs/decisions/0003`). It
had been kept in localStorage, which on the desktop meant a leveldb inside
`userData`: invisible, unbacked-up, and a different store again under the dev
origin. Now `<group>/<project>/` holds `project.json`, `model.json`, a
definition and a placement file per diagram, a markdown file per description
and per decision, and the marks as images — so a moved node is one small diff
and a rewritten paragraph is a readable one. The single `.lvarch` stays as the
export container and is version 3: that folder, zipped, reproducibly.

What that took, in the order it was built: the format as pure functions with
the round trip and the byte stability pinned; `FileSystemProjectStore` and
`FileSystemGroupStore` over it, writing only what changed and removing only
what the format itself writes; `documentSession` finally wired, so the toolbar
says dirty / saving / changed on disk / conflict and closing the window with
unsaved work is interrupted; a validated IPC file channel in main, with paths
resolved inside the chosen root and writes made atomic; a folder the user
chooses and the app remembers; the projects in browser storage copied in, once,
deleting nothing; and a watcher, with our own writes filtered out by content so
the app does not interrupt itself.

Then the desktop stopped behaving like a tab in a window. `.lvarch` is
associated with the app and a double click reaches the window that is already
open; there is a File menu whose every item sends a command and decides
nothing; saving a file is a save dialog rather than a download; and a build
with no working directory asks for one instead of listing projects kept inside
the app. The last-project preference is not followed there either — it can only
point somewhere that no longer keeps projects.

Layer two of ADR-0003 followed: **history**, on the git that is already on the
machine (`electron/main/git.ts`, through `execFile`, no library). Snapshot from
the Save menu under a message drafted from the command log; History shows what
changed since one, as a **semantic** diff (`model/diff.ts`) — geometry as a
count, because a tidy pass is one sentence and four hundred changed lines.
Everything about it may say no (no git, no repository, no commits, no project at
that snapshot) and none of those may interrupt a save, so the menu offers
nothing rather than failing when pressed.

A browser tab can have a folder too, where Chromium's File System Access API
can give it one: the same store over a directory handle instead of over IPC.
Best effort, and the fallback stays honest — permission to a handle rarely
survives a restart and asking needs a click, so a remembered folder is used
only when the permission is *already* granted and the tab otherwise starts in
browser storage without a word. A tab is offered a folder; only the desktop is
made to choose one.

The smoke run now grants itself a folder and tells the renderer over the same
command the Recent menu uses, then writes a project through the real channel
and reads a file continuously while a large write is in flight — every read one
whole version or the other, which is what a renderer dying mid-save depends on.

Older commit messages and code comments refer to numbered roadmap phases. That
file is gone; the numbering shifted once along the way, so read such a reference
as history, not as a plan.
