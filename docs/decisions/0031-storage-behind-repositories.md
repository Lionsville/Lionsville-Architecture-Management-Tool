# ADR-0031 — Storage behind repositories: the domain speaks no storage language

* Status: accepted, 29 September 2026; not yet built
* Date: 2026-09-29
* Deciders: Wouter Simons
* Supersedes:
  * ADR-0003, in part. *The seam does not move*: `DirectoryHandleLike` is no
    longer the abstraction the app reads through. *History is layer two* as
    git inside the seam goes too. The folder stays the desktop's own
    implementation.
  * ADR-0008, in part.
    * Q1: filtering history by file path in the adapter.
    * Q2: the revert as a new commit. The *command* that makes the present
      equal a past state stays.
    * Q3: labels as git tags.
  * ADR-0009, in part. Q4 "images are files in the folder", and the
    `../images/` reference inside the model.
  * ADR-0012, in part.
    * Principle 1, "a scope is a folder": a scope has an address and an
      identity.
    * §1's layout as a rule of the domain.
    * §7's history as a union of files.
  * ADR-0022, in part. The amendments that made `ports/DirectoryHandle.ts` and
    the folder store the base other providers fill, `FolderSettings` as a
    port, and the "file channel" for work across scopes.
* Pointers only: ADR-0005, 0007, 0011, 0018, 0021, 0023, 0025 and 0028 each
  describe the folder or git as where things are kept. That stays true of the
  desktop's implementation. Each carries a pointer here.
* Builds on: ADR-0002 (commands as the unit of change), ADR-0022 (a source is
  a provider), ADR-0028 (a command says what it writes)

## Context and Problem Statement

Core's storage seam is a file system:
- **`ScopeStore` runs over `DirectoryHandleLike`,** with `model.json`, `docs/`,
  `images/`, listings and paths.
- **`ProjectHistory`** is git: entries are commits, "what a thing is" is a list
  of file-path patterns, and the port carries pull, push and a remote.
- **`FolderSettings`** reads a folder.
- **The domain holds the folder format.** `projects/folderFormat.ts` sits in
  `projects/`, and the working file, the revision and history subjects are
  built from `FolderFile`s.
- **Images are named by path** inside documents (`../images/x.png`).
- **The React tree carries folder concepts** (`AppFolder`, `WorkingSource`
  `{ kind: 'folder' }`), and the entry point calls folder-specific functions
  of the composition root by name.

That was natural while the only places work was kept were a folder, this
browser's storage and memory. It stops being natural once a provider keeps
work somewhere that is not a file system (ADR-0022). Such a provider has two
choices. It can pretend to be a directory, so that every read the app makes
arrives as listings and file reads it must answer. Or it can bypass the
seam, and then it is no longer a seam. Either way the domain decides how
storage works, because its seam is written in one storage's words.

## Decision Drivers

* **The domain speaks no storage language.** Model, projects, documentation,
  agent, app and UI code name no file, folder, path inside a scope, commit,
  table, URL or query.
* **The domain never knows an adapter.** Implementations are chosen in the
  composition root and handed in. Nothing else names one, and a lint rule and
  an architecture test fail the build if anything does.
* **Contracts fit the richest store, not the simplest.** A repository's
  contract is written for a store that can index, page and answer at the
  level of a record. The folder implementation meets it by doing more work
  itself: walking, parsing, scanning its history. It does not narrow the
  contract to what a folder does easily.
* **The desktop keeps its behaviour.** A folder a person can open, read and
  version with git stays the desktop's way of keeping work, and the working
  file stays a zip of that folder.
* **Every contract has a suite,** as every port does today (ADR-0022), and
  every implementation runs it.

## Considered Options

1. Keep the file-system seam and let other providers emulate a directory.
2. Add record-level members to the existing ports beside the file-level ones.
3. **Repositories in the domain's words**, with the folder, browser storage
   and memory as implementations behind them, and the folder format moved
   into the folder implementation.

## Decision Outcome

Option 3.

**Why not the others.**
- **Option 1** makes every provider pay for the folder's shape and keeps the
  domain deciding storage.
- **Option 2** keeps both languages in the seam. The file-level members
  would keep being used, because they are already there.

### 1. The repositories

Each is a port in `src/ports/`, with a contract suite, and speaks in the
model's types only:

| Repository | What it answers | What it takes |
|---|---|---|
| `ScopeRepository` | The tree of scopes (address, identity, name, kind, parent). A scope's state (its records, documents and image library) with its revision. | Steps to apply, one scope or several together. Create, move and remove a scope. |
| `OrganisationIndex` | The index over every scope, with its revision. What changed since a revision. | — (it follows the steps) |
| `HistoryRepository` | Entries of a scope or of one thing (by record kind and id), paged. The state at an entry. Labels. | A label. A way back is a step through `ScopeRepository`. |
| `ImageRepository` | A scope's image library (file name, media type, size, dimensions, content address). An image's bytes by name, asked for when the image is shown. | An image's bytes and file name, answered with its content address. The step that adds it to the library goes through `ScopeRepository`. |
| `SettingsRepository` | The organisation's and a scope's settings, and the person's own on this install. | Settings to keep. |

A scope has an **address**: its path in the tree, which is how people and
links name it. It also has an **identity**: an id a move does not change. A
**revision** is opaque to the domain. It is only compared for equality.

The existing ports that speak no storage language stay as they are:
`CommandChannel`, `PreferencesStore`, `UpdateSettings`, `HostControls`,
`Diagnostics` and `AgentGateway`. `DirectoryHandle`, `ProjectHistory`,
`FolderSettings` and `ScopeStore` are replaced.

### 2. The folder is an implementation, and so is its format

`folderFormat.ts`, the revision by file fingerprint and the history subjects
by path move into the folder implementation (`adapters/folder/`), with the
File System Access and IPC directory handles under it. The working file
(ADR-0018, 0023) is an **interchange format**: the folder format, zipped.
Its codec lives with the folder implementation, and any source can export
to it and import from it through the repositories.

The folder implementation meets each contract in its own way:
- **State.** It reads and writes `model.json`, `docs/` and `images/` as
  today.
- **History.** It keeps using git: entries are commits, and a thing's history
  is the adapter mapping a record to the paths that hold it. It works harder
  than a store with an index, and that is its cost to carry.
- **Labels** are tags.
- **Pull, push and a remote** are the folder implementation's own capability,
  offered through its provider's chrome (ADR-0022). They are not a member of
  any repository.

Browser storage and memory are implementations too. Each runs the same
suites.

### 3. Images are named by their file name and loaded when shown

**An image is named by its file name,** unique in its scope's image library.
A document refers to it as `![alt](image:diagram.png)`: a name, not a path.
The library may have folders, carried in the name
(`image:diagrams/context.png`). An implementation must list a folder and
find a name without scanning the whole library.

**The library is part of the scope's state.** For each image it holds the
file name, media type, size, width and height, and a content address.
`DocumentImage` keeps no data URL, and the model holds no bytes.

**Loaded when shown.** Rendering lays out every image from the library's
dimensions at once. It asks `ImageRepository` for an image's bytes only when
the image comes into view: on a board, in a document or in a report. So:
- reading a scope never reads a picture;
- scanning a long document loads only the pictures looked at;
- nothing on the page moves when they arrive.

A smaller rendition for a preview is an optimisation an implementation may
offer. It is not part of the contract.

**On disk,** the folder implementation keeps `images/<file name>`, and writes
`../images/<file name>` into the document, so a folder still reads well in
any markdown viewer. It translates both ways, and the domain never sees a
path.

### 4. The composition root is the only place that chooses

`app/composition.ts` builds each source's repositories and hands them to the
app as one value. Folder-specific entry points leave the app's props and
`main.tsx`. Choosing a folder, recent folders and watching a folder become
the folder provider's chrome and "way in" (ADR-0022). `WorkingSource`
names a source and its display name, not a kind of storage.

**The rule, enforced:**
- **No imports across the line.** Nothing outside `adapters/`,
  `platform/node/`, `electron/` and the composition root imports an
  implementation, or the folder format.
- **No storage words in logic.** A test fails when app, domain or UI code
  names a storage mechanism in code, and a list of known exceptions only
  shrinks.
- **Strings stay free of storage too.** A person may still be told about
  *their folder* where the folder provider's own chrome speaks.

## Consequences

* **A provider that keeps work in a database, a service or anything else
  implements the repositories directly.** It no longer emulates a directory.
* **The desktop's behaviour does not change.** Its code moves, from `projects/`
  and `app/` into the folder implementation, and it runs the new suites.
* **Every existing folder stays readable as it is.** Documents with
  `../images/` references are read through the folder implementation's
  translation, and written back the same way. No migration touches a
  person's folder.
* **The history contract is answered by git on the desktop.** A thing's
  history on a large folder costs a scan. That is accepted.
* **Scopes gain identities.** The folder implementation keeps a scope's id in
  its `scope.json`, adding one where a folder has none.

## As built, 29 September 2026: the repository contracts

**What was built.** The five repositories of §1 are ports, with nothing
implementing them yet, and the ports they replace are still there:
- `src/ports/ScopeRepository.ts`, `OrganisationIndex.ts`,
  `HistoryRepository.ts`, `ImageRepository.ts` and `SettingsRepository.ts`,
  and `Repositories.ts`, the one value a source hands the app (§4).
- **Their words**, where the domain's pure code can share them:
  - `projects/scopeState.ts`: address, identity, revision, a scope's state,
    the step, and `applySteps`, the one writer every implementation shares.
  - `model/recordKey.ts`: a record by kind and id, worked out from what a
    command writes (ADR-0028).
  - `model/imageName.ts`: an image's name, its image folder, the `image:`
    reference, and the content address.
  - `projects/settings.ts`: settings, and the patch that changes them.
- **A contract suite per repository**, `src/ports/*Repository.contract.ts` and
  `OrganisationIndex.contract.ts`, all taking one maker
  (`Repositories.contract.ts`). They run against in-memory repositories
  written for them, `src/ports/testing/memoryRepositories.ts`, which are test
  support and not an implementation.
- **The rule** of §4 is `build/storageLine.test.ts`, over the data in
  `build/storageLine.ts`: no imports across the line, and no storage words in
  identifiers. The tree's violations when it arrived are its exceptions, each
  held to exactly what its file does, so the list only shrinks: 20 files
  importing the folder format, and 47 naming storage. The twelve files that
  are the folder format and still sit in `projects/` and `ports/` are listed,
  and leave the list as they move. The new seams and their words are held to
  the stricter list of the decision drivers, comments included, with no
  exceptions.

**Where the build departed from the text.**
- **The domain types live in `projects/` and `model/`, not in `ports/`.**
  `applySteps` needs them, and the pure modules may not import a port.
- **Two kinds of step the model does not hold yet.** Adding a picture to the
  library, or taking one out (`image.add`, `image.remove`), and changing what
  a scope says about itself (`scope.describe`: its kind, client, links, first
  view and marks) are steps. They are shaped as the model's commands are,
  with the model's refusals (`command.taken`, `command.gone`,
  `command.notAField`), so they can join the command vocabulary unchanged.
- **The history has no member that records an entry.** When a run of steps
  becomes an entry is each implementation's own business. The suites make
  one through the maker's `cut`.
- **Labels are a scope's own.** Two scopes may each use one label.
- **A content address is the SHA-256 of the bytes**, fixed rather than left
  to each implementation, so an address means one thing in every source.
  `ImageRepository` answers a listing of one image folder and a lookup by
  name beside the bytes.
- **The library's folders are called image folders** in code, so the rule can
  read *folder* as the storage word everywhere else.
- **A settings patch takes a key out with `null`**, not `undefined`, because
  a patch may travel as text.
- **The tree carries a revision** of its own, beside each scope's and the
  index's.
- **A step that changes nothing moves no revision.** The reducer hands back a
  new model for some such steps, so `applySteps` compares the records a step
  writes, before and after.
- **Refusals are values with keys.** Three are new: `shell.scopeGone`,
  `shell.scopeTaken`, `shell.scopeIntoItself`; and `shell.imageBadName` for
  a name a picture may not have. An address the repository refuses is one
  `isSafeScopePath` refuses today.
- **The rule reads identifiers only.** A comment may say what a folder does,
  and the words tables are not checked by it: *strings stay free of storage*
  is still a matter for review.
