# ADR-0005 — Preferences, in three scopes, and a top bar that says where you are

* Status: accepted
* Date: 2026-09-07
* Deciders: Wouter Simons

**Built, 7 September 2026**, in the order the last section gives; `git log`
has the eight commits. The two *Open questions* were answered by the
implementer with the conservative reading, and are marked there — a person
may still decide otherwise.

**One key came and went, 12 September 2026.** The shared file was deliberately
kept keyless here, waiting for the first thing everyone who opens a folder has
to agree on; ADR-0012's first commit put the organisation's name in it, and
scopes took it out again — the root scope's `scope.json` is where a name
belongs, and a name in two files is a name that can disagree with itself. So
`folder.json` is keyless again, still tolerated everywhere, still read on open
rather than live, and still waiting. What the turn added is the writer this
record described and nothing had needed: `writeFolder` takes a patch, carries
every key it does not name through, and has exactly one caller — the 4 → 5
pass, dropping the key it has just read.

## Context and Problem Statement

There is no preferences screen. What a user can configure is real but scattered,
and each setting lives wherever the component that needed it happened to put it:

| Setting | Where it is set today | Where it is kept |
|---|---|---|
| Theme | a glyph button in the shell toolbar that cycles three states | `lvarch.preferences` |
| Language | the **editor's** NL/EN toggle, in `src/editor/`, reached through its `language.onChange` prop | `lvarch.preferences` |
| Project order | a toggle inside the picker | `lvarch.preferences` |
| Editor settings | the editor's own surfaces | `lvarch.preferences` |
| Check for updates | a checkbox on the native update dialog | `update-settings.json` |
| Working directory | File → Open Folder | a preference plus the OS grant |

The blob also carries four keys nobody sets by hand — `lastProject`,
`workingDirectory`, `migratedFolders` and, in the update file, `skippedVersion`.
They are bookkeeping, not preferences; the dialog below leaves them alone and
they are listed here so that nobody wonders whether they were forgotten.

A cycle button is a fine way to change the theme and a poor way to *discover*
that the theme can be changed. More pressingly, the next two features have
nowhere to land. The release channel from the update work has no home, and the
first genuinely folder-shaped setting — whether this machine syncs this working
directory to its git remote — cannot go in `lvarch.preferences` at all, because
it is not a property of this user. It is a property of the folder on this
machine, and the folder has other people in it.

So the question is not "where does the settings dialog go". It is **what a
preference is scoped to**, and the answer turns out to be three different things.

## Decision Drivers

* **A setting belongs to whatever it is actually about.** Theme is about this
  person's eyes. Whether this machine pushes is about this machine. Which of
  those a setting is decides where it is written, and getting that wrong is what
  makes settings files that cannot be shared.
* **A folder has other authors.** ADR-0003 made a project a folder of text files
  precisely so a colleague, a sync client or another machine could be the second
  author. Folder settings inherit that, including the part where two people can
  disagree.
* **Nothing sensitive gets written into a folder.** `CLAUDE.md` says it about
  this repository; a user's working directory is very often a repository too, and
  it is not ours to leak into. **No credential this app writes may ever land in a
  folder** — which decides the whole shape of git sync below.
* **The app does not edit files it does not own.** `isFormatPath` is that rule
  for a project folder: a store replaces and removes what the format writes and
  nothing else. A user's `.gitignore` is theirs, and so is their `.git/config`.
* **The desktop has a menu bar and a browser tab does not.** Anything moved out
  of the toolbar and into the app menu disappears on the web unless something is
  put in its place. This has bitten the toolbar before and must be designed for,
  not discovered.
* **The top bar should answer one question.** Right now it carries Projects…,
  the project's name and group, Settings…, three page buttons, Activity, a
  status line, a theme glyph, **Save** and **Open** — and does not say where any
  of it is kept. That is backwards.
* **The choice is which version survives, and a person makes it.**
  `DiskChangeNotice` already takes this position for one file: there is no merge
  button because there is no merge, and the two answers are *take theirs* and
  *keep ours*. Git sync scales that position up rather than inventing a third.

## Considered Options

1. **One preferences blob, as now, with a dialog over it.** Simplest, and wrong
   the moment a setting belongs to a folder rather than a person: folder settings
   would follow the user to a folder they were never about.
2. **Two scopes: application and folder.** Wrong in the other direction — see
   *Why the folder scope splits*.
3. **Three scopes: application, folder, and folder-on-this-machine.** What this
   record chooses.
4. **Per-project settings as well, in `project.json`.** Rejected for now.
   Nothing today is genuinely per project rather than per folder, and a fourth
   scope with nothing in it is a shape people will fill for the wrong reasons.
   `project.json` already carries the project's *identity*; that is not the same
   as its settings, and conflating them is hard to undo.

## Decision Outcome

**Three scopes, disjoint by construction.** No key appears in more than one, so
there is no precedence, no merge order, and no "which one won" to debug.

### 1. Application — this person, this machine, every folder

Language, theme, project order, the editor's blob, update checking. These
follow the user, not the work.

They keep the two homes they already have, and this is deliberate rather than a
compromise:

| | Where | Why it cannot move |
|---|---|---|
| `lvarch.preferences` | renderer, via `PreferencesStore` | read before the first render, in `main.tsx` |
| `update-settings.json` | main, in `userData` | read **before any window exists**, and before a folder has been chosen |

Main owns the file it must read at startup. The dialog is a client of both — one
face, two sources. Do not attempt to unify them; the second one exists precisely
because it is readable when the first is not.

The second one is **not reachable over the file channel**, and the first draft
of this record said it was. `DesktopFiles` resolves every path inside a folder
the user granted, and `userData` is not one. It also would not be enough: main
keeps the settings in memory and starts or stops its six-hourly timer when they
change (`electron/main/updates.ts`), so a file written behind its back changes
nothing until the next launch. The dialog therefore gets a small typed channel
of its own, `DesktopSettings` beside `DesktopFiles` and `DesktopHistory` in
`adapters/desktop/channel.ts`: read the update settings, write them, and main
reacts to the write the way it reacts to the checkbox today.

### 2. Folder — everyone who opens this working directory

`<root>/.lionsville-architecture/folder.json`, committed and shared. The folder
is named after the working file's discriminator and not after its extension:
`.lvarch/` beside `something.lvarch` is one token meaning two things in the
same directory listing, and file associations, glob patterns and readers would
all have to tell them apart.

**This file has no keys yet, and is not written until it has one.** The first
draft of this record put the git remote and branch here. They came out again,
because git already holds both and the app can read them; a JSON copy would be
a second source of truth that can disagree with `.git/config`, and the record
did not say which wins. It also carried how a snapshot message is drafted, which
is about the person drafting, not the folder. What is left is the scope — its
location, its rules, and the reader that tolerates its absence — and the
decision not to create a file that carries nothing, which is the same argument
this record makes against option 4.

Three consequences of the location, all of them intended, and all of them true
of the machine file below as well:

* **It is outside the project format.** `isFormatPath` decides what
  `FileSystemProjectStore` writes and removes; a root-level dot-folder is not in
  it, so a project save can never delete these and a settings write can never
  look like a project change. The desktop channel accepts the path: only `.`,
  `..` and an empty segment are refused (`safeRelativePath`), not a dot prefix.
* **The watcher ignores it.** `electron/main/watch.ts` skips any path with a dot
  segment at any depth. A colleague changing folder settings will therefore not
  raise a change notice — right for a settings file, and worth knowing, because
  it means folder settings are read on open and not live.
* **It is one folder, not one per group.** Group folders already have
  `group.json`; settings at the root are for the working directory as a whole,
  which is also the unit git works in.

### 3. Folder, on this machine — not shared

`<root>/.lionsville-architecture/local.json`:

```jsonc
{ "version": 1, "git": { "pullOnOpen": true, "pushAfterSnapshot": false } }
```

It is kept out of history **without touching the user's `.gitignore`**.
`initRepository` deliberately writes no app files into that file and never edits
one that already exists — `git.test.ts` pins both, and this record does not flip
either. Two mechanisms instead, and both are wanted:

* The snapshot's `add` excludes the path explicitly, so *our* commits never
  contain it whether or not anything else is configured.
* When the app initialises a repository, or first writes the file into a
  folder that already is one, it adds the path to `.git/info/exclude` — git's
  own local, uncommitted ignore list — so a `git add -A` typed in a terminal
  does not pick it up either.

### Why the folder scope splits

Because "this folder has a remote" and "this machine pushes to it" are different
facts, and only the first one is true for everybody. A laptop syncs; a shared
build machine with the same checkout must not. Put both in one file and the
first person to tick the box decides for everyone.

The rule to hold on to: **git declares what is true about the folder;
`local.json` decides what this machine does about it.** A machine with no
`local.json` does nothing automatically, which is the right way for a missing
file to fail.

### Reading and writing the files

Readers tolerate anything — absent, malformed, a `version` newer than this
build — and fail towards the safe default, the way `readUpdateSettings` already
does. Writers **patch rather than replace**: keys this build does not recognise
are carried through unchanged, for the reason `useShellPreferences` gives about
the blob — an older build must not prune a newer one's settings, and with a
shared file the newer build may be a colleague's.

## Git push and pull

`electron/main/git.ts` already runs the machine's own git through `execFile`,
with no library. Sync extends that and nothing else.

**The app never handles a credential.** No token, no password, no SSH key, no
prompt of our own. Push and pull run the user's git, which uses the user's
credential helper. That sentence is only true if git is told it cannot ask:
every sync call runs with `GIT_TERMINAL_PROMPT=0` and `GIT_SSH_COMMAND` set to
`ssh -o BatchMode=yes`, and under a timeout. Without the first two, a remote
that wants a password makes git wait on a pipe for an answer that never comes,
and `execFile` waits with it — on the desktop, before the first window has
drawn. With them, git fails, and the failure is a refusal the app can name.

**A sync begins with a snapshot.** The app writes files without committing them,
so at the moment of a pull the working tree may hold work no snapshot has
recorded, and a fast-forward that touched those files would refuse. Snapshot
first, under the drafted message; then nothing in the folder is unrecorded and
the pull has a clean tree to move.

New calls on `DesktopHistory`, and on `ProjectHistory` above it. Each answers
with a value, never an exception — a refusal is an ordinary answer here, in the
sense `openProjectDocument` gives the word — and none of them may interrupt a
save (the rule ADR-0003 set for history and this inherits):

| | Answers |
|---|---|
| `remote(root)` | the remote and branch git would push to, or *none* |
| `pull(root)` | *done* · *no-remote* · *unreachable* · *credentials* · *timeout* · **diverged** |
| `push(root)` | *done* · *no-remote* · *unreachable* · *credentials* · *timeout* · **rejected** |
| `resolve(root, side)` | *done*, or the same refusals as `pull` |

`push` pushes `HEAD` to the remote's branch and sets the upstream on the first
success, so a folder that `start()` initialised and that has since been given a
remote in a terminal pushes without a second ceremony.

### When the two sides disagree

A pull that would not fast-forward answers *diverged*; a push the remote
rejects as non-fast-forward is the same fact seen from the other end, and the
app fetches and then treats it as *diverged* too. Neither is merged, rebased or
stashed. The notice says the folder and its remote have both moved on, and
offers the two answers `DiskChangeNotice` offers for one file:

* **Take theirs** — the remote's version of the folder stands. Ours is kept:
  the local state is put on a branch named for the moment
  (`before-sync/<timestamp>`) so it is reachable in any git client, and the
  working branch is reset to the remote's. The open project is then re-read
  from disk, the way it is after a *take theirs* on a single file.
* **Keep ours** — our version stands, as a commit that records the decision.
  `git merge -s ours <remote>/<branch>` writes a merge commit whose tree is
  exactly ours and whose parents are both sides, so the remote's history is
  kept, nothing is force-pushed, and the result fast-forwards for everyone
  else. This is not a merge in the sense the drivers forbid: no line of any
  file is combined, and the outcome is one side, chosen by a person.

Both are done by `resolve`, and both can refuse for the same reasons a pull
can. A refusal there leaves the folder as it was and says so. Anything cleverer
— a line-level merge, a rebase, picking per project — is a separate decision
record, taken deliberately.

`pullOnOpen` runs once when a folder is opened, before the project is read and
**before the watcher starts**, so a fast-forward's writes are never reported as
somebody else's change. A refusal is a notice rather than a failure to open.
`pushAfterSnapshot` runs after a snapshot succeeds, and its failure never unmakes
the snapshot.

## The menu, said once

The File menu's vocabulary — Open Folder…, Open…, Save, working file,
interchange, Snapshot…, History…, Preferences… — and the View menu's, which is
the theme, are **declared once as data in `src/platform/`** beside
`HostCommand`: a label key, a command, an accelerator, and which platforms
carry it. Two things render that list and neither decides anything:

* `electron/main/appMenu.ts`, into the menu bar. Preferences goes where the
  platform puts it — **Settings… ⌘,** in the app menu on macOS, **Preferences…**
  above Quit in the File menu elsewhere — and the theme is three radio items in
  the View menu Electron already builds. A menu that shows a radio has to know
  which one is on, so the renderer reports the mode the way it reports unsaved
  work (`HostCommands.reportUnsaved`), and main asks nothing else. Both
  insertions go through one function that runs once; the `updatesItemAdded`
  flag is the shape to replace, not to copy.
* The toolbar's overflow, one `⋯`, **present on the web and absent on the
  desktop**, carrying the same list. A jsdom test pins that the web build still
  reaches every item, because on the web the overflow is load-bearing.

New `HostCommand`s to carry it: `preferences`, `theme` with a mode,
`exportInterchange`, `snapshot`, `history`. `save` and `export` already exist.

## The dialog

`src/app/dialogs/PreferencesDialog.tsx`, beside the others. An ordinary MUI
dialog, not fullscreen, so it needs no `windowChrome`.

Sections, and a section for a scope that does not exist is **absent, not
disabled** — a disabled control implies one is coming:

* **General** — language, theme, project order. The theme also lives in the
  View menu and the project order also stays in the picker, where its effect is
  on screen; the dialog is where a setting is *found*, not the only place it
  is changed. The glyph leaves the toolbar; the editor's own language toggle is
  withdrawn by no longer passing it `language.onChange`, which its contract
  already provides for.
* **Updates** — check automatically, over `DesktopSettings`. Absent on the web.
  The release channel is **not** here yet: `releases/latest` is by GitHub's
  definition the newest non-prerelease, so a channel needs a different request
  as well as a setting, and both belong to the update record (ADR-0006). This
  section is where it will land.
* **This folder** — absent until `folder.json` has a key.
* **This folder, on this machine** — pull on open, push after snapshot. Written
  to `local.json`, and it says out loud that these are not shared. Present only
  where there is a folder **and** a history: a browser tab with a directory
  handle has a folder and no git, and offering it sync settings would be
  offering something that cannot happen.

The dialog writes on change, not on an OK button. There is no Cancel, because
there is nothing to cancel — every one of these is reversible by setting it back,
and a settings dialog with a transaction is a settings dialog people close the
wrong way. A settings write is not a project change: the document's dirty state
does not move.

## What the top bar becomes

**Save moves into the File menu.** ⌘S is already there and already sends
`{ type: 'save' }`; what moves is the *menu* hanging off the button — working
file, interchange, Snapshot…, History… — which is File-menu vocabulary that
ended up in a toolbar because there was no File menu when it was written.
**Open** goes with it, and the theme glyph goes to View. On the web all of it
is in the overflow, above.

What stays: **Projects…**, because it is how you leave; the project's name and
its group, with **Settings…** beside them, because that is what you have open;
the three page buttons; **Activity**; the status. What is added is **what you
are working from**, the question the bar does not answer today. A new type in
`src/platform/`, because both the shell and the adapters have to understand it
and neither owns it:

```ts
export type WorkingSource =
  | { kind: 'folder'; name: string; root: string }
  | { kind: 'browserStorage' }   // the fallback, and it says so
  | { kind: 'memory' }           // storage refused; nothing outlives this tab
```

There is no `workingFile` case, and the first draft had one: opening a
`.lvarch` loads its bytes into the project that is open
(`openProjectDocument`), so nobody ever works *from* the file. `memory` is the
case that draft was missing, and it is the one where saying so matters most —
the standing strip at the foot of the window says it today and keeps doing so.

A union and not a string, so the thing that comes after these — a server, a
shared drive — is a new case the compiler asks about at every site rather than a
label somebody has to remember to handle. The bar reads, left to right: source,
then group and project, then the status beside them.

## Consequences

* Three scopes, two files, and one of them not written yet. `local.json` is
  the first machine-local file the app puts in somebody's folder; the dialog
  says where it is edited that it stays on this machine.
* `.lionsville-architecture/` in a working directory is new surface in someone
  else's repository. It is one dot-folder with at most two small JSON files, and
  the app tolerates both being absent, malformed or newer than it understands.
* Git sync makes the app capable of changing a remote. Everything about it can
  refuse, every refusal is a notice — never a modal, never a blocked save — and
  a disagreement is put to a person with two answers that both keep everything.
* The toolbar gets simpler and the menu bar gets longer. On the web nothing is
  lost, but the overflow is now load-bearing and has a test that says so.
* One more thing flows from the renderer to main: the theme, so a radio item
  can be right. It joins unsaved work as the second such fact, and should not
  quietly become the tenth.

## What this takes, in order

Each step ends green (`npm run check`), and the desktop steps want `npm run
verify` before a push.

1. **The scopes as pure code.** `src/projects/folderSettings.ts`: the two
   shapes, readers that tolerate anything, writers that patch and emit stable
   JSON. Unit tests, node. Nothing touches a disk yet.
2. **A seam to reach them.** `src/ports/FolderSettings.ts` plus a contract suite
   the way `ProjectStore.contract.ts` does it. **One** implementation, over
   `DirectoryHandleLike` — the IPC handle and the browser handle both satisfy
   it, which is how `FileSystemGroupStore` avoids two. Absent on `Shell` when
   there is no folder, the way `history?` is, rather than a null object that
   answers "no" to everything. One line in `composition.ts`.
3. **The menu as data, and the overflow.** The item list in `src/platform/`,
   `appMenu.ts` rendering it, the web-only `⋯` rendering it, the new
   `HostCommand`s, the theme's View items with the mode reported back, and the
   jsdom test that every item is reachable on the web. `SaveMenu` and the
   glyph leave the toolbar here. **First**, because the web cannot reach the
   dialog in the next step without it.
4. **The dialog, General and Updates.** `DesktopSettings` on the channel and in
   main, the `preferences` command wired to the menu and the overflow,
   `PreferencesDialog.tsx`, the strings in `src/app/strings/{en,nl}.ts`. The
   editor's language toggle is withdrawn. Component tests through `renderShell`.
5. **The machine section.** Wired to step 2. Absent when there is no folder or
   no history.
6. **`WorkingSource` and the top bar.** The union in `src/platform/`, the bar
   rewritten around it, and the `memory` case shown.
7. **Git sync.** `remote` / `pull` / `push` / `resolve` in `electron/main/git.ts`
   and on the channel, refusals first and the happy path second, against a
   bare repository in a temporary folder in `git.test.ts` — that suite already
   runs real git. Then the notice with its two answers, then `pullOnOpen` and
   `pushAfterSnapshot` read from `local.json`. A smoke step over a real
   repository with a real local remote, alongside the file-channel ones.
8. **Update `CLAUDE.md`**: the state of play, and the dot-folder's name in
   *Names, decided*.

Steps 1–6 are independent of the update work in ADR-0006; step 4 is what gives
the release channel somewhere to live, so it should land first.

## Open questions

Nobody has decided these, and the agent picking this up should ask rather than
choose:

* **Does *keep ours* push straight away?** The merge commit is made to be
  pushed, and leaving it local means the next automatic push does it anyway.
  Whether the notice's button should say so — *Keep ours and push* — or leave
  the push to the setting, is a wording question with a behaviour inside it.
  *As built:* the push follows the setting. The merge commit is a snapshot in
  every sense, so `pushAfterSnapshot` decides, and the button says *Keep ours*.
* **Should a refused pull offer to open the folder in the user's git client**,
  for the cases `resolve` cannot handle? Which client, and how the app would
  know, is the part nobody has an answer to. *As built:* no; the notice names
  the refusal and leaves the folder as it was.
