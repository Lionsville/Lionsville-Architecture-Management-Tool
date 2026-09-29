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
  - `model/recordKey.ts`: a record by kind and id, and the records that
    differ between two models.
  - `model/imageName.ts`: an image's name, its image folder, the `image:`
    reference, a library entry, and the content address.
  - `projects/settings.ts`: settings, and the patch that changes them.
- **A contract suite per repository**, `src/ports/*Repository.contract.ts` and
  `OrganisationIndex.contract.ts`, all taking one maker
  (`Repositories.contract.ts`). They ran against in-memory repositories
  written for them as test support, which the next record replaced with the
  memory implementation (*As built: browser storage and memory*).
- **The rule** of §4 is `build/storageLine.test.ts`, over the data in
  `build/storageLine.ts`:
  - no imports across the line;
  - no storage words in identifiers, nor in the strings of code: the words,
    and the folder format's own spellings (`.json`, `.md`, `../`, `images/`,
    `docs/`, `.git`). A comment, the words tables, a module name imported, the
    marks' strings, the manual's web address, and *database* and *SQL* in a
    string, which are what a landscape holds, are not read.

  The tree's violations when the rule arrived are its exceptions, each held
  to exactly what its file does: 22 files importing the folder format (32
  imports), 52 naming storage (83 words and spellings), and the 14 files of the
  folder format still in `projects/`, `ports/` and `platform/`. Each list has a
  ceiling held to exactly its length, so it can only shrink, and grows only by
  a ceiling raised where the change shows it. The new seams and their words
  are held to the stricter list of the decision drivers, comments included,
  with no exceptions.

**Where the build departed from the text.**
- **The domain types live in `projects/` and `model/`, not in `ports/`.**
  `applySteps` needs them, and the pure modules may not import a port.
- **Two kinds of step the model does not hold yet.** Adding a picture to the
  library, or taking one out (`image.add`, `image.remove`), and changing what
  a scope says about itself (`scope.describe`: its kind, client, links, first
  view and marks) are steps. They are shaped as the model's commands are,
  with the model's refusals (`command.taken`, `command.gone`,
  `command.notAField`), so they can join the command vocabulary unchanged.
- **What a step touched is read off the state**, before and after, not off
  what its command says it writes (ADR-0028): a delete reaches relations,
  views and children its command does not name, and a relation's history
  ends with the step that removed it.
- **A step id is the source's, not a scope's.** A step applied is not applied
  again, and one sent to a scope other than the one it was applied to is
  refused (`step.elsewhere`, a caller's fault with no sentence of its own). A
  repository remembers the ids it applied for at least 24 hours, and for good
  where it keeps a log of its steps. A run whose steps have all landed answers
  the revisions as they stand, whatever it expected; a refused apply counts no
  step as applied and moves no revision anywhere; a scope named twice in one
  apply is its runs as one change.
- **The history records an entry when asked.** Steps collect in each scope's
  open entry, and `HistoryRepository.record` closes it with a subject; an
  implementation may also close one when it judges a run has ended. When the
  app moves onto the repositories, the four places that take a snapshot today
  become:
  - *File › Snapshot* (`app/history/useProjectHistory.ts`, `take`): `record`
    over every scope, with the person's words;
  - the safeguard before a replace (`useProjectHistory.ts`, `safeguard`):
    `record` over the scope being replaced, before the replace's steps;
  - the snapshot before a pull on open (`app/bootReads.ts`, `pullOnOpen`):
    pulling is the folder implementation's own capability (§2), so the record
    before it moves with it into the folder provider's chrome;
  - the snapshot before a format upgrade (`bootReads.ts`, `upgradeFormat`):
    the upgrade is the folder implementation's own pass, and it records
    through its own history before it rewrites anything.
- **Labels are a scope's own.** Two scopes may each use one label.
- **An image's name is fixed as a rule**, the same wherever it is checked:
  - composed (Unicode NFC), and refused when it is not;
  - segments split on `/`, none empty and none `.` or `..`;
  - no white space, no control character (U+0000–U+001F, U+007F), and none of
    `\ < > ( ) ? # % : * " |`;
  - an extension, in any case, that is `png`, `jpg`, `jpeg`, `svg` or `webp`;
  - one picture per name in a scope's library, compared composed and in lower
    case.

  An entry's media type is its name's, its content address is `sha256:` and
  64 lower-case hex digits — the SHA-256 of the bytes, fixed so an address
  means one thing in every source — and its size, width and height are whole
  numbers of zero or more. `ImageRepository` answers a listing of one image
  folder and a lookup by name beside the bytes, and the bytes of a name come
  with its own entry's media type.
- **The library's folders are called image folders** in code, so the rule can
  read *folder* as the storage word everywhere else.
- **A settings patch takes a key out with `null`**, not `undefined`, because
  a patch may travel as text.
- **Revisions.** A scope's revision moves when its state changes, and only
  then; a move changes the moved scope's and every scope's under it, because
  an address is part of a state. The tree has a revision of its own, which
  moves when what a node says changes and not for `updatedAt`. The index's
  answer to *what changed since* names every scope something happened to and
  no other.
- **Refusals are values with keys.** Five are new: `shell.scopeGone`,
  `shell.scopeTaken`, `shell.scopeIntoItself`, and `shell.imageBadName` and
  `shell.imageBadEntry` for a picture. An address the repository refuses is
  one `isSafeScopePath` refuses today.

## As built, 29 September 2026: the folder implementation

**What was built.** The folder is an implementation of the five
repositories, in `src/adapters/folder/`:
- **What moved there**: the folder store, its settings file, its staged
  writes and the fake folder the suites run on (from `adapters/fileSystem/`);
  `DirectoryHandle` and its contract (from `ports/`); the browser's and the
  desktop's handles and the desktop's git history (from `adapters/browser/`
  and `adapters/desktop/`); and the fingerprint of a scope's files, out of
  `projects/revision.ts`, which keeps the refusal and the fingerprint every
  store shares.
- **`folderRepositories(opening)`** builds the five over a folder handle, its
  history (`FolderGit`) and a place for the person's own settings.
- **The history over git** is `platform/node/gitEntries.ts` — the changes, a
  commit of some paths, the commits with what each changed, the files at one,
  the tags — behind eight new channels of the desktop's history, and
  `DesktopFolderGit` over them. A history kept in memory (`memoryGit.ts`) is
  test support for the fake folder.
- **Every suite runs twice**: over the fake folder with the history in
  memory, and over a real temporary folder with the machine's own git,
  through the desktop's handle and history with each channel minus the wire.
- **The suites gained clauses for a move and a removal**, binding every
  implementation: the scopes under a moved one keep their history, pictures
  and settings; a scope made where a removed one was, or under its address,
  starts empty in all four.

**How the folder meets each contract.**
- **Identity.** `scope.json` carries `id`. A folder written before scopes had
  one reads as having one all the same, made from its address, so it is the
  same every time the folder is read; it is written into the header the first
  time anything writes that scope, a move included. Nothing writes a folder
  only to add identities. Two headers claiming one id — a scope's folder
  copied by hand — are read with it at the address it was last found at (the
  first by address, where it was found at neither), and the other as a folder
  with none. An address is answered composed (NFC), and an identity made from
  it is made from it composed, whatever the disk spells; no folder is renamed. The folder format carries a header key it does not
  write through a save (`ScopeSnapshot.carried`), so the app's store keeps an
  identity, and the library below, where it finds them.
- **Revision.** A fingerprint of the scope's address, every file of the
  format it holds, and each picture of its library by name and bytes. Content, so two reads of an
  unchanged scope agree and a step that changes nothing moves nothing.
- **Steps, all or none.** Every scope's steps are applied and every refusal
  made before anything is written; then the folder store writes every scope's
  files together, staged before any is moved into place where the folder can
  (the desktop's main process; a browser's handles that can rename). What a
  stop part way leaves is what that write leaves: on the desktop some files
  in place and the rest staged beside them; over a handle that cannot rename,
  some scopes written and some not. The pictures are written after the
  scopes' files, so a stop between leaves an entry whose bytes answer
  nothing until they are put again. Before the write begins, each step is
  remembered with what its scope's files are to be fingerprinted as once it
  has landed, worked out with nothing written; a step sent again whose scope
  is now that counts as landed, and one whose scope is not is applied. So a
  run across several scopes that a stop cut short, sent again, lands on the
  scopes it had not reached and leaves the ones it had.
- **Step ids** are remembered for two days, and never in the folder: a file
  of ours there is one a person sees and a copy carries, and `.git` is git's.
  Whoever composes the folder says where they are kept (`StepStore`): on the
  desktop, in its own data folder beside what it does about each folder
  (`applied-steps.json`, keyed by the folder); in a browser, in its
  IndexedDB beside the folder's handle — a handle has no identity storage can
  be keyed by, so each kept handle is asked whether it is the same folder.
  Both keep them through a restart.
- **The folder's `.git` is no path the file channel takes**, in any spelling
  and through no link, and no git the app runs starts a hook or a file-system
  monitor: a folder's history is git's, and nothing a page writes there is a
  program the app runs.
- **A move** takes the scope's folder and the scopes under it as they are —
  the format's files, the pictures, the settings, whatever a person keeps
  there, links and empty folders included. On the desktop it is one rename in
  the main process, and no byte passes through the page; where the handles
  cannot rename, every file is copied to the new address and the old folder
  removed only after, so a stop part way leaves two copies, which a person can
  see and settle, never none. Each scope's identity is written into its header
  where it was not yet.
- **History.** A `record` is one commit of the scopes it closes, each scope's
  own files — everything in its folder but the scopes filed under it, and
  never the machine's settings file an older build left — with a trailer per
  scope (`Lionsville-Scope: <id> <address>`), read from the trailer block
  alone; a subject is written as one line. A commit is an entry of each scope
  it names, and a commit without a trailer — an older build's snapshot, a
  person's own — is an entry of a scope whose own files it changed where the
  scope has been, while the header there said the scope's identity (or none,
  and the address makes it), so a scope made where a removed one was is not
  handed its past. A page after a page is counted from the commit the first
  started at, so a history that grows or merges meanwhile neither repeats nor
  skips an entry; a merge is no entry of its own. A thing's history asks git
  only for the commits that changed where a record of its kind is kept; an
  element's or a relation's is answered from the ids of what each commit
  changed, its own file's changing being enough and the model they share
  read once per version; any other is read off the scope at the commit and at
  its parent. It stops at the entry after the page, and what it read is kept
  to a size; a perf budget holds it on ten thousand commits
  (`adapters/folder/history.perf.test.ts`). `record` starts a history where
  the folder keeps none, as a snapshot always has, and refuses, with a key a
  person can act on, part way through a merge, a rebase, a cherry-pick or a
  revert, with a file unmerged, or on no branch. The paths it commits go to
  git on its standard input; git older than 2.25 is refused once, with a
  sentence that says so; a failure crosses to the page as a key, never as
  git's words, which name paths.
- **Labels** are tags named `<scope id>/<slug>`, so two scopes may each use
  one label; a tag so named is that scope's wherever it is found, even once
  the scope is gone. A tag named otherwise — every label an older build made,
  which was the whole folder's, and any tag a person made — stays the whole
  folder's: it is read as a label of every scope's entry at its commit, and
  its slug is taken in every scope. The older snapshot's label refuses a word
  a scope already holds. No tag is renamed. `LabelOutcome` and
  `labelSlug` moved to `projects/label.ts`: a label travels with its history
  from one source to another, so every source compares labels by one rule.
- **Pictures.** Each is `images/<file>` as before; the library's rows —
  name, media type, size, width, height, content address, and the file where
  it is not the name — are `images` in `scope.json`, so a scope is read
  without reading a picture. A file no row names is in the library too: its
  entry is made from its bytes, read once, and it is listed the next time
  the scope is written. Its name is its file's where that passes the domain's
  rule, composed (a decomposed name from an older macOS reads composed), and
  one made from it where it does not; the file is never renamed. A picture
  filed in an image folder whose name differs only in case from one there is
  kept in that folder, whatever the disk, so `A/x.png` and `a/y.png` never
  depend on whether the disk tells case apart. Bytes put are held in memory
  until a step adds them, so bytes never added write nothing; a step adding
  an entry whose bytes were never put is not refused — the suites apply one —
  and its row says it waits for them (`pending`) until a later step writes
  them. A row whose file has gone otherwise leaves the library, and its name
  is free again; a file replaced under a row's name — another size, or on the
  desktop other bytes, which main fingerprints where the file is — is
  described afresh.
- **Documents** say `../images/<file>` on disk, as before, and `image:<name>`
  in the state; a document nobody changed is written back byte for byte, and
  a changed one at the depth its file is kept at (`imageLibrary.ts`, shared
  with browser storage, which keeps the same references).
- **Settings.** The organisation's are `.lionsville-architecture/organisation.json`
  at the root, and a scope's `.lionsville-architecture/settings.json` in its
  own folder, where they move and go with it and write no revision. The
  person's are wherever the composer says (`PersonSettings`), in memory where
  nobody does; the desktop's own data folder is wired when the app moves onto
  the repositories.
- **Pull, push and the remote** are in no repository. They stay on
  `ProjectHistory.sync` until the app moves onto the repositories and they
  become the folder provider's chrome.
- **No migration touches a person's folder**: reading a folder writes nothing
  to it, and a write writes only the files it changed, the identity and the
  library in the header among them.

**Where the build departed from the text.**
- **The folder format has not moved yet.** `projects/folderFormat.ts`, the
  readers it is made of, the history subjects by path, the working file and
  its manifest, the migrations and the settings file stay in `projects/` (and
  `platform/scopeHeader.ts` in `platform/`) until the app no longer imports
  them: the history and the examples first, then the working file's codec.
  Moved now, `app/` and `projects/` would import `adapters/`, which the
  import matrix refuses. The folder's repositories import them from
  `projects/` meanwhile, and the storage line still lists them: 13 files of
  the folder format (from 14), 21 files importing across the line (from 22)
  with 31 imports (from 32), and 51 files naming storage (from 52) with 82
  words (from 83).
- **A picture replaced in a browser's folder by other bytes of the same
  size keeps its row's entry.** A browser answers a file's size without
  reading it and no digest without reading it, and reading a scope reads no
  picture; the desktop's main process fingerprints the file where it is.
- **An entry's id is its commit and its scope together**, because one commit
  is an entry of every scope it records and each must be one of its own.
- **The index leaves out a scope whose `model.json` is missing or will not
  read**, as the folder store's reading for the index always has: unknown,
  not empty.
- **An observation with no history** is written `history: none`, so it reads
  back as none; a file that says nothing is still a hand-written one, given
  the recorded event it must have had.

## As built, 29 September 2026: browser storage and memory

**What was built.** Browser storage and memory implement the five
repositories, and both run every suite. The ports they replace
(`ScopeStore`, `ProjectHistory`, `FolderSettings`) and the stores behind
them are still what the app uses; nothing above the seam changed.
- **One set of repositories, two stores.** `adapters/repositories/` holds the
  five, written once over `KeyedStore`: a transactional key-value store, as
  little of one as they need. Memory is `MemoryStore`, and browser storage is
  `IndexedDbStore`; they differ only in where the values sit. Each store runs
  `KeyedStore.contract.ts`, the promises the repositories count on that the
  suites cannot see:
  - a transaction that fails lands nothing, and two writing transactions
    never interleave;
  - a range sees its own transaction's writes, and keys sort by UTF-16 code
    unit, as a browser's database sorts them;
  - a read transaction, a shelf it did not name, and a value that cannot be
    copied are refused;
  - a request after the work has answered, or after it waited on anything but
    the transaction's own answers, is refused, as a browser's database
    refuses it. Memory refuses it too, rather than taking what a database
    would not.
  The lint refuses `indexedDB` and `IDBKeyRange` outside `adapters/`, as it
  refuses the key-value storage.
- **Memory is a product adapter** (`adapters/memory/memoryRepositories.ts`).
  The suites' own in-memory repositories in `ports/testing/` are gone, because
  `ports/` may not import an adapter and a second copy would only drift.
- **A scope is kept in three parts:** what the tree says of it, its content,
  and its library one entry per picture. The tree reads no model. A picture is
  found by name, and an image folder listed, from the entries under that name
  alone.
- **An apply is one transaction** over every scope it names, their libraries,
  the step ids and the index's log. It lands whole or not at all, and a page
  closed half-way leaves the store as it was.
- **History** keeps each entry's list line apart from the state at it, both
  filed under the scope's identity, so a page of entries reads no state and a
  history follows its scope through a move. Entries are numbered across the
  source, so several scopes' entries merge newest first and no number is
  given twice. An entry closes only at `record`: no timer closes one.
- **Step ids are kept a week**, where the contract asks for a day, filed also
  by the day they landed so the old ones go without a scan.
- **The index's revision** is the source's own mark and the number of its
  log. Its log keeps the last thousand changes; a revision further back, or
  from another source, is answered with nothing.
- **Pictures' bytes** are kept under their scope and their content address. They
  go when the scope is removed, and not before, because an entry in the
  scope's history may name them. Bytes for a scope that is not there are
  refused, `shell.scopeGone`: a clause in the image suite, and a key the port
  now names.
- **A scope that cannot be read whole** is one whose content has a later
  format than this build writes. It is shown and refuses every step.

**Browser storage is IndexedDB.** The key-value storage the scopes were kept in
holds a few megabytes of text for the whole origin, one key at a time. A history
with the state at every entry, and pictures kept as bytes, do not fit it
without being cut to fit, and an apply to several scopes there would be several
writes. An IndexedDB transaction spans every object store it names and lands
whole or not at all. It keeps bytes as bytes, and its quota is a share of the
disk. The key-value storage stays what the preferences are kept in and how
`available.ts` asks whether this browser keeps anything at all. Node has no
IndexedDB, so its suites run over a fake of the part the store uses
(`webStorage/testing/fakeIndexedDb.ts`), which keeps the behaviours the store
is written around.

**What a person kept before is copied, never moved**
(`webStorage/earlierScopes.ts`, over `repositories/bring.ts`).
- **The copy.** When the database is new, every scope the key-value storage
  holds is read as its store reads it. It is turned into the repositories'
  shape with the folder's own translation: a document's `../images/<file>`
  becomes `image:<name>`, and each data URL becomes bytes and a library entry.
  A picture whose file name says nothing, or the wrong thing, about its bytes
  takes the extension its data URL says. Each scope keeps when it was last
  saved, and its first entry is the state it arrived in.
- **What will not read is left, and said.** Each scope and each picture is
  read on its own. A text, a scope or a picture that will not read stays
  where it was, the rest comes over, and the note kept with the repositories
  lists what was left, so a person can be told.
- **Every start looks again, and an older copy never lands over newer
  work.** The note keeps, per address, the revision and time of the text last
  looked at. The source keeps which scope each address was brought to, the
  revision it was left at, and a fingerprint of the content brought. A text
  only saved again with that same content — as an older build saves every
  scope it upgrades on opening — is no change, and is passed over. One an
  older page changed or added since is brought again only where that scope is
  still at that address and at that revision: nothing was done to it here
  since. Anywhere else — a
  step here, a move, a removal — it has changed in both places. Nothing is
  written, and the standing lists the address until a person answers it,
  one address at a time: `bringOver` writes the older copy after an entry
  that keeps what was here, `leave` keeps what is here and brings the older
  copy only once it changes again with nothing done here since. A scope here
  that cannot be read whole is not written over, and is named.
- **One key is written: a marker.** It sits outside every key a scope or a
  preference is kept under, so an older build ignores it, and it says a copy
  was made. Every other key stays byte for byte as it was. Where the marker is
  there and the database is new, the database was lost after a copy, and what
  the key-value storage holds may be long out of date. Nothing is brought:
  the standing says a person must choose (`Earlier`: `standing`, `bringOver`,
  `leave`), for the app to ask when it moves onto the repositories.

**Where the build departed from the text.**
- **Two implementations share one set of repositories.** §2 names browser
  storage and memory as implementations. They are one implementation over two
  stores, because what differs between them is where values sit, not how a
  step lands.
- **The suites' own in-memory repositories are gone**, where the contracts'
  record kept them as test support. Memory is now the product adapter every
  suite runs against first.
- **No entry closes by itself.** An implementation may close an entry when it
  judges a run has ended. Neither does: an entry closes at `record` and at
  nothing else, until the app says when a run has ended.
- **An entry's `by` is the source's word for itself**, *this browser* or *this
  session*: neither keeps a person's name.
- **The subject of an entry a scope arrived as is English.** A history keeps a
  sentence, not a key, and a sentence written once cannot follow the language
  a later reader picks.

**Left for when the app moves onto the repositories.** The database opens on
the first call, and every repository answers a promise anyway. Where IndexedDB
will not open, the first call rejects. Choosing browser storage, and what to do
then, is the composition's.
