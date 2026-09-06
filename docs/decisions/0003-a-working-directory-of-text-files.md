# ADR-0003 — A working directory of text files

* Status: accepted
* Date: 2026-09-06
* Deciders: Wouter Simons

## Context and Problem Statement

A landscape is a document about an organisation that a team argues over for
years. This tool keeps it somewhere the team cannot see.

Projects live in `localStorage`, and on the desktop that is `localStorage` too:
`src/app/composition.ts` has no desktop branch, `electron/preload/index.ts`
exposes `platform` and `versions` and nothing else, and there is no
`ipcMain.handle`, no dialog, no `node:fs`. So a shipped desktop application
keeps its user's documents in a leveldb inside `userData`, under the origin
`app://local` — invisible in a file manager, outside every document backup,
stranded by any change to the scheme or the product name, and a *different*
store again when the same build runs under `http://localhost` in dev or in the
smoke run. Nobody chose that. It is what a browser tab does, packaged.

The escape hatches are not escapes. "Save" is an `<a download>`
(`BrowserDocumentGateway.ts`), "Open" is a hidden `<input type="file">`, and
`ports/DocumentGateway.ts` has no `open()` — nothing retains a handle or a path,
so "save back to the file I opened" cannot be *expressed*, let alone
implemented. Nothing tracks whether there is unsaved work: `dirty` and `unsaved`
appear only in `projects/documentSession.ts`, which nothing imports; the
`beforeunload` handler in `useAutosave.ts` saves fire-and-forget without
`preventDefault`, and gets away with it only because `localStorage.setItem`
happens to be synchronous. And the whole thing runs on an unmanaged budget: an
autosave every 400 ms serialises the entire project — logos inline as base64, up
to 200 KB each (`model/logo.ts`) — into roughly five megabytes of origin quota,
with no check anywhere.

Meanwhile the document itself is the kind of thing version control was invented
for: mostly text, changed by several people, reviewed, and interesting mainly in
the diff between two Tuesdays.

## Decision Drivers

* **The document belongs to the user.** It must be somewhere they can point at,
  copy, back up, mail, and open next year with something that is not this tool.
* **A change should read as a change.** Moving one node must not rewrite the
  file that says what the model *is*.
* **The truth about unsaved work**, said out loud, at the moment quitting would
  lose it.
* **One store, several backends.** The browser's directory handle and an
  Electron IPC channel must be the same adapter with a different handle behind
  it, or the interesting half gets written twice and tested once.
* **Cost proportional to the change.** ADR-0002 made every change a named
  command, so the writer can be told which files are dirty rather than
  rewriting a project per keystroke.
* **A history that reads like the work.** The same command log drafts the
  commit message, which is what makes the git layer worth having rather than a
  wall of "Update project".

## Considered Options

1. Keep browser storage; add an explicit export/import ceremony around it.
2. One `.lvarch` file per project in a folder the user chose — what
   `FileSystemProjectStore` does today.
3. **A folder per project**, one document per thing that changes
   independently, with the single file kept as the export container.
4. A database file (SQLite) in the chosen folder.

## Decision Outcome

**Option 3.** A project is a folder of text files inside a working directory the
user chose; the single-file `.lvarch` stays, as the thing you *hand to somebody*
rather than the thing you work in.

```
<working directory>/
  <group>/                       group path segments as nested folders
    group.json                   GroupProfile (name, description, links)
    decisions/0001-<slug>.md     group-level ADRs, MADR with front matter
    <project>/
      project.json               name, groupName, description, defaults, formatVersion: 3
      model.json                 elements and connections, sorted by id
      diagrams/<id>.json                 kind, name, settings, layoutConfig
      diagrams/<id>.placements.json      placements and routes: where things sit
      docs/<elementId>.md        the element's description, as markdown
      decisions/0007-<slug>.md   project and application ADRs
      logos/<key>.svg | .png     uploaded marks, referenced by key
```

The rules that make it diff well are part of the decision, not a style
preference: two-space JSON with a trailing newline, object keys sorted, arrays
sorted by id where order carries no meaning and left alone where it does, and
**no timestamps inside files** — `updatedAt` comes from the file system, as the
folder store already does. A field whose only job is to say when it was written
turns every save into a diff.

**Layout is independent of the model, and that is the load-bearing split.** A
diagram's definition — what it is, what it shows, how it is configured — and
where its elements ended up on the board are two files. Placements and routes
are the output of a layout run and change on every drag; the definition changes
when somebody decides something. Keeping them apart means an afternoon of
tidying produces a diff in `.placements.json` alone, a reviewer can read a model
change without wading through coordinates, and a project whose placement files
were deleted still opens — the layout is simply recomputed. The definition file
never names a coordinate; the placement file never names anything but ids.

Two smaller consequences of the same reasoning. **Descriptions become
markdown files**, because a paragraph rewritten inside a JSON string is an
unreadable diff and the same paragraph in a `.md` file is a normal one. And
**uploaded logos become files**, which takes the base64 out of the document
entirely: `logos/<key>.svg` is a thing a person can look at, and the model keeps
the key it already keeps.

**In the file, the group's name is `groupName`.** The model calls it
`customerName` and this shell has read that field as "the group's label" since
there stopped being a customer. Renaming it in memory is a sweep for another
day; a *new* file format is the free moment to stop writing the wrong word onto
disk, so the v3 reader and writer map the two.

**The seam does not move.** `ProjectStore` stays the same five lines;
`FileSystemProjectStore` swaps the single file for the layout above and gains
the `type` / `version` envelope it was missing, so both `.lvarch` shapes agree;
`DirectoryHandleLike` remains the abstraction, and the Electron adapter is a
second implementation of it rather than a second store. Browser storage stays,
demoted to what it always was — the fallback for a tab with no folder.

The single file becomes **version 3: a zip of the folder**, which is what the
header comment in `model/hostModel.ts` reserved when it refused to promise JSON
in the extension. Versions 1 and 2 keep opening. The interchange format is
untouched: it is a contract with other tools and has nothing to do with how we
keep our own working copy.

**History is layer two, and it is opt-in.** The folder diffs well on its own and
that is worth having with no further machinery — anybody can run `git` in it.
Inside the app, a snapshot and a history page are offered only where they can
work: the desktop, with git already on the machine, in a folder the user has
said yes for. It runs the **system binary** through `execFile` rather than a
library, because the six commands involved are the whole of what this needs, no
shell means a folder name cannot become an argument, and a git library is a
dependency trusted with somebody's repository. A machine without git simply has
no history, and nothing else changes — degrading is the requirement, not the
fallback.

The diff shown there is **semantic** (`model/diff.ts`). `git diff` answers
"which lines changed" and this answers "what happened to the architecture", and
the difference is the whole value: moving forty nodes is four hundred lines and
one sentence. Geometry is therefore a count and never a list.

### Consequences

* Documents are where the user put them, in a folder that syncs, backs up and
  commits like everything else they own.
* A moved node is one small diff in one placement file; a rewritten description
  is one markdown file; a renamed diagram touches neither.
* Per-file writes are cheap because the command log says what changed
  (ADR-0002). Without that this would still work and would rewrite everything.
* A partially written project is recoverable: the model survives a broken
  placement file, and a missing placement file means "not laid out yet" rather
  than an error.
* Writes become atomic (temp name, fsync, rename) and the quota problem is
  gone, along with the five-megabyte ceiling on how large a landscape may get.
* **A project is a folder, not a file.** Mailing one means the zip export — a
  real cost, paid deliberately, and the reason v3 exists at all.
* **Formatting has to be pinned by tests.** If two saves of an unchanged
  project can differ by a byte, every autosave is a commit's worth of noise and
  the whole point is lost. The writers are pure functions with byte-stability
  tests for exactly this reason.
* **The IPC channel is a security boundary.** Every path from the renderer is
  untrusted: resolved under the chosen root, `..` and symlink escapes refused,
  every payload's shape validated in main.
* Browser directory-handle permissions do not reliably survive a restart, so
  the browser's folder mode is best-effort and the localStorage fallback has to
  stay honest about which one is in use.
* Migration out of localStorage is one-way and must not delete what it copied
  until the user has opened the migrated folder once.

### Confirmation

* `git diff` after moving one node shows one change in one `.placements.json`
  and nothing else; after editing a description, one markdown file.
* Two saves of an unchanged project are byte-identical (unit test on the
  writer, not on the store).
* The contract suite in `ports/ProjectStore.contract.ts` passes over the memory,
  webStorage, browser-handle and IPC adapters alike.
* The smoke run chooses a temp folder, creates a project, is killed mid-write,
  reopens, and finds the previous file intact.
* A `.lvarch` from version 1 and from version 2 still opens; a v3 export opens
  on a second machine with its logos.

## Pros and Cons of the Options

### Keep browser storage with an export ceremony

Cheapest, and it is what exists. But it leaves the desktop application keeping
documents in a browser profile, keeps the quota, keeps "save" meaning
"download", and makes version control something the user does *to exports* —
which means it is done rarely, by hand, and is out of date.

### One file per project in a chosen folder

Fixes ownership and backup in an afternoon, and is genuinely most of the value:
the file is visible, syncable, mailable. It fails the diff test. A single JSON
document means every drag rewrites the same file, a description lives as an
escaped string inside it, and a review of "what changed in the landscape" is a
review of coordinates. It is also the shape that pushes logos to stay inline.

### A folder per project

More files to write, an ordering discipline to keep, and a project that is no
longer one thing you can attach to an email. In exchange: diffs that read,
independent recovery, cheap partial writes, logos and prose as themselves, and a
format a human can edit in an emergency without a tool.

### SQLite in the folder

Excellent at the mechanics — atomic, indexed, no formatting discipline — and
wrong for the goal. A binary file diffs as "changed", which forfeits the layer
of value that costs nothing here, and it puts a native dependency between the
user and their own document.

## More Information

The phase brief this comes from; ADR-0002 for the command log that makes
per-file writes cheap and drafts the commit messages; ADR-0001 for why files
written under the tool's previous name are not read, and for the version
lineage this extends.
