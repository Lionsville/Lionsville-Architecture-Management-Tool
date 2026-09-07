# ADR-0005 — Preferences, in two scopes, and a top bar that says where you are

* Status: proposed
* Date: 2026-09-07
* Deciders: Wouter Simons

**This record is a design, not a report.** Nothing in it is built. It is written
for the agent who picks the work up; the last section is the order to build it
in, and *Open questions* is what nobody has decided yet.

## Context and Problem Statement

There is no preferences screen. What a user can configure is real but scattered,
and each setting lives wherever the component that needed it happened to put it:

| Setting | Where it is set today | Where it is kept |
|---|---|---|
| Theme | a glyph button in the toolbar that cycles three states | `lvarch.preferences` |
| Language | a toolbar control | `lvarch.preferences` |
| Project order | a toggle inside the picker | `lvarch.preferences` |
| Editor settings | the editor's own surfaces | `lvarch.preferences` |
| Check for updates | a checkbox on the native update dialog | `update-settings.json` |
| Working directory | File → Open Folder | a preference plus the OS grant |

A cycle button is a fine way to change the theme and a poor way to *discover*
that the theme can be changed. More pressingly, the next two features have
nowhere to land. The release channel from the update work has no home, and the
first genuinely folder-shaped setting — whether this working directory syncs to a
git remote — cannot go in `lvarch.preferences` at all, because it is not a
property of this user. It is a property of the folder, and the folder has other
people in it.

So the question is not "where does the settings dialog go". It is **what a
preference is scoped to**, and the answer turns out to be three different things.

## Decision Drivers

* **A setting belongs to whatever it is actually about.** Theme is about this
  person's eyes. A git remote is about this folder, and stays true when someone
  else opens it. Which of those two a setting is decides where it is written,
  and getting that wrong is what makes settings files that cannot be shared.
* **A folder has other authors.** ADR-0003 made a project a folder of text files
  precisely so a colleague, a sync client or another machine could be the second
  author. Folder settings inherit that, including the part where two people can
  disagree.
* **Nothing sensitive gets written into a folder.** `CLAUDE.md` says it about
  this repository; a user's working directory is very often a repository too, and
  it is not ours to leak into. **No credential this app writes may ever land in a
  folder** — which decides the whole shape of git sync below.
* **The desktop has a menu bar and a browser tab does not.** Anything moved out
  of the toolbar and into the app menu disappears on the web unless something is
  put in its place. This has bitten the toolbar before and must be designed for,
  not discovered.
* **The top bar should answer one question.** Right now it carries a Save button,
  an Open button, a status line, a theme glyph and three page buttons — and does
  not plainly say what you have open. That is backwards.
* **A refusal beats a lie** (ADR-0004's driver, and `DiskChangeNotice`'s). Where
  the app cannot decide — a git conflict, a remote it cannot reach — it says so
  and stops. There is no merge button, because there is no merge.

## Considered Options

1. **One preferences blob, as now, with a dialog over it.** Simplest, and wrong
   the moment a setting belongs to a folder rather than a person: folder settings
   would follow the user to a folder they were never about.
2. **Two scopes: application and folder.** What this record chooses, with one
   qualification below.
3. **Three scopes: application, folder, and folder-on-this-machine.** The
   qualification, and it is not optional — see *Why the folder scope splits*.
4. **Per-project settings as well, in `project.json`.** Rejected for now.
   Nothing today is genuinely per project rather than per folder, and a fourth
   scope with nothing in it is a shape people will fill for the wrong reasons.
   `project.json` already carries the project's *identity*; that is not the same
   as its settings, and conflating them is hard to undo.

## Decision Outcome

**Three scopes, disjoint by construction.** No key appears in more than one, so
there is no precedence, no merge order, and no "which one won" to debug.

### 1. Application — this person, this machine, every folder

Language, theme, project order, the editor's blob, update checking, update
channel. These follow the user, not the work.

They keep the two homes they already have, and this is deliberate rather than a
compromise:

| | Where | Why it cannot move |
|---|---|---|
| `lvarch.preferences` | renderer, via `PreferencesStore` | read before the first render, in `main.tsx` |
| `update-settings.json` | main, in `userData` | read **before any window exists**, and before a folder has been chosen |

Main owns the file it must read at startup. The dialog is a client of both, over
the file channel — one face, two sources. Do not attempt to unify them; the
second one exists precisely because it is readable when the first is not.

### 2. Folder — everyone who opens this working directory

`<root>/.lvarch/folder.json`. Committed, shared, and about the folder:

```jsonc
{
  "version": 1,
  "git": { "remote": "origin", "branch": "main" },  // this folder is backed by a remote
  "snapshotMessages": "from-activity"               // how a snapshot's message is drafted
}
```

Three consequences of the location, all of them intended:

* **It is outside the project format.** `isFormatPath` decides what
  `FileSystemProjectStore` writes and removes; a root-level dot-folder is not in
  it, so a project save can never delete these and a settings write can never
  look like a project change.
* **The watcher ignores it.** `electron/main/watch.ts` skips any path with a dot
  segment at any depth. A colleague changing folder settings will therefore not
  raise a change notice — right for a settings file, and worth knowing, because
  it means folder settings are read on open and not live.
* **It is one folder, not one per group.** Group folders already have
  `group.json`; settings at the root are for the working directory as a whole,
  which is also the unit git works in.

### 3. Folder, on this machine — not shared

`<root>/.lvarch/local.json`, and **the app adds it to `.gitignore`** when it
initialises a repository or first writes the file.

### Why the folder scope splits

Because "this folder has a remote" and "this machine pushes to it" are different
facts, and only the first one is true for everybody. A laptop syncs; a shared
build machine with the same checkout must not. Put both in one file and the first
person to tick the box decides for everyone.

```jsonc
{ "version": 1, "git": { "pullOnOpen": true, "pushAfterSnapshot": false } }
```

The rule to hold on to: **`folder.json` declares what is true about the folder;
`local.json` decides what this machine does about it.** A machine with no
`local.json` does nothing automatically, which is the right way for a missing
file to fail.

## Git push and pull

`electron/main/git.ts` already runs the machine's own git through `execFile`,
with no library. Sync extends that and nothing else.

**The app never handles a credential.** No token, no password, no SSH key, no
prompt of our own. Push and pull run the user's git, which uses the user's
credential helper, and if git wants something we cannot give it the operation
fails and says so. This is not a limitation to work around later — it is the
reason the folder settings can be committed at all.

New calls on `DesktopHistory`, each of which may answer no, and none of which may
interrupt a save (the rule ADR-0003 set for history and this inherits):

| | Refuses when |
|---|---|
| `remotes(root)` | no repository |
| `pull(root)` | no remote, unreachable, or **anything that is not a fast-forward** |
| `push(root)` | no remote, rejected, or credentials unavailable |

**A pull that would merge is refused.** Not merged, not rebased, not stashed —
refused, with a message saying the folder has diverged and that a git client is
where that gets resolved. `DiskChangeNotice` already takes this position for one
file and the reasoning scales: the choice is which version survives, and
pretending we can decide is the one place this tool would lie about what it had
done. Anything cleverer is a separate decision record, taken deliberately.

`pullOnOpen` runs once when a folder is opened, before the project is read, and a
refusal is a notice rather than a failure to open. `pushAfterSnapshot` runs after
a snapshot succeeds, and its failure never unmakes the snapshot.

## The dialog

`src/app/dialogs/PreferencesDialog.tsx`, beside the others. An ordinary MUI
dialog, not fullscreen, so it needs no `windowChrome`.

Reached by a new `{ type: 'preferences' }` `HostCommand` — the menu keeps
deciding nothing (`appMenu.ts`). **Settings… ⌘,** in the app menu on macOS,
inserted the way *Check for Updates…* already is; **Preferences…** at the foot of
the File menu on Windows and Linux. In a browser tab, which has no menu bar, it
opens from the toolbar's overflow.

Four sections, and a section for a scope that does not exist is **absent, not
disabled** — a browser tab with no folder has no folder settings, and a disabled
control implies one is coming:

* **General** — language, theme, project order.
* **Updates** — check automatically, release channel (stable / pre-release).
  Over IPC to main's file. Absent on the web.
* **This folder** — git remote and branch, snapshot message style. Written to
  `folder.json`, and it says out loud that these are shared.
* **This folder, on this machine** — pull on open, push after snapshot. Written
  to `local.json`, and it says out loud that these are not.

The dialog writes on change, not on an OK button. There is no Cancel, because
there is nothing to cancel — every one of these is reversible by setting it back,
and a settings dialog with a transaction is a settings dialog people close the
wrong way.

## What the top bar becomes

Today the toolbar carries the design name, a status line, three page buttons, a
theme glyph, **Save** (a contained button opening `SaveMenu`) and **Open**.

**Save moves into the File menu.** ⌘S is already there and already sends
`{ type: 'save' }`; what moves is the *menu* hanging off the button —
Save a Copy… (the working file), Export…, Snapshot…, History… — which is
File-menu vocabulary that ended up in a toolbar because there was no File menu
when it was written.

**But the web build has no menu bar**, and this is the trap to design for rather
than trip over. The toolbar keeps an overflow — one `⋯` — carrying exactly the
same items, and it is **present on the web and absent on the desktop**. One
source of truth for the item list, two places that can render it; a jsdom test
pins that the web build still reaches every one of them.

What the bar shows instead is **what you are working from**, which is the
question it currently does not answer. A new type in `src/platform/`, because
both the shell and the adapters have to understand it and neither owns it:

```ts
export type WorkingSource =
  | { kind: 'folder'; name: string; root: string }
  | { kind: 'workingFile'; name: string }   // a .lvarch opened directly
  | { kind: 'browserStorage' }              // the fallback, and it says so
```

A union and not a string, so the thing that comes after these — a server, a
shared drive — is a new case the compiler asks about at every site rather than a
label somebody has to remember to handle. The bar shows the source's name, its
kind, and the save status beside it. Nothing else about the file.

## Consequences

* Two scopes become three files, and a user can now put a setting somewhere a
  colleague will see. `folder.json` is committed on purpose; the dialog has to
  say so where it is edited, not in a doc nobody opens.
* `.lvarch/` in a working directory is new surface in someone else's repository.
  It is one dot-folder with at most two small JSON files, and the app must
  tolerate both being absent, malformed or newer than it understands — the same
  way `readUpdateSettings` already tolerates a hand-edited file, failing towards
  the safe default rather than away from it.
* Git sync makes the app capable of changing a remote. Everything about it can
  refuse, and every refusal is a notice — never a modal, never a blocked save.
* The toolbar gets simpler and the File menu gets longer. On the web nothing is
  lost, but the overflow is now load-bearing and needs a test that says so.

## What this takes, in order

Each step ends green (`npm run check`), and the desktop steps want `npm run
verify` before a push.

1. **The scopes as pure code.** `src/projects/folderSettings.ts`: the two shapes,
   readers that tolerate anything, writers that emit stable JSON. Unit tests,
   node. Nothing touches a disk yet.
2. **A seam to reach them.** `src/ports/FolderSettings.ts` plus a contract suite
   the way `ProjectStore.contract.ts` does it. Implementations over the desktop
   file channel and over a `FileSystemDirectoryHandle`; a null one for browser
   storage, whose honest answer is "there is no folder". One line in
   `composition.ts`.
3. **The dialog, General and Updates only.** The `preferences` `HostCommand`, the
   menu items, `PreferencesDialog.tsx`, the strings in `src/app/strings/{en,nl}.ts`.
   The theme and language controls move out of the toolbar. Component tests
   through `renderShell`.
4. **The folder sections.** Wired to step 2. Absent when there is no folder.
5. **`WorkingSource` and the top bar.** The union in `src/platform/`, the bar
   rewritten around it, `SaveMenu`'s items moved into the File menu, and the
   web-only overflow with the test that pins it.
6. **Git sync.** `remotes` / `pull` / `push` in `electron/main/git.ts` and on the
   channel, refusals first and the happy path second. Then `pullOnOpen` and
   `pushAfterSnapshot` read from `local.json`. A smoke step over a real
   repository with a real local remote, alongside the file-channel ones.
7. **Update this record** to *accepted*, and `CLAUDE.md`'s state of play.

Steps 1–5 are independent of the update work in ADR-0006-to-be; step 3 is what
gives the release channel somewhere to live, so it should land first.

## Open questions

Nobody has decided these, and the agent picking this up should ask rather than
choose:

* **Does `folder.json` belong in git at all?** It is committed here on the
  argument that a remote is a fact about the folder. The counter-argument is that
  it is the app's file in the user's repository, and some users will not want it
  there. A `.gitignore` entry for the whole of `.lvarch/` is the other position.
* **What does the app do when git refuses a pull?** A notice is specified.
  Whether it should also offer to open the folder in the user's git client, and
  how it would know which one, is undecided.
* **Should the theme glyph stay in the toolbar** as well as living in
  preferences? It is one click for the most-changed setting in the app, and the
  argument for removing it is consistency rather than use.
